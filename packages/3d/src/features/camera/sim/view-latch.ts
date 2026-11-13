// The heading's rules, as pure functions over `camera-heading`'s fields so a game's
// systems call them and tests read them without a sim.
//
// The latch: crossing into another view while the stick is held keeps the stick mapping through the heading before
// the crossing, so a doorway does not reverse the character mid-stride (the classic fixed-camera rule). It lets go
// when the stick is centred or points more than 90° from where it pointed when the latch was taken, which is a
// negative integer dot product (exactly 90° holds), so no trig is needed. A player's own camera turn never latches
// and lets go of a latch: they asked for the new heading.
import type { FieldValues } from '@automata/sim'
import type { CameraHeading } from './camera-heading.component.ts'
import type { CameraView } from './camera-view.schema.ts'
import { degToHeading, MAX_CAMERA_TURN, stepHeading, turnDirection, turnHeading } from './heading.ts'
import { type Direction, mapStick, type Stick } from './stick-mapper.ts'

/** The fields of `camera-heading`. */
export type HeadingState = Readonly<FieldValues<(typeof CameraHeading)['fields']>>

/** Before the first view: no view, heading 0, no turning, no latch (the component's defaults). */
export const START: HeadingState = {
  view: '',
  heading: 0,
  rotate: false,
  latched: false,
  latchHeading: 0,
  latchX: 0,
  latchY: 0,
  turning: 0,
}

const held = (stick: Stick): boolean => stick.x !== 0 || stick.y !== 0

/**
 * The player enters `view` this tick with `stick` held: the heading becomes the view's `yawDeg` when it sets one,
 * `rotate` is the view's, and a held stick latches the mapping to the heading before the entry (a latch already
 * held keeps its first heading). The first view entered never latches. The same view again changes nothing.
 */
export function enterView(state: HeadingState, view: CameraView, stick: Stick): HeadingState {
  if (view.id === state.view) return state
  const heading = view.yawDeg === undefined ? state.heading : degToHeading(view.yawDeg)
  const entered = { ...state, view: view.id, heading, rotate: view.rotate }
  if (state.view === '' || !held(stick)) return { ...entered, latched: false }
  if (state.latched) return entered
  return { ...entered, latched: true, latchHeading: state.heading, latchX: stick.x, latchY: stick.y }
}

/**
 * A `camera-turn` of `units` this tick: one 45° step in the direction of its sign, never more however far it was
 * dragged, and ignored in a view with `rotate: false`. The player turns the camera in eight steps (Q and R); there is no
 * turn the sim does on its own, so the controls stay camera-relative and a replay stays whole.
 *
 * Input is sampled every tick, so a key held down is a `camera-turn` every tick. A step is a press: the turn steps when
 * its direction is not the one it had last tick, and a tick with no turn lets go. Held, it does nothing more.
 */
export function turnCamera(state: HeadingState, units: number): HeadingState {
  const direction = turnDirection(units)
  if (!state.rotate) return state
  if (direction === state.turning) return state
  if (direction === 0) return { ...state, turning: 0 }
  return { ...state, heading: stepHeading(state.heading, direction), latched: false, turning: direction }
}

/**
 * A `camera-yaw` of `units` this tick: the free, analogue turn a game opts into (a right stick, a drag) in place of the
 * stepped `camera-turn`. The heading turns by the units themselves, at most `MAX_CAMERA_TURN` (45°) either way in one tick,
 * wrapped; a view with `rotate: false` ignores it, and no units change nothing. Like a stepped turn it lets go of the
 * view-change latch, since the player asked for the new heading; it leaves the stepped turn's `turning` alone.
 */
export function yawCamera(state: HeadingState, units: number): HeadingState {
  if (!state.rotate || units === 0) return state
  const by = Math.max(-MAX_CAMERA_TURN, Math.min(MAX_CAMERA_TURN, units))
  return { ...state, heading: turnHeading(state.heading, by), latched: false }
}

/**
 * This tick's move direction from `stick` (Q16.16, `mapStick`), through the latched heading while the latch holds,
 * and the state with the latch let go when the stick was released or turned past 90°.
 */
export function moveDirection(
  state: HeadingState,
  stick: Stick,
): { readonly state: HeadingState; readonly direction: Direction } {
  let next = state
  if (state.latched && (!held(stick) || stick.x * state.latchX + stick.y * state.latchY < 0))
    next = { ...state, latched: false }
  const heading = next.latched ? next.latchHeading : next.heading
  return { state: next, direction: mapStick(stick, heading) }
}
