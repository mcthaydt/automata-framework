import { J, type Side, type Skeleton } from '../body/rig';
import { lerp } from '../../lib/math';
import { profileAt, type Limb, type Ring } from '../body/parts';
import type { Measure } from '../body/genes';
import { PPM } from '../hair/hair';

/**
 * The body under the clothes, as a query. The profiles are the very ring lists `garments.ts body()` sweeps into the
 * torso, the neck, each arm and each leg (moved here unchanged, so no number changes), and `ringAt` and `girth` ask
 * them how wide the body is at a height, fat, bust and seat included. A garment sizes itself from the answer instead of
 * from `k · t` constants, so it clears any body the sliders make.
 */
/** The trapezius's slope (rad): the body's shoulder line runs up it to the neck. */
export const TRAPEZIUS = 0.6;
/** Fat's fullness: each ring of a profile grown by its own class (genes.ts `Measure.fat`), its placement unchanged. A
 * class of exactly 1 (fat 0) leaves the ring as it was. */
const fatten = (rings: Ring[], by: number[]): Ring[] => rings.map((r, i) => ({ ...r, rx: r.rx * by[i], rz: r.rz * by[i] }));
export interface Profiles { torso: Limb; arm: Record<Side, Limb>; leg: Record<Side, Limb>; neck: Limb }
/** The regions a garment may ask about: the trunk (in figure space), each arm and leg (in figure space) and the neck (in
 * its bone's space, as it is swept). */
export type Region = 'torso' | 'arm' | 'leg' | 'neck';
/** The profiles of the body the measure makes on this rig. */
export function profiles(m: Measure, s: Skeleton): Profiles {
  const g = s.genes, k = m.k, t = m.thick, fat = m.fat;
  const f = m.sliders.frame, mu = lerp(0.92, 1.1, m.sliders.muscle), D = k * t * m.depth;
  const a = k * t * m.arm * mu * lerp(1.04, 0.94, f), l = k * t * m.leg * lerp(0.96, 1.04, f), sh = g.shoulders, C = m.chest;
  const hipY = s.hipY, waistY = hipY + 0.155 * k, chestY = s.chestY, shoulderY = s.shoulderY;
  const neck = lerp(0.85, 1.15, m.sliders.neck) * lerp(1.05, 0.95, f);
  const trap = sh * 0.42, trapY = shoulderY - 0.016 * k + Math.tan(TRAPEZIUS) * (sh * 0.84 - trap);
  const torso: Limb = { e: 0.82, seg: 20, caps: [0.02 * k, 0.03 * k], round: [0.3, 1], rings: [
    { y: trapY, rx: trap, rz: 0.058 * D, dz: -0.008 * k },
    { y: lerp(trapY, shoulderY - 0.016 * k, 0.55), rx: lerp(trap, sh * 0.84, 0.55) * 1.02, rz: 0.064 * D, dz: -0.006 * k },
    { y: shoulderY - 0.016 * k, rx: sh * 0.84, rz: 0.07 * D, dz: -0.004 * k },
    { y: shoulderY - 0.05 * k, rx: sh * 0.9 * C, rz: 0.088 * D, dz: 0.004 * k },
    { y: chestY + 0.03 * k, rx: sh * lerp(0.9, 0.84, f) * C, rz: 0.096 * D * lerp(1, 1.06, f) * m.bust.rz, dz: 0.012 * k + m.bust.dz * k },
    { y: chestY - 0.07 * k, rx: sh * lerp(0.8, 0.74, f) * C, rz: 0.088 * D * (1 + (m.bust.rz - 1) / 2), dz: 0.008 * k },
    { y: waistY + 0.02 * k, rx: 0.11 * k * t * m.waist * lerp(1, 0.98, f), rz: 0.076 * D, dz: 0.002 * k },
    { y: hipY + 0.08 * k, rx: (g.hips + 0.05 * k * t * lerp(0.95, 1.06, f)) * m.seat.rx, rz: 0.084 * D * m.seat.rz, dz: -0.002 * k + m.seat.dz * k },
    { y: hipY - 0.02 * k, rx: (g.hips + 0.062 * k * t * lerp(0.95, 1.06, f)) * m.seat.rx, rz: 0.088 * D * m.seat.rz, dz: -0.006 * k + m.seat.dz * k },
    { y: hipY - 0.075 * k, rx: g.hips * 1.02 * m.seat.rx, rz: 0.074 * D * m.seat.rz, dz: -0.006 * k + m.seat.dz * k },
  ] };
  const neckLimb: Limb = { seg: 12, caps: [0.02 * k, 0.02 * k], rings: fatten([
      { y: g.neck + 0.04 * k, rx: 0.042 * k * neck, rz: 0.048 * k * neck, dz: 0.012 * k },
      { y: g.neck * 0.6, rx: 0.044 * k * neck, rz: 0.049 * k * neck, dz: 0.006 * k },
      { y: g.neck * 0.1, rx: 0.051 * k * neck, rz: 0.051 * k * neck, dz: -0.002 * k },
      { y: -0.04 * k, rx: 0.068 * k * neck, rz: 0.056 * k * neck, dz: -0.01 * k },
    ], [fat.neck, fat.neck, fat.neck, fat.neck]) };
  const side = (name: Side, x: 1 | -1) => {
    const ay = s.rest[J[`upperArm.${name}`]][1], ax = x * sh, U = s.upperArm, F = s.foreArm, elbow = ay - U, wrist = ay - g.arms;
    const arm: Limb = { seg: 14, caps: [0.028 * k, 0.012 * k], rings: fatten([
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
    ], [fat.hipTop, fat.hipTop, fat.hipTop, fat.swell, fat.joint, fat.swell, fat.swell, fat.end, fat.end]) };
    const hx = x * g.hips, T = s.thigh, S = s.shin, knee = hipY - T, ankle = g.ankle;
    const leg: Limb = { seg: 14, caps: [0.03 * k, 0.018 * k], rings: fatten([
      { y: hipY + 0.05 * k, rx: 0.075 * l, rz: 0.08 * l, dx: hx + x * 0.008 * k, dz: -0.008 * k },
      { y: hipY - 0.05 * k, rx: 0.078 * l, rz: 0.082 * l, dx: hx + x * 0.006 * k, dz: -0.002 * k },
      { y: hipY - 0.4 * T, rx: 0.066 * l, rz: 0.07 * l, dx: hx + x * 0.002 * k, dz: 0.004 * k },
      // The knee a clear narrowing under the thigh, the calf swelling behind the shin a third of the way down (its outer
      // head a touch higher and wider), the ankle slim above the foot: a leg, not a column, at sprite size.
      { y: knee + 0.2 * T, rx: 0.05 * l, rz: 0.053 * l, dx: hx, dz: 0.003 * k },
      { y: knee, rx: 0.042 * l, rz: 0.046 * l, dx: hx, dz: 0.006 * k },
      { y: knee - 0.28 * S, rx: 0.052 * l, rz: 0.06 * l, dx: hx + x * 0.003 * k, dz: -0.012 * k },
      { y: knee - 0.65 * S, rx: 0.034 * l, rz: 0.036 * l, dx: hx, dz: -0.004 * k },
      { y: ankle + 0.035 * k, rx: 0.024 * l, rz: 0.028 * l, dx: hx },
      { y: ankle, rx: 0.027 * l, rz: 0.03 * l, dx: hx },
    ], [fat.hipTop, fat.hipTop, fat.swell, fat.swell, fat.joint, fat.joint, fat.swell, fat.end, fat.end]) };
    return { arm, leg };
  };
  const L = side('L', 1), R = side('R', -1);
  return { torso, neck: neckLimb, arm: { L: L.arm, R: R.arm }, leg: { L: L.leg, R: R.leg } };
}
const REGION = (p: Profiles, region: Region, side: Side): Limb => (region === 'torso' ? p.torso : region === 'neck' ? p.neck : p[region][side]);
/** The body's ring at rest height `y` (the profile's own curves; clamped past its end keys). The side is ignored for the
 * torso and the neck. */
export const ringAt = (p: Profiles, region: Region, side: Side, y: number): Ring => profileAt(REGION(p, region, side), y);
/** The widest the body is over `[y1, y0]` (half-widths across and front to back, sampled every 4 mm with both ends
 * included), and its centre at the middle. */
export function girth(p: Profiles, region: Region, side: Side, y0: number, y1: number): Ring {
  const hi = Math.max(y0, y1), lo = Math.min(y0, y1), n = Math.max(1, Math.ceil((hi - lo) / 0.004)), o = REGION(p, region, side);
  let rx = 0, rz = 0;
  for (let i = 0; i <= n; i++) { const r = profileAt(o, lo + (hi - lo) * i / n); rx = Math.max(rx, r.rx); rz = Math.max(rz, r.rz); }
  const mid = profileAt(o, (hi + lo) / 2);
  return { y: (hi + lo) / 2, rx, rz, dx: mid.dx, dz: mid.dz };
}
/** The clearance a garment keeps from the body: one texel at the cell's density (`ppm`, default the sheets'), never
 * under 4 mm at scale `k`. */
export const clearance = (k: number, ppm?: number): number => Math.max(0.004 * k, 1 / (ppm ?? PPM));
/**
 * What a garment kind is given to size itself from the body (`Wearing.body`, H1): the profiles, the body's ring at a
 * height, its girth over a span, and the clearance to leave (one texel at the cell's density). A sleeve end, a cuff or a
 * trouser-leg hem takes `girth(...)` plus `clear` and so clears any body the sliders make.
 */
export interface Body {
  profiles: Profiles;
  at(region: Region, side: Side, y: number): Ring;
  girth(region: Region, side: Side, y0: number, y1: number): Ring;
  clear: number;
}
/** The body query of a measure on a rig, with the clearance at `ppm` texels a metre (default the sheets'). */
export function bodyOf(m: Measure, s: Skeleton, ppm?: number): Body {
  const p = profiles(m, s);
  return { profiles: p, at: (region, side, y) => ringAt(p, region, side, y), girth: (region, side, y0, y1) => girth(p, region, side, y0, y1), clear: clearance(m.k, ppm) };
}
