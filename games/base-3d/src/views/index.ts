// base-3d's views (DESIGN.md §3.1): render rows to what the renderer draws. Wick's render rows to the figure view's
// state (M3 spec §4.4.5), Q16.16 rows to metres for the views and the camera, and the area to its walls, floors,
// ceilings and props (M3.7b part 3). Not sim code: `pnpm boundaries` does not scan it, and the sim never reads it
// back (law 1).

import type {
  FigureClipDef,
  FigureDef,
  FigureLibrary,
  MotionLibrary,
} from '@automataframework/automata-figures'
import type {
  Box3,
  FigureViewState,
  Occluders,
  PlanPoint,
  SceneFog,
  View3dFactory,
} from '@automataframework/automata-render-pixi3d'
import { Q16 } from '@automataframework/automata-render-pixi3d/sim'
import type { FieldRecord } from '@automataframework/automata-sim'
import type { View3D } from '@pixi/3d'
import { ACTION_CLIP, ROLL, TICK_HZ, WALK_SPEED } from '../constants/index.ts'
import type { AreaSource } from '../systems/index.ts'

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

/** Turn units (65,536 a turn) to radians, 2π spelled out (`pnpm boundaries` scans src/ until GL.7 lands). */
const radians = (units: number): number => (units * 6.283185307179586) / 65_536
const seconds = (tick: number): number => tick / TICK_HZ

/**
 * Wick's figure state from his `hero` and `hero-action` rows: walking at the walk speed or standing, and the roll's clip
 * from the tick it started, retimed to the roll's length so the lunge and the clip end together.
 */
export function heroFigureState(components: Components): FigureViewState {
  const hero = components.hero ?? {}
  const act = components['hero-action'] ?? {}
  const moving = hero.moving === true
  const rolling = Number(act.clip ?? 0) === ACTION_CLIP.roll
  return {
    moving,
    speed: moving && !rolling ? WALK_SPEED : 0,
    moveDir: radians(Number(hero.moveDir ?? 0)),
    ...(rolling && {
      action: { id: 'roll', length: ROLL.ticks / TICK_HZ, startedAt: seconds(Number(act.startedAt)) },
    }),
  }
}

/** A Q16.16 row (`hero`, `target`) as the 3D views place it: metres on the floor, `facing` in radians or `yaw`. */
export function placed(
  row: Readonly<FieldRecord> | undefined,
  yaw = 0,
): { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number } {
  return {
    x: Number(row?.x ?? 0) / Q16,
    y: 0,
    z: Number(row?.z ?? 0) / Q16,
    yaw: row?.facing === undefined ? yaw : radians(Number(row.facing)),
  }
}

/** The component the views read their pose from: `placed` of the row they are registered under. */
const POSE = 'pose'

/**
 * `factory` placed from the Q16.16 component it is registered under (`hero`, `target`): it reads a `pose` record in
 * metres and radians added beside the row's own, so a view written for metres (`figure`, `mesh`) draws a sim that
 * keeps fixed point. `yaw` faces a row with no `facing`.
 */
export function inMetres(factory: View3dFactory, yaw = 0): View3dFactory {
  const wrapped: View3dFactory = (row, componentId, models, light) => {
    const withPose = (components: Components): Components => ({
      ...components,
      [POSE]: placed(componentId === undefined ? undefined : components[componentId], yaw),
    })
    const view = factory({ sid: row.sid, components: withPose(row.components) }, POSE, models, light)
    if (view === undefined) return undefined
    return {
      container: view.container,
      update: (curr, prev, alpha) => view.update?.(withPose(curr), prev && withPose(prev), alpha),
      destroy: () => view.destroy?.(),
    }
  }
  return factory.models === undefined ? wrapped : Object.assign(wrapped, { models: factory.models })
}

/** Metres from the floor to the ceiling: above the views' 2 m bounds, so the camera never meets it. */
const WALL_HEIGHT = 2.6
/** A hair past a face, to ask which side a room is on. */
const BEYOND = 0.01

/** A wall as the occluders draw it: its inside face from `a` to `b`, the room on its left, thickness outward. */
export interface SceneWall {
  readonly a: PlanPoint
  readonly b: PlanPoint
  readonly height: number
  readonly thickness: number
}

/** What the scene hook builds from the area (M3.7b part 3). */
export interface Scene {
  readonly walls: readonly SceneWall[]
  readonly floors: readonly Box3[]
  readonly ceilings: readonly Box3[]
}

type Rect = { readonly min: readonly [number, number]; readonly max: readonly [number, number] }

const inside = (rooms: readonly Rect[], x: number, z: number): boolean =>
  rooms.some((room) => x > room.min[0] && x < room.max[0] && z > room.min[1] && z < room.max[1])

/**
 * The face of an area wall (an axis-aligned box) that a room lies against, the room on its left (the inward normal is
 * `(−dir.z, dir.x)`, render-pixi3d's occluder rule). The box's short side is the thickness; a wall with rooms on both
 * sides takes its face toward −z or −x.
 */
function wallOf(box: Rect, rooms: readonly Rect[]): SceneWall {
  const [x0, z0] = box.min
  const [x1, z1] = box.max
  const alongX = x1 - x0 >= z1 - z0
  const thickness = Math.round((alongX ? z1 - z0 : x1 - x0) * 1000) / 1000
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const face = (a: PlanPoint, b: PlanPoint): SceneWall => ({ a, b, height: WALL_HEIGHT, thickness })
  if (alongX)
    return inside(rooms, cx, z0 - BEYOND)
      ? face({ x: x1, z: z0 }, { x: x0, z: z0 })
      : face({ x: x0, z: z1 }, { x: x1, z: z1 })
  return inside(rooms, x0 - BEYOND, cz)
    ? face({ x: x0, z: z0 }, { x: x0, z: z1 })
    : face({ x: x1, z: z1 }, { x: x1, z: z0 })
}

/** The area's walls, and a floor and a ceiling over each room: a pit has none, so it shows as a gap. */
export function sceneOf(area: AreaSource): Scene {
  const rooms = area.rooms
  return {
    walls: area.walls.map((wall) => wallOf(wall, rooms)),
    floors: rooms.map((room) => ({
      min: [room.min[0], -0.1, room.min[1]],
      max: [room.max[0], 0, room.max[1]],
    })),
    ceilings: rooms.map((room) => ({
      min: [room.min[0], WALL_HEIGHT, room.min[1]],
      max: [room.max[0], WALL_HEIGHT + 0.1, room.max[1]],
    })),
  }
}

/** The room's fog: none for 5 m, full at 14 m, its colour the sky the fogged walls meet (Endesga 64 #2e222f). */
export const FOG: SceneFog = { near: 5, far: 14, color: 0x2e222f }

// The room's colours (Endesga 64): a lighter floor than the walls so the platforms read, a dark lava below the channels, and
// a bright lip along each channel's edge so the player can see where to roll from.
const COLOURS = { wall: 0x3a4466, floor: 0x8b9bb4, ceiling: 0x262b44, lava: 0x7a2a12, lip: 0xfeae34 } as const
/** The channels' floor, metres below the platforms, and the lip's height and width. */
const LAVA_DEPTH = 3
const LIP = { height: 0.06, width: 0.12 } as const

/** Builds the area under the view's root (the renderer's `scene` hook): the walls cut away by the occluder rule, the floors and the ceilings the angled view never draws. */
export function buildScene(view: View3D, occluders: Occluders, area: AreaSource): void {
  view.environment = { skyColor: 0xc7dcd0, groundColor: COLOURS.floor }
  const scene = sceneOf(area)
  for (const floor of scene.floors) occluders.box(floor, COLOURS.floor)
  for (const wall of scene.walls) occluders.wall({ ...wall, color: COLOURS.wall })
  for (const ceiling of scene.ceilings) occluders.ceiling(occluders.box(ceiling, COLOURS.ceiling))
  for (const box of channelBoxes(area)) occluders.box(box.box, box.colour)
}

/** A channel's lava floor, and a lip along each long edge on the platforms' sides (the pits run the room's width). */
export function channelBoxes(area: AreaSource): { readonly box: Box3; readonly colour: number }[] {
  return (area.pits ?? []).flatMap((pit) => {
    const [x0, z0] = pit.min
    const [x1, z1] = pit.max
    const lip = (zEdge: number): Box3 => ({
      min: [x0, 0, zEdge - LIP.width / 2],
      max: [x1, LIP.height, zEdge + LIP.width / 2],
    })
    return [
      { colour: COLOURS.lava, box: { min: [x0, -LAVA_DEPTH - 0.1, z0], max: [x1, -LAVA_DEPTH, z1] } as Box3 },
      { colour: COLOURS.lip, box: lip(z0) },
      { colour: COLOURS.lip, box: lip(z1) },
    ]
  })
}

type Kind<T> = Readonly<Record<string, T>>

/** The figures extension's kinds as compiled content holds them. */
interface FigureKinds {
  readonly figure: Kind<FigureDef>
  readonly 'figure-swatch': FigureLibrary['swatches']
  readonly 'figure-hair': FigureLibrary['hair']
  readonly 'figure-headwear': FigureLibrary['headwear']
  readonly 'figure-item': FigureLibrary['items']
  readonly 'figure-gait': MotionLibrary['gaits']
  readonly 'figure-pose': MotionLibrary['poses']
  readonly 'figure-clip': Kind<FigureClipDef>
  readonly 'figure-stand': MotionLibrary['stands']
  readonly 'figure-rig': MotionLibrary['rigs']
}

/**
 * The figures, their library and the motion library from the compiled content. The compiler parsed every record with
 * the figures kinds' schemas, so each is that schema's output; the generated `virtual:automata/content` types describe
 * the TOML's literal shape instead (its unions and tuples narrower than the schemas' types), hence the one cast here.
 */
export function figureContent(content: unknown): {
  readonly figures: Kind<FigureDef>
  readonly library: FigureLibrary
  readonly motion: MotionLibrary
} {
  const kinds = content as FigureKinds
  return {
    figures: kinds.figure,
    library: {
      swatches: kinds['figure-swatch'],
      hair: kinds['figure-hair'],
      headwear: kinds['figure-headwear'],
      items: kinds['figure-item'],
    },
    motion: {
      gaits: kinds['figure-gait'],
      poses: kinds['figure-pose'],
      clips: kinds['figure-clip'],
      items: kinds['figure-item'],
      stands: kinds['figure-stand'],
      rigs: kinds['figure-rig'],
    },
  }
}
