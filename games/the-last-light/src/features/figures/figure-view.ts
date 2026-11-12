import type { View3dFactory } from '@automata/3d'
import { type CharacterDef, paintedFigure } from '@automata/character-kit'
import type { ActorView } from '@automata/cutscenes/stage-3d'
import type { FieldRecord } from '@automata/sim'
import type { Container3D } from '@pixi/3d'
import { PLAY_FIGURE } from './cast.ts'

// A painted figure for a character of the night, standing where `InSector` says, turned the way the sim says, walking when it walks.
// Each is also the cutscene's actor for its character: the stage places and turns it, and the sim's place takes it back when the
// scene ends. The figure is the character kit's painted one, at the old game's density and size (`PLAY_FIGURE`), lit by the room and
// casting its shadow on the floor, as the renderer's `lighting` and the look's `shadow` switch say.

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

/** The component whose `x` and `z` are where a character stands on the plan: the sectors' `InSector`. */
const PLACE = 'sectors.in-sector'
/** The record a painted view reads its pose from: metres, a yaw, and whether the figure walks. */
const POSE = 'pose'

/** Which way a character faces: from where she stood the frame before, else the way she faced. */
type YawOf = (curr: Components, prev: Components | undefined, was: number) => number

/** Whether a character walks (its legs move) rather than stands. */
export type MovingOf = (curr: Components, prev: Components | undefined) => boolean

/** The characters the stage can place, by who a script calls them (`player`, an agent's id). */
export type Actors = Map<string, ActorView>

/**
 * The yaw the kit's painted figure wants for the game's heading. The game's heading is the sim's (`atan2(dx, dz)`: 0 faces +z,
 * toward the play camera, and the old spawn's pi faces north, away from it); the kit's entity yaw 0 faces -z, half a turn from that.
 * Given the heading as it is, a figure faced the opposite way to where she walked and stood showing her face at the spawn, where the
 * old game shows her back.
 */
export const kitYaw = (heading: number): number => heading + Math.PI

/** Ada faces the way her `yaw` says (the sim's heading of her last step). */
export const adaYaw: YawOf = (curr, _prev, was) => {
  const yaw = curr.ada?.yaw
  return typeof yaw === 'number' ? yaw : was
}

/** A character with no heading of her own faces the way she last moved, and keeps it standing still. */
export const walkedYaw: YawOf = (curr, prev, was) => {
  const now = curr[PLACE]
  const before = prev?.[PLACE]
  if (now === undefined || before === undefined) return was
  const dx = Number(now.x) - Number(before.x)
  const dz = Number(now.z) - Number(before.z)
  return dx === 0 && dz === 0 ? was : Math.atan2(dx, dz)
}

/** Ada walks while her component says she does (a route or the stick carries her). */
export const adaMoving: MovingOf = (curr) => curr.ada?.walking === true

/** A character with no walking flag of her own walks when her place changed since the frame before. */
export const stepped: MovingOf = (curr, prev) => {
  const now = curr[PLACE]
  const before = prev?.[PLACE]
  if (now === undefined || before === undefined) return false
  return now.x !== before.x || now.z !== before.z
}

/** How one character is drawn: who she is, who a script calls her, which way she faces and whether she walks. */
export interface FigureLook {
  readonly def: CharacterDef
  /** Who a script calls this row's character; may depend on the row (an agent's id comes from its index). */
  readonly who: (components: Components) => string | undefined
  readonly yawOf: YawOf
  readonly movingOf: MovingOf
}

/** The pose a cutscene holds a figure in: where, which way, and whether it walks. */
type Placed = { x: number; y: number; z: number; yaw: number; moving: boolean }

/**
 * A painted view of the character, registered as `who` in `actors` so a cutscene can place it. The sim's pose drives it every
 * frame; while a cutscene places it the stage's own pose is shown through the same view, so the painter turns and walks it.
 */
export function figureView(look: FigureLook, actors: Actors): View3dFactory {
  const factory = paintedFigure(look.def, {
    ...PLAY_FIGURE,
    state: (components) => ({ moving: components[POSE]?.moving === true }),
  })
  return (row, _componentId, models, light, camera) => {
    let yaw = 0
    const withPose = (curr: Components, prev: Components | undefined, held?: Placed): Components => {
      const at = curr[PLACE]
      yaw = held?.yaw ?? look.yawOf(curr, prev, yaw)
      const pose = {
        x: held?.x ?? Number(at?.x ?? 0),
        y: held?.y ?? 0,
        z: held?.z ?? Number(at?.z ?? 0),
        // The game's heading kept as it is; the kit's figure turns from its own zero.
        yaw: kitYaw(yaw),
        moving: held?.moving ?? look.movingOf(curr, prev),
      }
      return { ...curr, [POSE]: pose }
    }
    const view = factory(
      { sid: row.sid, components: withPose(row.components, undefined) },
      POSE,
      models,
      light,
      camera,
    )
    if (view === undefined) return undefined
    const node: Container3D = view.container
    const name = look.who(row.components)
    // What a cutscene last said of this figure; it is shown through the view on each of its calls.
    const held: Placed = { x: 0, y: 0, z: 0, yaw: 0, moving: false }
    let placed = false
    const show = (): void => {
      if (placed) view.update?.({ ...row.components, [POSE]: held }, undefined, 1)
    }
    // Set by a cutscene's actor key; the sim's pose takes the figure back on the next frame the stage no longer places it.
    if (name !== undefined)
      actors.set(name, {
        place: (at, facing) => {
          held.x = at.x
          held.y = at.y ?? 0
          held.z = at.z
          held.yaw = facing
          placed = true
          show()
        },
        pose: (_name, moving) => {
          held.moving = moving
          show()
        },
        alpha: (value) => {
          node.visible = value > 0.01
        },
        clip: () => undefined,
      })
    return {
      container: node,
      update: (curr, prev, alpha) => {
        placed = false
        view.update?.(withPose(curr, prev), prev && withPose(prev, undefined), alpha)
      },
      destroy: () => {
        if (name !== undefined) actors.delete(name)
        view.destroy?.()
      },
    }
  }
}
