import { atan2, hypot } from '@automata/sim/math'
import { oklab } from '../../../shared/math/colour.ts'
import { hypot3 } from './vec.ts'

/** A figure's colours: about two dozen, each with a job. */
const PALETTE = 24,
  MERGE = 0.035,
  MINOR = [0.075, 0.1, 12] as const
/**
 * The colour budget, as a pixel artist keeps one: a colour on fewer than 2·D² texels of a larger surface (a fleck of a
 * fourth shadow) takes the nearest colour round it on that surface that has its place, and while the figure has more
 * than `PALETTE` colours the closest pair painted on one material (ΔE under `MERGE`) merge, the rarer into the
 * commoner. The face's own marks (eyes, brows, lips), a gloss's shine and a hologram's ramp (`kept`) are its accents,
 * and stay.
 */
export function budget(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  D: number,
  kept: Uint8Array,
  mat: (k: number) => number,
): void {
  const n = w * h,
    col = new Int32Array(n).fill(-1),
    count = new Map<number, number>()
  for (let k = 0; k < n; k++)
    if (out[k * 4 + 3] ?? Number.NaN) {
      const c =
        ((out[k * 4] ?? Number.NaN) << 16) |
        ((out[k * 4 + 1] ?? Number.NaN) << 8) |
        (out[k * 4 + 2] ?? Number.NaN)
      col[k] = c
      count.set(c, (count.get(c) ?? 0) + 1)
    }
  const size = new Map<number, number>()
  for (let k = 0; k < n; k++) if ((col[k] ?? Number.NaN) >= 0) size.set(mat(k), (size.get(mat(k)) ?? 0) + 1)
  const floor = 2 * D * D,
    dist = (a: number, b: number) => {
      const p = oklab(a),
        q = oklab(b)
      return hypot3(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }
  const to = new Int32Array(n).fill(-1)
  for (let k = 0; k < n; k++) {
    const c = col[k] ?? Number.NaN,
      m = mat(k)
    if (c < 0 || (kept[k] ?? Number.NaN) || count.get(c)! >= floor || size.get(m)! < floor) continue
    const x = k % w,
      y = (k - x) / w
    let best = -1,
      bd = Infinity
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const q = col[yy * w + xx] ?? Number.NaN
        if (q < 0 || q === c || count.get(q)! < floor || mat(yy * w + xx) !== m) continue
        const d = dist(c, q)
        if (d < bd) {
          bd = d
          best = q
        }
      }
    if (best >= 0) to[k] = best
  }
  for (let k = 0; k < n; k++)
    if ((to[k] ?? Number.NaN) >= 0) {
      count.set(col[k] ?? Number.NaN, count.get(col[k] ?? Number.NaN)! - 1)
      col[k] = to[k] ?? Number.NaN
      count.set(to[k] ?? Number.NaN, count.get(to[k] ?? Number.NaN)! + 1)
    }
  for (const [c, m] of count) if (!m) count.delete(c)
  // Then a colour still on fewer than 2·D² texels of the whole figure, whatever it is painted on (a buckle's grey, a
  // seam's fleck), is the nearest colour round it that has its place, within a step (ΔE 0.15): no colour is a speck.
  to.fill(-1)
  for (let k = 0; k < n; k++) {
    const c = col[k] ?? Number.NaN
    if (c < 0 || (kept[k] ?? Number.NaN) || count.get(c)! >= floor) continue
    const x = k % w,
      y = (k - x) / w
    let best = -1,
      bd = 0.15
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const q = col[yy * w + xx] ?? Number.NaN
        if (q < 0 || q === c || count.get(q)! < floor) continue
        const d = dist(c, q)
        if (d < bd) {
          bd = d
          best = q
        }
      }
    if (best >= 0) to[k] = best
  }
  for (let k = 0; k < n; k++)
    if ((to[k] ?? Number.NaN) >= 0) {
      count.set(col[k] ?? Number.NaN, count.get(col[k] ?? Number.NaN)! - 1)
      col[k] = to[k] ?? Number.NaN
      count.set(to[k] ?? Number.NaN, count.get(to[k] ?? Number.NaN)! + 1)
    }
  for (const [c, m] of count) if (!m) count.delete(c)
  // The pairs: colours painted on one material, close enough to be one step; and any two the eye cannot part (within
  // `MERGE / 1.2`, two near-blacks of two cloths), whatever they are painted on.
  const on = new Map<number, Set<number>>()
  for (let k = 0; k < n; k++)
    if ((col[k] ?? Number.NaN) >= 0 && !(kept[k] ?? Number.NaN)) {
      const m = mat(k)
      let s = on.get(m)
      if (!s) {
        s = new Set()
        on.set(m, s)
      }
      s.add(col[k] ?? Number.NaN)
    }
  const pairs: [number, number, number][] = []
  for (const s of on.values()) {
    const cs = [...s]
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const d = dist(cs[i] ?? Number.NaN, cs[j] ?? Number.NaN)
        if (d < MERGE) pairs.push([d, cs[i] ?? Number.NaN, cs[j] ?? Number.NaN])
      }
  }
  {
    const cs = [...new Set([...on.values()].flatMap((s) => [...s]))]
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const d = dist(cs[i] ?? Number.NaN, cs[j] ?? Number.NaN)
        if (d < MERGE / 1.2) pairs.push([d, cs[i] ?? Number.NaN, cs[j] ?? Number.NaN])
      }
  }
  pairs.sort((a, b) => a[0] - b[0])
  const into = new Map<number, number>(),
    root = (c: number): number => {
      const r = into.get(c)
      return r === undefined ? c : root(r)
    }
  let colours = count.size
  for (const [, a0, b0] of pairs) {
    if (colours <= PALETTE) break
    const a = root(a0),
      b = root(b0)
    if (a === b) continue
    const [keep, drop] = count.get(a)! >= count.get(b)! ? [a, b] : [b, a]
    into.set(drop, keep)
    count.set(keep, count.get(keep)! + count.get(drop)!)
    count.delete(drop)
    colours--
  }
  // Still over: a minor tone (under `MINOR[1]` of each material it is painted on, or on small parts only, under
  // `MINOR[2]·D²` texels: a wash's second step, a deep's sliver, a pocket's facing, a chain's fourth grey) joins the
  // nearest colour of the figure within `MINOR[0]`, so the form's own steps (each material's main tones) stay.
  if (colours > PALETTE) {
    const by = new Map<number, Map<number, number>>(),
      mats = new Map<number, Set<number>>()
    for (let k = 0; k < n; k++)
      if ((col[k] ?? Number.NaN) >= 0 && !(kept[k] ?? Number.NaN)) {
        const m = mat(k),
          c = root(col[k] ?? Number.NaN)
        let t = by.get(m)
        if (!t) {
          t = new Map()
          by.set(m, t)
        }
        t.set(c, (t.get(c) ?? 0) + 1)
        let s = mats.get(c)
        if (!s) {
          s = new Set()
          mats.set(c, s)
        }
        s.add(m)
      }
    /** Of one family: both near-grey, or of hues within 12° and like chroma (a pocket facing may be the jeans' shadow,
     * never a puffer's blue the jeans' violet, nor a buckle's gold the skin's light). */
    const alike = (a: number, b: number) => {
      const p = oklab(a),
        q = oklab(b),
        ca = hypot(p[1], p[2]),
        cb = hypot(q[1], q[2])
      if (ca < 0.035 && cb < 0.035) return true
      const dh = Math.abs(atan2(p[2], p[1]) - atan2(q[2], q[1]))
      return Math.min(dh, 2 * Math.PI - dh) < 0.21 && Math.min(ca, cb) > 0.6 * Math.max(ca, cb)
    }
    const minor = (c: number) =>
      [...(mats.get(c) ?? [])].every(
        (m) => (by.get(m)!.get(c) ?? 0) < MINOR[1] * size.get(m)! || size.get(m)! < MINOR[2] * D * D,
      )
    const near: [number, number, number][] = []
    {
      const cs = [...mats.keys()]
      for (let i = 0; i < cs.length; i++)
        for (let j = i + 1; j < cs.length; j++) {
          const d = dist(cs[i] ?? Number.NaN, cs[j] ?? Number.NaN)
          if (
            d < MINOR[0] &&
            (minor(cs[i] ?? Number.NaN) || minor(cs[j] ?? Number.NaN)) &&
            alike(cs[i] ?? Number.NaN, cs[j] ?? Number.NaN)
          )
            near.push([d, cs[i] ?? Number.NaN, cs[j] ?? Number.NaN])
        }
    }
    near.sort((a, b) => a[0] - b[0])
    for (const [, a0, b0] of near) {
      if (colours <= PALETTE) break
      const a = root(a0),
        b = root(b0)
      if (a === b || !count.has(a) || !count.has(b)) continue
      const drop = minor(a) && (!minor(b) || count.get(a)! <= count.get(b)!) ? a : minor(b) ? b : -1
      if (drop < 0) continue
      const keep = drop === a ? b : a
      into.set(drop, keep)
      count.set(keep, count.get(keep)! + count.get(drop)!)
      count.delete(drop)
      colours--
      for (const m of mats.get(drop) ?? []) {
        const t = by.get(m)!
        t.set(keep, (t.get(keep) ?? 0) + (t.get(drop) ?? 0))
        t.delete(drop)
        mats.get(keep)?.add(m) ?? mats.set(keep, new Set([m]))
      }
      mats.delete(drop)
    }
  }
  for (let k = 0; k < n; k++) {
    if ((col[k] ?? Number.NaN) < 0) continue
    const c = (kept[k] ?? Number.NaN) ? (col[k] ?? Number.NaN) : root(col[k] ?? Number.NaN)
    out[k * 4] = (c >> 16) & 255
    out[k * 4 + 1] = (c >> 8) & 255
    out[k * 4 + 2] = c & 255
  }
}
