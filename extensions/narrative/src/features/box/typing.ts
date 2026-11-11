// Typing a line out, apart from the drawing. A line with a delivery (a pace or pauses) is typed at the box's rate; a line
// with none is said plainly, all at once, as it always was. Under reduced motion everything shows at once. The seconds come
// from the caller's clock, so a replay (the sim's own clock, for a caption) and a test (an injected one) draw the same frames.
import { type Delivery, typed } from '../../shared/sim/delivery.ts'

/** Characters a second at pace 1. */
export const DEFAULT_RATE = 40

export interface TypedView {
  readonly shown: number
  readonly done: boolean
}

/** What a game may set on how lines are typed: its own clock (seconds), for tests and replays, and the rate. */
export interface TypingOptions {
  /** Seconds, from any steady clock; the page's own by default. */
  readonly clock?: (() => number) | undefined
  /** Characters a second at pace 1. */
  readonly rate?: number | undefined
}

/** Whether a delivery changes how a line is shown: a pace or a pause. A direction for the writer alone does not. */
export const isTyped = (delivery: Delivery | undefined): boolean =>
  delivery !== undefined && (delivery.pace !== undefined || (delivery.beats?.length ?? 0) > 0)

/** What of `words` to show `seconds` into the line. */
export function typedFor(
  words: string,
  delivery: Delivery | undefined,
  seconds: number,
  options: { readonly rate?: number | undefined; readonly reducedMotion: boolean },
): TypedView {
  if (!isTyped(delivery) || options.reducedMotion) return { shown: words.length, done: true }
  return typed(words, delivery, seconds, options.rate ?? DEFAULT_RATE)
}

/** Whether the player asked their system for less motion. */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
