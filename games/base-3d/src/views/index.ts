// base-3d's views (DESIGN.md §3.1): render rows to what the renderer draws. Wick's render rows to the figure view's
// state (M3 spec §4.4.5), Q16.16 rows to metres for the views and the camera, and the room's world (the world builder's
// floors, walls and ceilings) with a lip along each channel. Not sim code: `pnpm boundaries` does not scan it, and the sim never reads it
// back (law 1).

import {
  type Box3,
  drawWorld,
  type FigureViewState,
  type Look,
  type Occluders,
  type SceneFog,
  swatchColour,
  type View3dFactory,
} from '@automata/3d'
import type {
  FigureAction,
  FigureClipDef,
  FigureDef,
  FigureLibrary,
  MotionLibrary,
} from '@automata/3d/figures'
import { clipsWithActions } from '@automata/3d/figures'
import { Q16 } from '@automata/3d/sim'
import type { FieldRecord } from '@automata/sim'
import type { View3D } from '@pixi/3d'
import { ACTION_CLIP, ROLL, TICK_HZ, WALK_SPEED } from '../constants/index.ts'
import type { RoomWorld } from '../content/room.ts'
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

/** The room's fog: none for 5 m, full at 14 m, its colour the sky the fogged walls meet (DUEL, ramp 12 step 0). */
export const FOG: SceneFog = { near: 5, far: 14, color: 0x31222a }

// The lip along each channel's edge: a bright DUEL colour so the player can see where to roll from. The room's other
// colours are its swatches' (`content/world-swatches`): a lighter floor than the walls so the platforms read, a dark
// lava below the channels, brown crates and barrels.
const LIP_COLOUR = 0xffb108
/** The lip's height and width. */
const LIP = { height: 0.06, width: 0.12 } as const

/** Draws the room under the view's root (the renderer's `scene` hook): the world builder's floors, walls and ceilings, the walls cut away by the occluder rule, and the lip along each channel. */
export function buildScene(
  view: View3D,
  occluders: Occluders,
  area: AreaSource,
  room: RoomWorld,
  look?: Look,
): void {
  const colourOf = (swatch: string) => swatchColour(room.library, swatch)
  view.environment = { skyColor: 0xcdd2da, groundColor: colourOf('floor') ?? 0x8690b2 }
  drawWorld({ parent: view.root, occluders, colourOf, look }, room.world.pieces)
  for (const box of lipBoxes(area)) occluders.box(box.box, box.colour)
}

/** A bright lip along each long edge of a channel, on the platforms' sides (the pits run the room's width). */
export function lipBoxes(area: AreaSource): { readonly box: Box3; readonly colour: number }[] {
  return (area.pits ?? []).flatMap((pit) => {
    const [x0, z0] = pit.min
    const [x1, z1] = pit.max
    const lip = (zEdge: number): Box3 => ({
      min: [x0, 0, zEdge - LIP.width / 2],
      max: [x1, LIP.height, zEdge + LIP.width / 2],
    })
    return [
      { colour: LIP_COLOUR, box: lip(z0) },
      { colour: LIP_COLOUR, box: lip(z1) },
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
  readonly 'figure-action': Kind<FigureAction>
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
      clips: clipsWithActions(kinds['figure-clip'], kinds['figure-action']),
      items: kinds['figure-item'],
      stands: kinds['figure-stand'],
      rigs: kinds['figure-rig'],
    },
  }
}
