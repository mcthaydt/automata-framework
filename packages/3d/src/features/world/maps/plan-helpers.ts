// What the two generators share: a seeded stream, picking from a list, and rounding to a build grid.
import { createRng } from '@automata/sim'

/** A function that gives the next number in [0, 1) of the stream `seed` starts. */
export function seeded(seed: number): () => number {
  const rng = createRng(seed)
  return () => rng.next()
}

/** One of `list`, chosen by the stream. */
export const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)] as T

/** `value` rounded to a multiple of `step` (the build grid, 5 cm). */
export const round = (value: number, step = 0.05): number => Math.round(value / step) * step
