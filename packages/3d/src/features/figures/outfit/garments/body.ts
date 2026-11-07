// The body under the clothes, every size from the measure. The torso, each arm (deltoid to wrist) and each
// leg (hip to ankle) is one profiled limb, skinned across its joints, so it reads as anatomy, not stacked
// boxes. Each region a garment may repaint (chest, waist, pelvis; shoulder, upper arm, forearm; thigh, knee,
// shin) is its own stretch of the one profile, cut ring to ring, so a sleeve's end is a material's edge on an
// unbroken form.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`Regions`,
// `SURFACE`, `surfaces`, `TRAPEZIUS`, `trapezius`, `stretch`, `across`, `body`), with AF's strict types; the
// formulas and their order are the source's.

import { lerp, smooth, type V3 } from '../../../../shared/math/math.ts'
import type { Measure } from '../../body/genes.ts'
import { type Limb, limb } from '../../body/limb.ts'
import { GROUP, type Part, type Weight } from '../../body/mesh.ts'
import { at, J, type Side, type Skeleton } from '../../body/rig.ts'
import { weights } from '../../body/skin-weights.ts'
import type { Made } from '../../figure/materials.ts'
import { hands, shoe } from './hands-feet.ts'
import { head, SIDES } from './head.ts'

/** Materials of the body's regions; garments repaint them. */
export interface Regions {
  skin: string
  chest: string
  waist: string
  pelvis: string
  shoulder: string
  upper: string
  fore: string
  hand: string
  thigh: string
  knee: string
  shin: string
  shoe: string
  sole: string
  neck: string
}

export const armGroup = (side: Side): number => (side === 'L' ? GROUP.armL : GROUP.armR)
export const legGroup = (side: Side): number => (side === 'L' ? GROUP.legL : GROUP.legR)

/**
 * The body's surfaces: the torso, each arm and each leg one surface apiece; garments keep their own edges.
 */
const SURFACE: Readonly<Record<number, number>> = {
  [GROUP.torso]: 3000,
  [GROUP.armL]: 3001,
  [GROUP.armR]: 3002,
  [GROUP.legL]: 3003,
  [GROUP.legR]: 3004,
}
function surfaces(parts: Part[]): Part[] {
  return parts.map((p) => {
    const seam = SURFACE[p.group]
    return p.seam === undefined && seam !== undefined ? { ...p, seam } : p
  })
}

/**
 * The trapezius's slope (rad), and a point on it in the chest's space: `along` outward from its middle, `up`
 * off its centre line.
 */
const TRAPEZIUS = 0.6

export { TRAPEZIUS }
export function trapezius(s: Skeleton, x: number, along: number, up: number): V3 {
  const k = s.genes.height / 1.62
  const c = Math.cos(TRAPEZIUS)
  const n = Math.sin(TRAPEZIUS)
  return [
    x * (s.genes.shoulders * 0.52 + along * c + up * n),
    s.shoulderY - s.chestY - 0.035 * k - along * n + up * c,
    -0.005 * k,
  ]
}

/** One stretch of a skinned limb in rest figure space: the profile cut to [hi, lo], painted `material`. */
function stretch(
  material: string,
  group: number,
  o: Limb,
  hi: number,
  lo: number,
  skin: (x: number, y: number, z: number) => Weight[],
): Part {
  const mesh = limb({ ...o, span: [hi, lo] })
  return { mesh, material, group, skin: weights(mesh, skin) }
}

/**
 * Two bones' weights across a joint at `y`, blended over `soft` either side (a smooth union for the
 * skinning).
 */
const across =
  (upper: number, lower: number, y: number, soft: number) =>
  (py: number): Weight[] => {
    const w = smooth((py - (y - soft)) / (2 * soft))
    return [
      [upper, w],
      [lower, 1 - w],
    ]
  }

export function body(m: Measure, s: Skeleton, r: Regions, thighs: boolean, made: Made): Part[] {
  const g = s.genes
  const k = m.k
  const t = m.thick
  const fw = m.foot
  const foot = g.foot
  const hand = m.hand
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
  const pelvisY = at(s.rest, J.pelvis)[1]
  const spineY = at(s.rest, J.spine)[1]
  const neck = lerp(0.85, 1.15, m.sliders.neck) * lerp(1.05, 0.95, f)
  // ─── Torso: seat, hips, waist, ribs, chest, the shoulders up the trapezius to the neck ───
  // The trapezius: from the shoulder's top ring a straight slope (TRAPEZIUS) in to the neck's root, standing
  // either side of it, so the line from the neck to the shoulder point falls as a muscle does rather than
  // squaring off.
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
        rz: 0.096 * D * lerp(1, 1.06, f),
        dz: 0.012 * k,
      },
      { y: chestY - 0.07 * k, rx: sh * lerp(0.8, 0.74, f) * C, rz: 0.088 * D, dz: 0.008 * k },
      { y: waistY + 0.02 * k, rx: 0.11 * k * t * m.waist * lerp(1, 0.98, f), rz: 0.076 * D, dz: 0.002 * k },
      { y: hipY + 0.08 * k, rx: g.hips + 0.05 * k * t * lerp(0.95, 1.06, f), rz: 0.084 * D, dz: -0.002 * k },
      { y: hipY - 0.02 * k, rx: g.hips + 0.062 * k * t * lerp(0.95, 1.06, f), rz: 0.088 * D, dz: -0.006 * k },
      { y: hipY - 0.075 * k, rx: g.hips * 1.02, rz: 0.074 * D, dz: -0.006 * k },
    ],
  }
  // The trunk bends at the spine: the hips ride the pelvis, the ribs the chest, the waist between them.
  const trunk = (_x: number, y: number): Weight[] => {
    const lo = smooth((y - (pelvisY + 0.02 * k)) / (spineY - pelvisY))
    const hi = smooth((y - spineY) / (chestY - spineY))
    return [
      [J.pelvis, 1 - lo],
      [J.spine, lo * (1 - hi)],
      [J.chest, lo * hi],
    ]
  }
  const belt = hipY + 0.09 * k
  const ribs = chestY - 0.07 * k
  const parts: Part[] = [
    stretch(r.chest, GROUP.torso, torso, Infinity, ribs, trunk),
    stretch(r.waist, GROUP.torso, torso, ribs, belt, trunk),
    stretch(r.pelvis, GROUP.torso, torso, belt, -Infinity, trunk),
    // The neck, leaning forward to carry the head ahead of the shoulders: narrow under the jaw, running up
    // behind the ear, then flaring into the trapezius at its root. Its top is closed.
    {
      bone: J.neck,
      material: r.neck,
      group: GROUP.head,
      mesh: limb({
        seg: 12,
        caps: [0.02 * k, 0.02 * k],
        rings: [
          { y: g.neck + 0.04 * k, rx: 0.042 * k * neck, rz: 0.048 * k * neck, dz: 0.012 * k },
          { y: g.neck * 0.6, rx: 0.044 * k * neck, rz: 0.049 * k * neck, dz: 0.006 * k },
          { y: g.neck * 0.1, rx: 0.051 * k * neck, rz: 0.051 * k * neck, dz: -0.002 * k },
          { y: -0.04 * k, rx: 0.068 * k * neck, rz: 0.056 * k * neck, dz: -0.01 * k },
        ],
      }),
    },
    ...head(m, s, r.skin, made),
  ]
  for (const [side, x] of SIDES) {
    const ag = armGroup(side)
    const lg = legGroup(side)
    // ─── Arm: the deltoid's cap, biceps, elbow, the forearm's swell, a wrist ───
    const ay = at(s.rest, J[`upperArm.${side}`])[1]
    const ax = x * sh
    const U = s.upperArm
    const F = s.foreArm
    const elbow = ay - U
    const wrist = ay - g.arms
    const arm: Limb = {
      seg: 14,
      caps: [0.028 * k, 0.012 * k],
      rings: [
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
    }
    const bend = across(J[`upperArm.${side}`], J[`foreArm.${side}`], elbow, 0.05 * k)
    // The shoulder's top rides the chest a little, so a swinging arm rolls under its cap rather than lifting
    // it.
    const shoulder = (_x: number, y: number): Weight[] => {
      const c = 0.45 * smooth((y - (ay - 0.03 * k)) / (0.07 * k))
      return [
        [J.chest, c],
        [J[`upperArm.${side}`], 1 - c],
      ]
    }
    const armSkin = (px: number, py: number) => (py > ay - 0.1 * k ? shoulder(px, py) : bend(py))
    parts.push(
      stretch(r.shoulder, ag, arm, Infinity, ay - 0.075 * k, armSkin),
      stretch(r.upper, ag, arm, ay - 0.075 * k, elbow, armSkin),
      stretch(r.fore, ag, arm, elbow, -Infinity, armSkin),
      ...hands(J[`hand.${side}`], r.hand, ag, x, k * hand, [0.017 * a, 0.022 * a]),
    )
    // ─── Leg: the hip, a thigh that narrows to the knee, the kneecap, a calf behind the shin, the ankle ───
    const hx = x * g.hips
    const T = s.thigh
    const S = s.shin
    const knee = hipY - T
    const ankle = g.ankle
    const leg: Limb = {
      seg: 14,
      caps: [0.03 * k, 0.018 * k],
      rings: [
        { y: hipY + 0.05 * k, rx: 0.075 * l, rz: 0.08 * l, dx: hx + x * 0.008 * k, dz: -0.008 * k },
        { y: hipY - 0.05 * k, rx: 0.078 * l, rz: 0.082 * l, dx: hx + x * 0.006 * k, dz: -0.002 * k },
        { y: hipY - 0.4 * T, rx: 0.066 * l, rz: 0.07 * l, dx: hx + x * 0.002 * k, dz: 0.004 * k },
        { y: knee + 0.2 * T, rx: 0.052 * l, rz: 0.054 * l, dx: hx, dz: 0.003 * k },
        { y: knee, rx: 0.047 * l, rz: 0.05 * l, dx: hx, dz: 0.006 * k },
        { y: knee - 0.3 * S, rx: 0.05 * l, rz: 0.055 * l, dx: hx, dz: -0.008 * k },
        { y: knee - 0.65 * S, rx: 0.037 * l, rz: 0.038 * l, dx: hx, dz: -0.003 * k },
        { y: ankle + 0.035 * k, rx: 0.028 * l, rz: 0.031 * l, dx: hx },
        { y: ankle, rx: 0.03 * l, rz: 0.033 * l, dx: hx },
      ],
    }
    const kneeBend = across(J[`thigh.${side}`], J[`shin.${side}`], knee, 0.05 * k)
    // The top of the thigh rides the pelvis in part: the hip creases as the leg swings, it does not lift out.
    const hip = (y: number): Weight[] => {
      const p = 0.55 * smooth((y - (hipY - 0.07 * k)) / (0.12 * k))
      return [
        [J.pelvis, p],
        [J[`thigh.${side}`], 1 - p],
      ]
    }
    const legSkin = (_x: number, py: number) => (py > hipY - 0.1 * k ? hip(py) : kneeBend(py))
    const above = knee + 0.06 * k
    const below = knee - 0.06 * k
    if (thighs) parts.push(stretch(r.thigh, lg, leg, Infinity, above, legSkin))
    parts.push(
      stretch(r.knee, lg, leg, thighs ? above : knee + 0.03 * k, below, legSkin),
      stretch(r.shin, lg, leg, below, -Infinity, legSkin),
    )
    // ─── Foot: a shoe from the heel's round over the instep to the toe, on its sole ───
    parts.push(...shoe(J[`foot.${side}`], r.shoe, r.sole, lg, k, fw, foot, ankle))
  }
  return surfaces(parts)
}
