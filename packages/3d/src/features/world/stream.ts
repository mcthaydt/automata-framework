// A seeded stream of numbers in [0, 1): every generator's variety (a book's colour, a leaf's lump, a made-up shop
// name) comes from one, so a level draws the same every run. AF's own seeded generator under a function, because the
// generators were written to call one.
import { createRng } from '@automata/sim'

/** A function that gives the next number in [0, 1) of the stream `seed` starts. */
export function stream(seed: number): () => number {
  const rng = createRng(seed)
  return () => rng.next()
}
