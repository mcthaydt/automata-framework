import { RAMPS } from './duel-ramps'
/**
 * Where a DUEL colour sits on the rows, and a fabric's tile laid on it: a colour moved whole steps along its own row.
 * The painter lays a tile after its tone bands, its colour budget and the light hook, and the lighting after the lamps,
 * both through `tiled`, so a hatch and its ground can never part (fabric.ts, H5).
 */
const placeOf = new Map<number, [number, number]>()
/** Where a DUEL colour sits on the rows (its row and step), cached. */
export function onRow(c: number): [number, number] {
  let hit = placeOf.get(c)
  if (hit) return hit
  let best = Infinity
  RAMPS.forEach((row, r) =>
    row.forEach((x, i) => {
      const d =
        ((x >> 16) - (c >> 16)) ** 2 +
        (((x >> 8) & 255) - ((c >> 8) & 255)) ** 2 +
        ((x & 255) - (c & 255)) ** 2
      if (d < best) {
        best = d
        hit = [r, i]
      }
    }),
  )
  placeOf.set(c, hit!)
  return hit!
}
/**
 * The step a tile's `label` puts a ground at, on a row of steps 1…7. A fabric has `lo` and `hi`, its lowest and highest
 * label (0 included): a ground is first held to `1 − lo … 7 − hi`, so the tile's full contrast stays at the row's ends
 * (the lift), then the label is added. Step 0, a row's darkest (ink, the painter's family darks), takes no tile and no
 * lift: it holds, as the lighting's floor does.
 */
export const tiledStep = (step: number, label: number, lo: number, hi: number): number =>
  step === 0 ? 0 : Math.max(1 - lo, Math.min(7 - hi, step)) + label
/** The DUEL colour a tile's `label` makes of ground colour `c`, along `c`'s own row. */
export function tiled(c: number, label: number, lo: number, hi: number): number {
  const [row, step] = onRow(c)
  return step === 0 ? c : RAMPS[row][tiledStep(step, label, lo, hi)]
}
