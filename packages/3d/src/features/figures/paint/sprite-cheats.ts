// What a painted sprite bends so a few cells read well: the head tips toward the camera, a head at 45° turns a little
// further so the far eye clears the far contour, and the head's lead over a turning body moves in 30° steps (a sprite's
// head turn is a few frames, so a turn is a short, fixed set of cells). The cell's view feeds them to the motion state.

import { sin } from '@automata/sim/math'

/** The head's lead step (rad). */
const HEAD_STEP = Math.PI / 6
/** The three-quarter view's head turn toward the camera (rad), at 45° from it: a true 45° head leaves the far eye two
 * texels of face, where it reads as part of the outline. It fades to none square on and in profile. */
export const THREE_Q = 0.2

/** The motion state's sprite inputs (`MotionState`): the head's lead, how far it tips back, the body's yaw against the
 * camera and the camera's pitch. */
export interface SpriteCheats {
  readonly headYaw: number
  readonly lookUp: number
  readonly view: number
  readonly pitch: number
}

/**
 * The cheats for a figure `relativeYaw` from the camera (rad, snapped to the 8 directions), whose body is `lead` (rad)
 * short of the facing it wants, under a camera tilted `pitch`. `face.camera` is how far the head tips toward the camera
 * and `face.turn` how far it turns toward it in profile; the head never leads past `headLead`. The head does not turn
 * toward the camera when the figure faces away.
 */
export function spriteCheats(
  relativeYaw: number,
  lead: number,
  pitch: number,
  face: { readonly camera: number; readonly turn: number },
  headLead: number,
): SpriteCheats {
  const a = Math.abs(relativeYaw)
  const threeQ = a <= Math.PI / 2 ? THREE_Q * sin(2 * a) : 0
  const toCamera = a < Math.PI * 0.7 ? -relativeYaw * face.turn - Math.sign(relativeYaw) * threeQ : 0
  const headYaw = Math.max(-headLead, Math.min(headLead, Math.round(lead / HEAD_STEP) * HEAD_STEP + toCamera))
  return { headYaw, lookUp: face.camera * pitch, view: relativeYaw, pitch }
}
