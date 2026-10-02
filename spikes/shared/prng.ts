/** mulberry32: 32-bit integer ops only (Math.imul, >>>, ^), so it is bit-exact in every engine. */
export function mulberry32(seed: number): () => number {
  const state = { s: seed >>> 0 }
  return () => nextRand(state)
}

/** Same generator with explicit, serializable state (for snapshots). */
export function nextRand(state: { s: number }): number {
  state.s = (state.s + 0x6d2b79f5) >>> 0
  let t = state.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
