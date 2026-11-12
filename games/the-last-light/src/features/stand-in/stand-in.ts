import { box, type View3dFactory } from '@automata/3d'
import type { ActorView } from '@automata/cutscenes/stage-3d'
import type { FieldRecord } from '@automata/sim'
import type { Container3D } from '@pixi/3d'

// Plain figures for Ada and the creature: a box each, the height of the character, lit like a moving figure. They are what the
// screen draws until the painted figures and the wardrobe (workstream 4) dress the cast. Each is also the cutscene's actor for its
// character: the stage places and turns it, and gives it back to the sim's pose when the scene ends.

type Components = Readonly<Record<string, Readonly<FieldRecord>>>

/** The component whose `x` and `z` are where a character stands on the plan: the sectors' `InSector`. */
const PLACE = 'sectors.in-sector'
/** The record a wrapped view reads its pose from: metres and a yaw. */
const POSE = 'pose'

/** Which way a character faces: from where she stood the frame before, else the way she faced. */
type YawOf = (curr: Components, prev: Components | undefined, was: number) => number

/** How one stand-in looks. */
export interface StandIn {
  readonly size: { readonly width: number; readonly height: number; readonly depth: number }
  readonly color: number
}

/** Ada: a hospital gown, pale and bluish. About a metre fifty-five. */
export const ADA: StandIn = { size: { width: 0.46, height: 1.55, depth: 0.3 }, color: 0x9fb3c8 }
/** The creature: darker, taller, narrower. */
export const FIGURE: StandIn = { size: { width: 0.42, height: 1.78, depth: 0.32 }, color: 0x2a2630 }

/** The characters the stage can place, by who a script calls them (`player`, an agent's id). */
export type Actors = Map<string, ActorView>

/**
 * A view of a character standing where `InSector` says, turned by `yawOf`, registered as `who` in `actors` so a cutscene can
 * place it. `who` may depend on the row (an agent's id comes from its index).
 */
export function standIn(
  look: StandIn,
  who: (components: Components) => string | undefined,
  yawOf: YawOf,
  actors: Actors,
): View3dFactory {
  const factory = box(look.size, { color: look.color, lit: 'moving' })
  return (row, _componentId, models, light, camera) => {
    let yaw = 0
    const withPose = (curr: Components, prev: Components | undefined): Components => {
      const at = curr[PLACE]
      yaw = yawOf(curr, prev, yaw)
      return { ...curr, [POSE]: { x: Number(at?.x ?? 0), y: 0, z: Number(at?.z ?? 0), yaw } }
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
    const name = who(row.components)
    // Set by a cutscene's actor key; the sim's pose takes the node back on the next frame the stage no longer places it.
    if (name !== undefined)
      actors.set(name, {
        place: (at, facing) => {
          node.position.set(at.x, at.y ?? 0, at.z)
          node.rotation.set(0, facing, 0)
        },
        pose: () => undefined,
        alpha: (value) => {
          node.visible = value > 0.01
        },
        clip: () => undefined,
      })
    return {
      container: node,
      update: (curr, prev, alpha) =>
        view.update?.(withPose(curr, prev), prev && withPose(prev, undefined), alpha),
      destroy: () => {
        if (name !== undefined) actors.delete(name)
        view.destroy?.()
      },
    }
  }
}

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
