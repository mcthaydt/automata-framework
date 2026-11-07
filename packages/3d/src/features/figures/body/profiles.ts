// The body under the clothes, as profiles: the ring lists that sweep into the torso, the neck, each arm and each leg,
// and a query on them (`ringAt`) that says how wide the body is at a height, fat, bust and seat included. The
// body is built from these very lists (outfit/garments/body.ts), and a garment can size itself from the answer
// instead of from `k * t` constants, so it clears any body the sliders make.
//
// Ported from FigureBuilder (mcthaydt/FigureBuilder) src/features/outfit/fit.ts at 025ffb4 (`TRAPEZIUS`, `fatten`,
// `profiles`, `ringAt`, `girth`, `clearance`, `Body`, `bodyOf`; the density is the fixed FIGURE_PPM), with AF's strict types;
// the numbers and their order are the source's.

import { lerp } from '../../../shared/math/math.ts'
import type { Measure } from './genes.ts'
import { type Limb, profileAt, type Ring } from './limb.ts'
import { J, type Side, type Skeleton } from './rig.ts'
import { FIGURE_PPM } from './texels.ts'

/** The trapezius's slope (rad): the body's shoulder line runs up it to the neck. */
export const TRAPEZIUS = 0.6

/** Fat's fullness: each ring grown by its own class (genes.ts `Measure.fat`), its placement unchanged. A class of exactly 1 (fat 0) leaves the ring as it was. */
const fatten = (rings: Ring[], by: number[]): Ring[] =>
  rings.map((r, i) => ({ ...r, rx: r.rx * (by[i] ?? 1), rz: r.rz * (by[i] ?? 1) }))

export interface Profiles {
  readonly torso: Limb
  readonly arm: Readonly<Record<Side, Limb>>
  readonly leg: Readonly<Record<Side, Limb>>
  readonly neck: Limb
}
/** The regions a garment may ask about: the trunk and each arm and leg (in figure space) and the neck (in its bone's space, as it is swept). */
export type Region = 'torso' | 'arm' | 'leg' | 'neck'

/** The profiles of the body the measure makes on this rig. */
export function profiles(m: Measure, s: Skeleton): Profiles {
  const g = s.genes
  const k = m.k
  const t = m.thick
  const fat = m.fat
  const f = m.sliders.frame
  const mu = lerp(0.92, 1.1, m.sliders.muscle)
  const D = k * t * m.depth
  const a = k * t * m.arm * mu * lerp(1.04, 0.94, f)
  const l = k * t * m.leg * lerp(0.96, 1.04, f)
  const sh = g.shoulders
  const C = m.chest
  const hipY = s.hipY
  const waistY = hipY + 0.155 * k
  const chestY = s.chestY
  const shoulderY = s.shoulderY
  const neck = lerp(0.85, 1.15, m.sliders.neck) * lerp(1.05, 0.95, f)
  // The trapezius: from the shoulder's top ring a straight slope in to the neck's root, standing either side of it,
  // so the line from the neck to the shoulder point falls as a muscle does rather than squaring off.
  const trap = sh * 0.42
  const trapY = shoulderY - 0.016 * k + Math.tan(TRAPEZIUS) * (sh * 0.84 - trap)
  const torso: Limb = {
    e: 0.82,
    seg: 20,
    caps: [0.02 * k, 0.03 * k],
    round: [0.3, 1],
    rings: [
      { y: trapY, rx: trap, rz: 0.058 * D, dz: -0.008 * k },
      {
        y: lerp(trapY, shoulderY - 0.016 * k, 0.55),
        rx: lerp(trap, sh * 0.84, 0.55) * 1.02,
        rz: 0.064 * D,
        dz: -0.006 * k,
      },
      { y: shoulderY - 0.016 * k, rx: sh * 0.84, rz: 0.07 * D, dz: -0.004 * k },
      { y: shoulderY - 0.05 * k, rx: sh * 0.9 * C, rz: 0.088 * D, dz: 0.004 * k },
      {
        y: chestY + 0.03 * k,
        rx: sh * lerp(0.9, 0.84, f) * C,
        rz: 0.096 * D * lerp(1, 1.06, f) * m.bust.rz,
        dz: 0.012 * k + m.bust.dz * k,
      },
      {
        y: chestY - 0.07 * k,
        rx: sh * lerp(0.8, 0.74, f) * C,
        rz: 0.088 * D * (1 + (m.bust.rz - 1) / 2),
        dz: 0.008 * k,
      },
      { y: waistY + 0.02 * k, rx: 0.11 * k * t * m.waist * lerp(1, 0.98, f), rz: 0.076 * D, dz: 0.002 * k },
      {
        y: hipY + 0.08 * k,
        rx: (g.hips + 0.05 * k * t * lerp(0.95, 1.06, f)) * m.seat.rx,
        rz: 0.084 * D * m.seat.rz,
        dz: -0.002 * k + m.seat.dz * k,
      },
      {
        y: hipY - 0.02 * k,
        rx: (g.hips + 0.062 * k * t * lerp(0.95, 1.06, f)) * m.seat.rx,
        rz: 0.088 * D * m.seat.rz,
        dz: -0.006 * k + m.seat.dz * k,
      },
      {
        y: hipY - 0.075 * k,
        rx: g.hips * 1.02 * m.seat.rx,
        rz: 0.074 * D * m.seat.rz,
        dz: -0.006 * k + m.seat.dz * k,
      },
    ],
  }
  const neckLimb: Limb = {
    seg: 12,
    caps: [0.02 * k, 0.02 * k],
    rings: fatten(
      [
        { y: g.neck + 0.04 * k, rx: 0.042 * k * neck, rz: 0.048 * k * neck, dz: 0.012 * k },
        { y: g.neck * 0.6, rx: 0.044 * k * neck, rz: 0.049 * k * neck, dz: 0.006 * k },
        { y: g.neck * 0.1, rx: 0.051 * k * neck, rz: 0.051 * k * neck, dz: -0.002 * k },
        { y: -0.04 * k, rx: 0.068 * k * neck, rz: 0.056 * k * neck, dz: -0.01 * k },
      ],
      [fat.neck, fat.neck, fat.neck, fat.neck],
    ),
  }
  const side = (name: Side, x: 1 | -1): { arm: Limb; leg: Limb } => {
    const ay = s.rest[J[`upperArm.${name}`]]?.[1] ?? 0
    const ax = x * sh
    const U = s.upperArm
    const F = s.foreArm
    const elbow = ay - U
    const wrist = ay - g.arms
    const arm: Limb = {
      seg: 14,
      caps: [0.028 * k, 0.012 * k],
      rings: fatten(
        [
          { y: ay - 0.012 * k, rx: 0.044 * a, rz: 0.048 * a, dx: ax + x * 0.002 * k },
          { y: ay - 0.05 * k, rx: 0.045 * a, rz: 0.048 * a, dx: ax + x * 0.004 * k },
          // The deltoid's insertion: the cap breaks into the upper arm.
          { y: ay - 0.4 * U, rx: 0.036 * a, rz: 0.04 * a, dx: ax + x * 0.001 * k },
          // The biceps forward, the triceps behind it.
          { y: ay - 0.64 * U, rx: 0.037 * a, rz: 0.044 * a, dx: ax, dz: 0.005 * k },
          // The elbow, slim, its point behind.
          { y: elbow + 0.04 * U, rx: 0.029 * a, rz: 0.032 * a, dx: ax, dz: -0.003 * k },
          // The forearm's swell under the elbow, out on its outer side only.
          { y: elbow - 0.22 * F, rx: 0.038 * a, rz: 0.035 * a, dx: ax + x * 0.008 * k, dz: 0.002 * k },
          { y: elbow - 0.6 * F, rx: 0.028 * a, rz: 0.027 * a, dx: ax + x * 0.002 * k },
          // The wrist's notch, the hand flaring from it.
          { y: wrist + 0.08 * F, rx: 0.018 * a, rz: 0.024 * a, dx: ax },
          { y: wrist, rx: 0.017 * a, rz: 0.022 * a, dx: ax },
        ],
        [fat.hipTop, fat.hipTop, fat.hipTop, fat.swell, fat.joint, fat.swell, fat.swell, fat.end, fat.end],
      ),
    }
    const hx = x * g.hips
    const T = s.thigh
    const S = s.shin
    const knee = hipY - T
    const ankle = g.ankle
    const leg: Limb = {
      seg: 14,
      caps: [0.03 * k, 0.018 * k],
      rings: fatten(
        [
          { y: hipY + 0.05 * k, rx: 0.075 * l, rz: 0.08 * l, dx: hx + x * 0.008 * k, dz: -0.008 * k },
          { y: hipY - 0.05 * k, rx: 0.078 * l, rz: 0.082 * l, dx: hx + x * 0.006 * k, dz: -0.002 * k },
          { y: hipY - 0.4 * T, rx: 0.066 * l, rz: 0.07 * l, dx: hx + x * 0.002 * k, dz: 0.004 * k },
          // The knee a clear narrowing under the thigh, the calf swelling behind the shin a third of the way down (its
          // outer head a touch higher and wider), the ankle slim above the foot: a leg, not a column, at sprite size.
          { y: knee + 0.2 * T, rx: 0.05 * l, rz: 0.053 * l, dx: hx, dz: 0.003 * k },
          { y: knee, rx: 0.042 * l, rz: 0.046 * l, dx: hx, dz: 0.006 * k },
          { y: knee - 0.28 * S, rx: 0.052 * l, rz: 0.06 * l, dx: hx + x * 0.003 * k, dz: -0.012 * k },
          { y: knee - 0.65 * S, rx: 0.034 * l, rz: 0.036 * l, dx: hx, dz: -0.004 * k },
          { y: ankle + 0.035 * k, rx: 0.024 * l, rz: 0.028 * l, dx: hx },
          { y: ankle, rx: 0.027 * l, rz: 0.03 * l, dx: hx },
        ],
        [fat.hipTop, fat.hipTop, fat.swell, fat.swell, fat.joint, fat.joint, fat.swell, fat.end, fat.end],
      ),
    }
    return { arm, leg }
  }
  const L = side('L', 1)
  const R = side('R', -1)
  return { torso, neck: neckLimb, arm: { L: L.arm, R: R.arm }, leg: { L: L.leg, R: R.leg } }
}

const regionOf = (p: Profiles, region: Region, side: Side): Limb =>
  region === 'torso' ? p.torso : region === 'neck' ? p.neck : p[region][side]

/** The body's ring at rest height `y` (the profile's own curves; clamped past its end keys). The side is ignored for the torso and the neck. */
export const ringAt = (p: Profiles, region: Region, side: Side, y: number): Ring =>
  profileAt(regionOf(p, region, side), y)

/**
 * The widest the body is over `[y1, y0]` as a box round it, and that box's centre: the rings sampled every 4 mm (both
 * ends included), `dx`/`dz` the middle of the extremes `dx ± rx` and `dz ± rz` over the span, `rx`/`rz` half their
 * spread. So an ellipse of `rx`/`rz` at `dx`/`dz` holds the body at every height of the span, even where the profile's
 * own centre drifts.
 */
export function girth(p: Profiles, region: Region, side: Side, y0: number, y1: number): Ring {
  const hi = Math.max(y0, y1)
  const lo = Math.min(y0, y1)
  const n = Math.max(1, Math.ceil((hi - lo) / 0.004))
  const limb = regionOf(p, region, side)
  let xHi = Number.NEGATIVE_INFINITY
  let xLo = Number.POSITIVE_INFINITY
  let zHi = Number.NEGATIVE_INFINITY
  let zLo = Number.POSITIVE_INFINITY
  for (let i = 0; i <= n; i++) {
    const r = profileAt(limb, lo + ((hi - lo) * i) / n)
    const dx = r.dx ?? 0
    const dz = r.dz ?? 0
    xHi = Math.max(xHi, dx + r.rx)
    xLo = Math.min(xLo, dx - r.rx)
    zHi = Math.max(zHi, dz + r.rz)
    zLo = Math.min(zLo, dz - r.rz)
  }
  return {
    y: (hi + lo) / 2,
    rx: (xHi - xLo) / 2,
    rz: (zHi - zLo) / 2,
    dx: (xHi + xLo) / 2,
    dz: (zHi + zLo) / 2,
  }
}

/** The clearance a garment keeps from the body: one texel at the figures' density (`ppm`), never under 4 mm at scale `k`. */
export const clearance = (k: number, ppm: number = FIGURE_PPM): number => Math.max(0.004 * k, 1 / ppm)

/**
 * What a garment is given to size itself from the body (`Wearing.body`): the profiles, the body's ring at a height, its
 * girth over a span, and the clearance to leave. A sleeve end, a cuff or a trouser-leg hem takes `girth(...)` plus
 * `clear` and so clears any body the sliders make.
 */
export interface Body {
  readonly profiles: Profiles
  at(region: Region, side: Side, y: number): Ring
  girth(region: Region, side: Side, y0: number, y1: number): Ring
  readonly clear: number
}

/** The body query of a measure on a rig. */
export function bodyOf(m: Measure, s: Skeleton): Body {
  const p = profiles(m, s)
  return {
    profiles: p,
    at: (region, side, y) => ringAt(p, region, side, y),
    girth: (region, side, y0, y1) => girth(p, region, side, y0, y1),
    clear: clearance(m.k),
  }
}
