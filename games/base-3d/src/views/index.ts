// base-3d's views (DESIGN.md §3.1): render rows to what the renderer draws. Wick's render rows to the figure view's
// state (M3 spec §4.4.5), Q16.16 rows to metres for the views and the camera, and the area to its walls, floors,
// ceilings and props (M3.7b part 3). Not sim code: `pnpm boundaries` does not scan it, and the sim never reads it
// back (law 1).

import type { FigureClipDef, FigureDef, FigureLibrary, MotionLibrary } from '@mcthaydt/automata-figures'
import type {
  Box3,
  FigureViewState,
  ModelLibrary,
  Occluders,
  PlanPoint,
  SceneFog,
  Vec3,
  View3dFactory,
} from '@mcthaydt/automata-render-pixi3d'
import { CameraHeading, Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import type { FieldRecord } from '@mcthaydt/automata-sim'
import { Mesh3D, type View3D } from '@pixi/3d'
import { ACTION_CLIP, type MoveDef, TICK_HZ, WALK_SPEED } from '../constants.ts'
import type { AreaSource } from '../systems/index.ts'

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

/** The item Wick holds in the first slice: the sword (the shield waits on a second hand's item, M3.7b plan). */
export const HERO_ITEM = 'sword'
/** Where the lock aims on a target standing at the floor: its head and its chest, in metres above it. */
const AIM_HEIGHTS = { head: 1.5, chest: 1.2 } as const

/** Turn units (65,536 a turn) to radians, 2π spelled out (`pnpm boundaries` scans src/ until GL.7 lands). */
const radians = (units: number): number => (units * 6.283185307179586) / 65_536
const seconds = (tick: number): number => tick / TICK_HZ
/** Each action code's clip id: `ACTION_CLIP` the other way round. */
const CLIP_IDS: Readonly<Record<number, string>> = {
  [ACTION_CLIP.slash]: 'slash',
  [ACTION_CLIP.point]: 'point',
  [ACTION_CLIP.pickup]: 'pickup',
}

/**
 * The clip an action plays: a move's own (from `fighter.move` among `moves`), retimed to its `total` (DESIGN.md §7.2,
 * GAME-3D.1c part 3), when the action is a sword move or a dodge; otherwise the action code's clip at its own length.
 */
function actionClip(
  components: Components,
  code: number,
  moves: readonly MoveDef[],
): { readonly id: string; readonly length?: number } | undefined {
  if (code === ACTION_CLIP.slash || code === ACTION_CLIP.move) {
    const move = moves[Number(components.fighter?.move ?? 0) - 1]
    if (move !== undefined) return { id: move.clip ?? move.id, length: move.total / TICK_HZ }
  }
  const id = CLIP_IDS[code]
  return id === undefined ? undefined : { id }
}

/**
 * Wick's figure state from his `hero`, `hero-action` and `fighter` rows. `target` is the locked target's `target`
 * row (its plan position in Q16.16 metres), which the page looks up by `hero.lockTarget`; the head and chest aim at
 * it while he is locked. `moves` is the world's move table, which names each move's clip.
 */
export function heroFigureState(
  components: Components,
  target?: { readonly x: number; readonly z: number },
  moves: readonly MoveDef[] = [],
): FigureViewState {
  const hero = components.hero ?? {}
  const act = components['hero-action'] ?? {}
  const moving = hero.moving === true
  const clip = actionClip(components, Number(act.clip ?? 0), moves)
  const locked = Number(hero.lockTarget ?? 0) !== 0 && target !== undefined
  return {
    moving,
    speed: moving ? WALK_SPEED : 0,
    moveDir: radians(Number(hero.moveDir ?? 0)),
    item: HERO_ITEM,
    ...(clip !== undefined && { action: { ...clip, startedAt: seconds(Number(act.startedAt)) } }),
    ...(act.guard === true && { stances: [{ id: 'guard', startedAt: seconds(Number(act.guardSince)) }] }),
    ...(locked && {
      aim: (['head', 'chest'] as const).map((part) => ({
        part,
        at: [target.x / Q16, AIM_HEIGHTS[part], target.z / Q16] as const,
      })),
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

/** The camera's lock-on framing (M3 spec §4.2): the locked target's chest, or none. */
export function lockPoint(
  components: Components,
  rowOf: (sid: number) => Components | undefined,
): Vec3 | undefined {
  const sid = Number(components.hero?.lockTarget ?? 0)
  const target = sid === 0 ? undefined : rowOf(sid)?.target
  if (target === undefined) return undefined
  return { x: Number(target.x) / Q16, y: AIM_HEIGHTS.chest, z: Number(target.z) / Q16 }
}

/**
 * Whether this tick's heading is a recentre (DESIGN.md §11.2): it jumped to Wick's facing with no lock before or
 * after, which only a lock press with no target does in one tick, so the camera eases it over 250 ms. A turn that
 * happens to land on the facing eases too, which shows as nothing more than a smoother turn.
 */
export function recentred(curr: Components, prev: Components | undefined): boolean {
  const heading = curr[CameraHeading.id]?.heading
  const before = prev?.[CameraHeading.id]?.heading
  if (before === undefined || heading === before) return false
  return (
    heading === curr.hero?.facing &&
    Number(curr.hero?.lockTarget ?? 0) === 0 &&
    Number(prev?.hero?.lockTarget ?? 0) === 0
  )
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
  /** The ember Wick picks up to end the run, a block on the floor. */
  readonly ember: Box3
}

/** A static prop from The Last Light (public/models/PROVENANCE.md), standing at `x`, `z` facing `yaw`. */
export interface Prop {
  readonly file: string
  readonly x: number
  readonly z: number
  readonly yaw: number
  /** Metres tall, as the renderer scales it. */
  readonly height: number
}

/** The hall's pillar, west of the walk to the doorway: taller than 1.5 m, so it fades when it hides Wick. */
export const PILLAR: Box3 = { min: [-2.25, 0, 0.75], max: [-1.75, 2.4, 1.25] }

/** Three props, off the golden's route up x = 0 (they have no collider until the rooms are `af-sector` levels). */
export const PROPS: readonly Prop[] = [
  { file: 'models/oil-drum.glb', x: 3, z: 2.8, yaw: 0, height: 0.9 },
  { file: 'models/pallet-stack.glb', x: -3, z: -3, yaw: 0.4, height: 1 },
  // Against the kiln's east wall, in front of its camera (the view looks toward +x).
  { file: 'models/burner-bench.glb', x: 3.3, z: 6.2, yaw: -1.5707963267948966, height: 0.9 },
]

type Rect = { readonly min: readonly [number, number]; readonly max: readonly [number, number] }

const inside = (rooms: readonly Rect[], x: number, z: number): boolean =>
  rooms.some((room) => x > room.min[0] && x < room.max[0] && z > room.min[1] && z < room.max[1])

/**
 * The face of an area wall (an axis-aligned box) that a room lies against, the room on its left (the inward normal
 * is `(−dir.z, dir.x)`, render-pixi3d's occluder rule). The box's short side is the thickness; a dividing wall with
 * rooms on both sides takes its face toward −z or −x, the side the first slice's cameras look from.
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

/** Half the side of the ember's block, in metres. */
const EMBER_HALF = 0.15

/** The area's walls, a floor and a ceiling over each room, and the ember. */
export function sceneOf(area: AreaSource): Scene {
  const rooms = area.rooms
  const { x, z } = area.ember
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
    ember: {
      min: [x - EMBER_HALF, 0, z - EMBER_HALF],
      max: [x + EMBER_HALF, 2 * EMBER_HALF, z + EMBER_HALF],
    },
  }
}

/**
 * The first slice's fog (M3 spec §4.1): none for 5 m, full at 14 m down the hall and into the kiln, its colour the sky
 * the fogged walls meet (Endesga 64 #2e222f). Inline until render-pixi3d's `scene-lighting` kind can reach the
 * content plugin: the Vite config cannot load render-pixi3d's index in Node (M3.7b plan log).
 */
export const FOG: SceneFog = { near: 5, far: 14, color: 0x2e222f }

// The first slice's colours (Endesga 64) until the rooms are authored levels (GAME-3D.1i).
const COLOURS = {
  wall: 0x5a6988,
  floor: 0x3e3546,
  ceiling: 0x262b44,
  pillar: 0x8b9bb4,
  ember: 0xfb6b1d,
} as const

/**
 * Builds the area under the view's root (the renderer's `scene` hook): the walls cut away by the occluder rule, the
 * floors, the ceilings the angled view never draws, the pillar as a fading prop, the ember and the three props, each scaled to
 * its height and standing on the floor. The props are shorter than 1.5 m, so they never fade and share their
 * model's material.
 */
export function buildScene(view: View3D, occluders: Occluders, models: ModelLibrary, area: AreaSource): void {
  view.environment = { skyColor: 0xc7dcd0, groundColor: COLOURS.floor }
  const scene = sceneOf(area)
  for (const floor of scene.floors) occluders.box(floor, COLOURS.floor)
  for (const wall of scene.walls) occluders.wall({ ...wall, color: COLOURS.wall })
  for (const ceiling of scene.ceilings) occluders.ceiling(occluders.box(ceiling, COLOURS.ceiling))
  occluders.prop(occluders.box(PILLAR, COLOURS.pillar), { bounds: PILLAR })
  occluders.box(scene.ember, COLOURS.ember)
  for (const prop of PROPS) {
    const model = models.get(prop.file)
    if (model === undefined) throw new Error(`base-3d: the prop "${prop.file}" was not loaded`)
    const [minY, maxY] = [model.mesh.min[1], model.mesh.max[1]]
    const scale = prop.height / (maxY - minY)
    const mesh = new Mesh3D({ geometry: model.geometry, material: model.material })
    mesh.scale.set(scale, scale, scale)
    mesh.position.set(prop.x, -minY * scale, prop.z)
    mesh.rotation.set(0, prop.yaw, 0)
    view.root.addChild(mesh)
  }
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
