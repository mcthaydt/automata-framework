// The DUEL palette as numbers and the snap to it: the nearest colour in OKLab, the first winning a tie. The painter and
// the look's per-texel snap share it, so a figure's texel and a tile's are snapped by one rule, and it runs on
// fdlibm's maths, so it is the same colour in every engine.
import { DUEL_RAMPS } from '@automata/content/palette'
import { hexToRgb, oklab } from './colour.ts'

const sq = (x: number): number => x * x

/** The DUEL ramps as numbers: 32 rows of 8, dark to light. */
export const RAMPS: readonly (readonly number[])[] = DUEL_RAMPS.map((row) => row.map(hexToRgb))
export const DUEL: {
  c: number
  lab: [number, number, number]
}[] = RAMPS.flat().map((c) => ({ c, lab: oklab(c) }))
const snapped = new Map<number, number>()
/** A colour's nearest DUEL colour. */
export function duel(rgb: number): number {
  let hit = snapped.get(rgb)
  if (hit !== undefined) return hit
  const [L, A, B] = oklab(rgb)
  let best = Infinity
  for (const d of DUEL) {
    const e = sq(d.lab[0] - L) + sq(d.lab[1] - A) + sq(d.lab[2] - B)
    if (e < best) {
      best = e
      hit = d.c
    }
  }
  snapped.set(rgb, hit!)
  return hit!
}
/** The nearest DUEL colour to an OKLab colour. */
export function duelLab(L: number, A: number, B: number): number {
  let best = Infinity,
    hit = 0
  for (const d of DUEL) {
    const e = sq(d.lab[0] - L) + sq(d.lab[1] - A) + sq(d.lab[2] - B)
    if (e < best) {
      best = e
      hit = d.c
    }
  }
  return hit
}
