import type { GestureHandlers } from '../../shared/kit/gestures/gesture-events'
import {
  type Modifiers,
  NO_MODIFIERS,
  type PointerKind,
  type PointerSample,
} from '../../shared/kit/gestures/pointer-sample'

// Fixtures for the gesture tests (kit spec §8, `FakePointer`): samples for each pointer kind and a handler set that
// records what the recognizer fired, in order.

export interface SampleExtras {
  readonly pressure?: number
  readonly tiltX?: number
  readonly tiltY?: number
  readonly button?: number
  readonly modifiers?: Modifiers
}

export function sample(
  kind: PointerKind,
  id: number,
  x: number,
  y: number,
  extras: SampleExtras = {},
): PointerSample {
  return {
    id,
    kind,
    x,
    y,
    pressure: extras.pressure ?? (kind === 'pen' ? 0.5 : 0),
    tiltX: extras.tiltX ?? 0,
    tiltY: extras.tiltY ?? 0,
    button: extras.button ?? 0,
    modifiers: extras.modifiers ?? NO_MODIFIERS,
  }
}

export const touch = (id: number, x: number, y: number, extras?: SampleExtras): PointerSample =>
  sample('touch', id, x, y, extras)
export const pen = (id: number, x: number, y: number, extras?: SampleExtras): PointerSample =>
  sample('pen', id, x, y, extras)
export const mouse = (x: number, y: number, extras?: SampleExtras): PointerSample =>
  sample('mouse', 1, x, y, extras)

export interface Fired {
  readonly type: keyof GestureHandlers
  readonly event: unknown
}

export interface GestureLog {
  readonly handlers: GestureHandlers
  readonly fired: Fired[]
  /** The events of one type, in order. */
  of<T = Record<string, unknown>>(type: keyof GestureHandlers): T[]
  /** The types fired, in order. */
  types(): string[]
}

const EVENT_TYPES: readonly (keyof GestureHandlers)[] = [
  'tap',
  'doubleTap',
  'longPress',
  'dragStart',
  'drag',
  'dragEnd',
  'pan',
  'pinch',
  'multiTap',
  'hover',
  'wheel',
]

/** Handlers for every event that push into one ordered log. */
export function logGestures(): GestureLog {
  const fired: Fired[] = []
  const handlers: Record<string, (event: unknown) => void> = {}
  for (const type of EVENT_TYPES) handlers[type] = (event) => fired.push({ type, event })
  return {
    handlers: handlers as GestureHandlers,
    fired,
    of: <T>(type: keyof GestureHandlers): T[] =>
      fired.filter((entry) => entry.type === type).map((entry) => entry.event as T),
    types: () => fired.map((entry) => entry.type),
  }
}
