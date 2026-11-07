// The body under the clothes, every size from the measure. The torso, each arm (deltoid to wrist) and each
// leg (hip to ankle) is one profiled limb, skinned across its joints, so it reads as anatomy, not stacked
// boxes. Each region a garment may repaint (chest, waist, pelvis; shoulder, upper arm, forearm; thigh, knee,
// shin) is its own stretch of the one profile, cut ring to ring, so a sleeve's end is a material's edge on an
// unbroken form.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`Regions`,
// `SURFACE`, `surfaces`, `TRAPEZIUS`, `trapezius`, `stretch`, `across`, `body`), with AF's strict types; the
// formulas and their order are the source's.

import { type Limb, limb } from '../../../../shared/math/limb.ts'
import { lerp, smooth, type V3 } from '../../../../shared/math/math.ts'
import type { Measure } from '../../body/genes.ts'
import { GROUP, type Part, type Weight } from '../../body/mesh.ts'
import { profiles, TRAPEZIUS } from '../../body/profiles.ts'
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
 * A point on the trapezius's slope in the chest's space: `along` outward from its middle, `up` off its centre line.
 */
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
  const a = k * t * m.arm * mu * lerp(1.04, 0.94, f)
  const hipY = s.hipY
  const chestY = s.chestY
  const pelvisY = at(s.rest, J.pelvis)[1]
  const spineY = at(s.rest, J.spine)[1]
  // ─── Torso: seat, hips, waist, ribs, chest, the shoulders up the trapezius to the neck (profiles.ts) ───
  const p = profiles(m, s)
  const torso = p.torso
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
      mesh: limb(p.neck),
    },
    ...head(m, s, r.skin, made),
  ]
  for (const [side, x] of SIDES) {
    const ag = armGroup(side)
    const lg = legGroup(side)
    // ─── Arm: the deltoid's cap, biceps, elbow, the forearm's swell, a wrist ───
    const ay = at(s.rest, J[`upperArm.${side}`])[1]
    const U = s.upperArm
    const elbow = ay - U
    const arm = p.arm[side]
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
    const T = s.thigh
    const knee = hipY - T
    const ankle = g.ankle
    const leg = p.leg[side]
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
