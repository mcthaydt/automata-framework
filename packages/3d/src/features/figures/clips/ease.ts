// Eases (M3 spec §4.4.4 `Ease`): how a segment between two keys runs. `in`, `out` and `inOut` are CSS's
// ease-in, ease-out and ease-in-out; a tuple is a CSS cubic-bezier(x1, y1, x2, y2), whose x1 and x2 the
// schema keeps in [0, 1] so the curve's x rises and has one solution; `step` holds the previous key.

import type { Ease } from './clip.schema.ts'

type Curve = readonly [number, number, number, number]
const NAMED: Readonly<Record<'in' | 'out' | 'inOut', Curve>> = {
  in: [0.42, 0, 1, 1],
  out: [0, 0, 0.58, 1],
  inOut: [0.42, 0, 0.58, 1],
}

/** One axis of the curve from (0, 0) to (1, 1) with control values p1 and p2, at parameter s. */
const bezier = (p1: number, p2: number, s: number): number =>
  3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s
const slope = (p1: number, p2: number, s: number): number =>
  3 * (1 - s) * (1 - s) * p1 + 6 * (1 - s) * s * (p2 - p1) + 3 * s * s * (1 - p2)

/** The curve's y where its x is `x`: Newton's method from s = x, falling back to bisection, to 1e-9. */
function cubic([x1, y1, x2, y2]: Curve, x: number): number {
  let s = x
  for (let i = 0; i < 8; i++) {
    const error = bezier(x1, x2, s) - x
    if (Math.abs(error) < 1e-12) return bezier(y1, y2, s)
    const d = slope(x1, x2, s)
    if (Math.abs(d) < 1e-9) break
    s -= error / d
  }
  // Newton stalled on a flat stretch, or left [0, 1]: bisect on s until the interval is 1e-12 wide (stopping on
  // x's error instead would leave y far off where x is flat), which the rising x always allows.
  let lo = 0
  let hi = 1
  while (hi - lo > 1e-12) {
    s = (lo + hi) / 2
    if (bezier(x1, x2, s) < x) lo = s
    else hi = s
  }
  s = (lo + hi) / 2
  return bezier(y1, y2, s)
}

/** The eased fraction of a segment at fraction `u` (clamped to [0, 1]); linear when `ease` is left out. */
export function easeAt(ease: Ease | undefined, u: number): number {
  if (u <= 0) return 0
  if (u >= 1) return 1
  if (ease === undefined || ease === 'linear') return u
  if (ease === 'step') return 0
  return cubic(typeof ease === 'string' ? NAMED[ease] : ease, u)
}
