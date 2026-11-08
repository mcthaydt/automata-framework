import type { DragGesture, HoverGesture, WheelGesture } from './gesture-events'
import type { PointerKind, PointerSample, WheelInput } from './pointer-sample'

// The gesture events a single pointer sample becomes. Pure field copies and arithmetic, kept out of the recognizer so it
// holds only the rules (slop, timings, tap counting, palm rejection).

/** The part of a press a drag event reports. */
export interface DragOrigin {
  readonly startX: number
  readonly startY: number
  readonly kind: PointerKind
  readonly button: number
}

export const dragGesture = (
  sample: PointerSample,
  origin: DragOrigin,
  dx: number,
  dy: number,
): DragGesture => ({
  x: sample.x,
  y: sample.y,
  startX: origin.startX,
  startY: origin.startY,
  dx,
  dy,
  pressure: sample.pressure,
  tiltX: sample.tiltX,
  tiltY: sample.tiltY,
  pointerType: origin.kind,
  button: origin.button,
  modifiers: sample.modifiers,
})

export const hoverGesture = (sample: PointerSample): HoverGesture => ({
  x: sample.x,
  y: sample.y,
  pointerType: sample.kind,
  pressure: sample.pressure,
  tiltX: sample.tiltX,
  tiltY: sample.tiltY,
  modifiers: sample.modifiers,
})

// Ctrl or Meta plus the wheel zooms about the pointer (a trackpad pinch sends that); any other step pans.

/** A zoom step never counts for more than this many wheel pixels, so a notched mouse wheel is not a lurch. */
const WHEEL_STEP_LIMIT = 100
/** Wheel pixels that double the zoom. */
const WHEEL_PIXELS_PER_DOUBLING = 200

export function wheelGesture(input: WheelInput): WheelGesture {
  const zoom = input.modifiers.ctrl || input.modifiers.meta
  const step = Math.max(-WHEEL_STEP_LIMIT, Math.min(WHEEL_STEP_LIMIT, input.deltaY))
  return {
    mode: zoom ? 'zoom' : 'pan',
    x: input.x,
    y: input.y,
    dx: zoom ? 0 : -input.deltaX,
    dy: zoom ? 0 : -input.deltaY,
    scale: zoom ? 2 ** (-step / WHEEL_PIXELS_PER_DOUBLING) : 1,
    modifiers: input.modifiers,
  }
}
