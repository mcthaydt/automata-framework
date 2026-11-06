// A seeded generator for property tests and fixtures: integer arithmetic only (mulberry32), so a run produces the same
// values on every engine and every time, and a failing seed can be replayed.

export interface Random {
  /** The next unsigned 32-bit integer. */
  next(): number
  /** A whole number from 0 up to but not including `bound`. */
  int(bound: number): number
  /** One of the items. */
  pick<T>(items: readonly T[]): T
}

export function seededRandom(seed: number): Random {
  let state = seed | 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) >>> 0
  }
  return {
    next,
    int: (bound) => next() % bound,
    pick: (items) => items[next() % items.length] as (typeof items)[number],
  }
}
