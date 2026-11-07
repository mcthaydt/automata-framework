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
import { clampTurn, degToHeading, turnHeading } from './heading.ts'
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

/** A `camera-turn` of `units`: clamped to ±8,192, wrapped, and ignored in a view with `rotate: false`. */
export function turnCamera(state: HeadingState, units: number): HeadingState {
  const by = clampTurn(units)
  if (!state.rotate || by === 0) return state
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
