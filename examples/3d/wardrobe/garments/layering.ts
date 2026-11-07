// Layering: a trouser cut and what it puts round the body, and a top grown round what it goes on over. A
// top's shell is widened (and, as far as its folds need, deepened) until it clears every trouser cut in the
// outfit and every top put on under it by a texel's ease a layer, so a long top hangs over the widest
// trousers with its hem clear of them.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246 (`legAt`,
// `GAP`, `Legs`, `legSection`, `legOuter`, `fitLegs`, `seatOf`, `bandOf`, `Outline`, `ringOf`, `sliceOf`,
// `trouserOutline`, `underneath`, `over`), with AF's strict types; the formulas and their order are the
// source's.

import type { Garment, Legs, Measure, Superquadric } from '@automata/3d/figures-kit'
import {
  at,
  clamp,
  GARMENTS,
  garmentOf,
  lerp,
  SIDES,
  type Skeleton,
  sgnPow,
  smooth,
} from '@automata/3d/figures-kit'
import type { Section, Shell } from './loft.ts'
import { type Under, under } from './under.ts'

// The contract type is core's (figures-kit); re-exported so a builder imports it with the helpers.
export type { Legs }

/** The trouser legs' inseam gap (m at 1.62 m). */
const GAP = 0.012
/**
 * Where a trouser leg's centre sits off the figure's middle: its inseam `gap` from it, so the legs part below
 * the seat.
 */
export const legAt = (k: number, r: number): number => GAP * k + r

/** A trouser leg's section at t on its side (x ±1), narrowing into the seat at the top; its centre out by its
 * fullest round, folds and all, so below the seat the legs part. */
export const legSection =
  (k: number, legs: Legs) =>
  (x: number, t: number): Section => {
    const y = lerp(legs.top, legs.hem, t)
    const r = legs.radius(t)
    const into = lerp(0.55, 1, smooth((legs.top - y) / (0.16 * k)))
    return {
      c: [x * legAt(k, r * (1 + (legs.folds ?? 0))), 0.004 * k],
      r: [r * into, r * 1.04 * into],
      e: 0.92,
    }
  }
/** How far out a trouser leg reaches at its top (its fullest round, folds and all, past the inseam's gap). */
const legOuter = (k: number, legs: Legs) => {
  const r = legs.radius(0)
  return legAt(k, r * (1 + (legs.folds ?? 0))) + r
}
/** A cut fitted to the body: each leg's top at least as full as the hip over it, so the cloth falls plumb
 * from the widest hip, never in past it. */
export function fitLegs(b: Under, legs: Legs): Legs {
  const { k } = b
  const fill = (b.hip + 0.012 * k - GAP * k) / (2 + (legs.folds ?? 0))
  return { ...legs, radius: (t) => Math.max(legs.radius(t), lerp(fill, 0, smooth(t / 0.3))) }
}
/**
 * The trousers' seat: on the pelvis, as wide as the legs' tops under it, as deep as the body's seat and no
 * deeper.
 */
export const seatOf = (b: Under, k: number, legs: Legs): Superquadric => ({
  at: [0, b.pelvisY - 0.045 * k, -0.004 * k],
  r: [legOuter(k, legs), 0.105 * k, b.seat + 0.004 * k],
  taper: [0.96, 0.94],
  e: [0.75, 0.8],
})
/** The waistband's section down it (t 0 its top), flaring a little toward the seat. */
export const bandOf =
  (b: Under, k: number) =>
  (t: number): Section => ({
    c: [0, -0.004 * k],
    r: [
      lerp(b.waist, b.hips, 0.25 + 0.2 * t) + 0.012 * k,
      lerp(b.waistDepth, b.seat, 0.35 + 0.2 * t) + 0.01 * k,
    ],
    e: 0.85,
  })

/** What a garment puts round the body at height y (rest figure space), as points round its sections, `ease`
 * out from each: for one worn over it to clear. */
type Outline = (y: number, ease: number) => (readonly [number, number])[]
/** Points round a section (its folds' fullest `bump` allowed), `ease` out from it. */
const ringOf = (sec: Section, ease: number, bump = 0, n = 24) =>
  Array.from({ length: n }, (_, i) => {
    const v = (2 * Math.PI * i) / n
    const e = sec.e ?? 1
    return [
      sec.c[0] + sgnPow(Math.cos(v), e) * (sec.r[0] * (1 + bump) + ease),
      sec.c[1] + sgnPow(Math.sin(v), e) * (sec.r[1] * (1 + bump) + ease),
    ] as const
  })
/** A superquadric's level slice at height y (a seat's), as points. */
export function sliceOf(q: Superquadric, y: number, ease: number, n = 24): (readonly [number, number])[] {
  const [rx, ry, rz] = q.r
  const [e1, e2] = q.e ?? [1, 1]
  const [t0, t1] = q.taper ?? [1, 1]
  const u = (y - q.at[1]) / ry
  if (Math.abs(u) >= 1) return []
  const ring = (1 - Math.abs(u) ** (2 / e1)) ** (e1 / 2)
  const tk = lerp(t0, t1, (u + 1) / 2)
  return ringOf({ c: [q.at[0], q.at[2]], r: [ring * rx * tk, ring * rz * tk], e: e2 }, ease, 0, n)
}
/** A trouser cut's outline under a top ending at `hem`: its seat and both its legs, and its waistband if the
 * top runs on past it (a cropped top ends on the band, which shows under it). */
function trouserOutline(m: Measure, s: Skeleton, legs: Legs, hem: number): Outline {
  const b = under(m, s)
  const { k } = b
  const seat = seatOf(b, k, legs)
  const waistY = s.hipY + 0.12 * k
  const band = bandOf(b, k)
  const leg = legSection(k, legs)
  const banded = hem < waistY - 0.016 * k
  return (y, ease) => {
    const out = sliceOf(seat, y, ease)
    const w = (waistY + 0.016 * k - y) / (0.032 * k)
    const t = (legs.top - y) / (legs.top - legs.hem)
    // The band rides the pelvis alone, so a top over it (on the spine too) allows it another texel for the
    // lean.
    if (banded && w >= 0 && w <= 1) out.push(...ringOf(band(w), ease + 0.008 * k))
    if (t >= 0 && t <= 1) for (const [, x] of SIDES) out.push(...ringOf(leg(x, t), ease))
    return out
  }
}
/** What a top ending at `hem` goes on over: every trouser cut in the outfit (a top hangs outside the
 * waistband), and how many tops are put on under it (each layer out takes another texel's ease). */
export function underneath(
  m: Measure,
  s: Skeleton,
  item: Garment,
  garments: readonly Garment[],
  hem: number,
): { outlines: Outline[]; layer: number } {
  const index = garments.indexOf(item)
  const outlines: Outline[] = []
  let layer = 0
  garments.forEach((g, i) => {
    const kind = garmentOf(g)
    const entry = kind ? GARMENTS[kind] : undefined
    if (entry?.cut) outlines.push(trouserOutline(m, s, entry.cut(m, s, g), hem))
    else if (i < index && entry?.top) layer++
  })
  return { outlines, layer }
}
/**
 * A top's shell grown round what it goes on over (`under`, a texel's ease out from each), its own folds
 * allowed for: deeper only as far as their fronts and backs need, then wider, the growth only ever flaring
 * toward the hem. Where nothing under it reaches it, it is unchanged. A box (from `box`, its armpits, down)
 * hangs straight from there.
 */
export function over(
  m: Measure,
  sh: Shell,
  { outlines, layer }: { outlines: Outline[]; layer: number },
  box?: number,
): Shell {
  const ease = 0.008 * m.k * (1 + layer)
  if (!outlines.length) return sh
  // The scales (across, deep) that take the section round every point under it, each against the shell's own
  // fold at its angle: the width each depth scale leaves it needing, and the pair that adds the least. A box
  // grows deeper by a tenth at most, and the rest across, so its volume reads in its width as a boxy tee's
  // does.
  const need = (t: number): [number, number] => {
    const sec = sh.section(t)
    const e = sec.e ?? 1
    const y = lerp(sh.from, sh.to, t)
    const pts = outlines.flatMap((o) => o(y, ease))
    const scaled = pts.map(([px, pz]) => {
      const dx = px - sec.c[0]
      const dz = pz - sec.c[1]
      const f =
        1 + (sh.bump?.(t, Math.atan2(sgnPow(dz / sec.r[1], 1 / e), sgnPow(dx / sec.r[0], 1 / e))) ?? 0)
      return [Math.abs(dx) / (sec.r[0] * f), Math.abs(dz) / (sec.r[1] * f)] as const
    })
    let best: [number, number] = [Infinity, 1]
    let boxed: [number, number] = [Infinity, 1]
    for (let gz = 1; gz < 1.6; gz += 0.02) {
      let gx = 1
      for (const [ux, uz] of scaled) {
        const dz = uz / gz
        gx = Math.max(gx, dz >= 1 ? Infinity : ux / (1 - dz ** (2 / e)) ** (e / 2))
      }
      if (gx * gz < best[0] * best[1]) best = [gx, gz]
      if (gz <= 1.1 && gx * gz < boxed[0] * boxed[1]) boxed = [gx, gz]
    }
    return box !== undefined && boxed[0] < Infinity ? boxed : best
  }
  // Down the shell, the most it has needed so far; a box the most it needs anywhere, so it hangs straight
  // from there.
  const n = 40
  const grow: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const [gx, gz] = need(i / n)
    const last = grow[i - 1] ?? [1, 1]
    grow.push([Math.max(last[0], gx), Math.max(last[1], gz)])
  }
  const most = at(grow, n)
  if (most[0] <= 1 && most[1] <= 1) return sh
  if (box !== undefined)
    for (let i = 0; i <= n; i++) {
      const u = smooth((i / n - box) / 0.12)
      grow[i] = [lerp(1, most[0], u), lerp(1, most[1], u)]
    }
  return {
    ...sh,
    section: (t) => {
      const sec = sh.section(t)
      const u = clamp(t, 0, 1) * n
      const i = Math.min(n - 1, Math.floor(u))
      const g0 = at(grow, i)
      const g1 = at(grow, i + 1)
      return { ...sec, r: [sec.r[0] * lerp(g0[0], g1[0], u - i), sec.r[1] * lerp(g0[1], g1[1], u - i)] }
    },
  }
}
