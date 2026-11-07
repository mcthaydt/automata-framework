// What every streetwear garment shares: the body under the clothes it clears, how its vertices ride the rig
// (a shell over the torso's three bones, a sleeve over the arm's two, a leg from the hip through the knee),
// its seams, and its marks (a zip, a stitch, a welt) laid on a shell as points.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246 (`Fit`,
// `SEAM`, `under`, `torsoSkin`, `thighShare`, `armSkin`, `legSkin`, `drapeSkin`, `torsoBone`, `local`,
// `piece`, `skinned`, `stroke`, `onShell`), with AF's strict types; the formulas and their order are the
// source's. Changed: a garment's painter materials (`own`, `lighter`, `mark`, `flatTone`, from the DUEL
// ramps) are swatch variants (build/materials.ts: `own` and `tone` here).

import type { Decal, Fit, Measure, Mesh, Paint, Part, Shell, Wearing, Weight } from '@automata/3d/figures-kit'
import {
  at,
  hemSkin,
  J,
  lerp,
  type Made,
  normalize,
  type Side,
  type Skeleton,
  type Superquadric,
  smooth,
  superquadric,
  type V3,
  variant,
  weights,
} from '@automata/3d/figures-kit'
import { frontOf } from './loft.ts'

// The contract types are core's (figures-kit); re-exported so a builder imports them with the helpers.
export type { Fit, Paint, Wearing }

/**
 * A top that repaints the whole torso and both arms, so the body under it is its cloth wherever a joint opens
 * a gap.
 */
export const wholeTop = (cloth: string): Paint => ({
  chest: cloth,
  waist: cloth,
  shoulder: cloth,
  upper: cloth,
  fore: cloth,
})

/** Each garment's surfaces (the body's are 3000–3004). */
export const SEAM = {
  shell: 4000,
  collar: 4001,
  hem: 4002,
  sleeveL: 4003,
  sleeveR: 4004,
  cuffL: 4005,
  cuffR: 4006,
  hood: 4007,
  hoodInside: 4008,
  pocket: 4009,
  lapelL: 4010,
  lapelR: 4011,
  belt: 4012,
  buckle: 4013,
  rimR: 4014,
  epauletteL: 4015,
  epauletteR: 4016,
  tab: 4017,
  under: 4020,
  underRib: 4021,
  underSleeveL: 4022,
  underSleeveR: 4023,
  /** A puffer's baffles, each its own sewn chamber (body, collar, sleeves): 4030 on. */
  baffle: 4030,
  seat: 4100,
  waistband: 4101,
  legL: 4102,
  legR: 4103,
  cuffLegL: 4104,
  cuffLegR: 4105,
  pocketL: 4106,
  pocketR: 4107,
  flapL: 4108,
  flapR: 4109,
  sole: 4200,
  outsole: 4201,
  upper: 4202,
  mudguard: 4203,
  heelTab: 4204,
  hoop: 5002,
  lens: 5003,
  frame: 5004,
} as const
export const FRONT: number = Math.PI / 2

// ─── Materials: a garment's own cloth in another role, and a tone of a swatch as a flat mark ───
/** A garment's main cloth in a role its file names no swatch for: its rib the cloth matte (knit takes no
 * shine); its inside a step into the shade; a stitch a line of the cloth's own light. */
export function own(made: Made, cloth: string, role: 'rib' | 'inside' | 'stitch'): string {
  return role === 'rib'
    ? variant(made, cloth, 'rib', { matte: true })
    : role === 'inside'
      ? variant(made, cloth, 'inside', { matte: true, shade: -1 })
      : variant(made, cloth, 'stitch', { flat: true, shade: 1 })
}
/** One of a swatch's four tones (0 light … 3 deep) as a flat mark: a seam, a welt, a zip's teeth. */
export const tone = (made: Made, of: string, role: string, i: 0 | 1 | 2 | 3): string =>
  variant(made, of, role, i === 1 ? { flat: true } : { flat: true, shade: 1 - i })

/**
 * A zip's teeth along it (0 its top … 1 its foot), in its swatches by turns from top to foot (a holo run).
 */
export const zipAt = (zip: readonly string[], u: number): string =>
  at(zip, Math.min(zip.length - 1, Math.floor(u * zip.length)))

// ─── The body under the clothes (garments/body.ts), which every garment here clears ───
export interface Under {
  g: Skeleton['genes']
  k: number
  depth: number
  hips: number
  hip: number
  seat: number
  waist: number
  waistDepth: number
  arm: number
  fore: number
  thigh: number
  shin: number
  neck: number
  armY: number
  elbowY: number
  wristY: number
  chestY: number
  spineY: number
  pelvisY: number
  kneeY: number
}
export function under(m: Measure, s: Skeleton): Under {
  const g = s.genes
  const k = m.k
  const t = m.thick
  return {
    g,
    k,
    depth: 0.1 * k * t * m.depth,
    hips: g.hips * 1.95,
    hip: g.hips + 0.064 * k * t,
    seat: 0.105 * k * t * m.depth,
    waist: 0.112 * k * t * m.waist,
    waistDepth: 0.088 * k * t * m.depth,
    arm: 0.05 * k * t * m.arm,
    fore: 0.044 * k * t * m.arm,
    thigh: 0.085 * k * t * m.leg,
    shin: 0.062 * k * t * m.leg,
    neck: 0.042 * k * t * m.arm,
    armY: at(s.rest, J['upperArm.L'])[1],
    elbowY: at(s.rest, J['foreArm.L'])[1],
    wristY: at(s.rest, J['hand.L'])[1],
    chestY: at(s.rest, J.chest)[1],
    spineY: at(s.rest, J.spine)[1],
    pelvisY: at(s.rest, J.pelvis)[1],
    kneeY: at(s.rest, J['shin.L'])[1],
  }
}

// ─── Skinning: which bones carry each vertex ───
/**
 * How much of a trouser leg the thigh carries at height y (the rest the pelvis): none above the hip, all past
 * its top.
 */
export const thighShare = (s: Skeleton, k: number, y: number): number =>
  smooth((s.hipY + 0.03 * k - y) / (0.16 * k))
/** Over the torso: the chest above, the spine through the waist, the pelvis below. Under the hip a long top's
 * hem follows the thighs (as a skirt's does), each half riding its own thigh at least as far as the trouser
 * leg under it. */
export function torsoSkin(s: Skeleton, hem: number, follow = 0.35): (x: number, y: number) => Weight[] {
  const chest = at(s.rest, J.chest)[1]
  const spine = at(s.rest, J.spine)[1]
  const pelvis = at(s.rest, J.pelvis)[1]
  const k = s.genes.height / 1.62
  return (x, y) => {
    const c = smooth((y - spine) / (chest - spine))
    const p = smooth((spine - y) / (spine - pelvis))
    // A long top's share eases in from above the hip, so its back slants with a striding leg rather than
    // kinking.
    const d = Math.max(
      hem < s.hipY
        ? Math.max(
            follow * smooth((s.hipY - y) / (s.hipY - hem)),
            smooth((s.hipY + 0.1 * k - y) / (0.26 * k)),
          )
        : 0,
      thighShare(s, k, y),
    )
    const left = smooth(x / (s.genes.hips * 0.6) + 0.5)
    return [
      [J.chest, c * (1 - d)],
      [J.spine, (1 - c - p) * (1 - d)],
      [J.pelvis, p * (1 - d)],
      [J['thigh.L'], d * left],
      [J['thigh.R'], d * (1 - left)],
    ]
  }
}
/** Along an arm: the upper arm, the forearm past the elbow, and the sleeve's cap half on the clavicle. */
export function armSkin(s: Skeleton, side: Side, k: number): (x: number, y: number) => Weight[] {
  const elbow = at(s.rest, J[`foreArm.${side}`])[1]
  const top = at(s.rest, J[`upperArm.${side}`])[1]
  return (_x, y) => {
    const f = smooth((elbow + 0.04 * k - y) / (0.08 * k))
    const c = 0.45 * smooth((y - (top - 0.07 * k)) / (0.1 * k))
    return [
      [J[`clavicle.${side}`], c],
      [J[`upperArm.${side}`], (1 - f) * (1 - c)],
      [J[`foreArm.${side}`], f * (1 - c)],
    ]
  }
}
/** Down a leg: the pelvis at the waist, the thigh, the shin past the knee. */
export function legSkin(s: Skeleton, side: Side, k: number): (x: number, y: number) => Weight[] {
  const knee = at(s.rest, J[`shin.${side}`])[1]
  return (_x, y) => {
    const th = thighShare(s, k, y)
    const sh = smooth((knee + 0.05 * k - y) / (0.1 * k))
    return [
      [J.pelvis, 1 - th],
      [J[`thigh.${side}`], th * (1 - sh)],
      [J[`shin.${side}`], th * sh],
    ]
  }
}
/** Down a wide trouser leg: as legSkin to the knee, then the hem on its hem joint (J.hemL / J.hemR), falling
 * off up the shin to the knee, so in a stride the hem hangs over the back foot rather than swinging out with
 * it. */
export function drapeSkin(s: Skeleton, side: Side, k: number): (x: number, y: number) => Weight[] {
  return hemSkin(legSkin(s, side, k), J[`hem${side}`], at(s.rest, J[`shin.${side}`])[1], s.genes.ankle)
}
/** The bone a mark at height y rides: the torso's, whichever carries most of the shell there. */
export const torsoBone = (s: Skeleton, y: number): number =>
  y > (at(s.rest, J.chest)[1] + at(s.rest, J.spine)[1]) / 2
    ? J.chest
    : y > (at(s.rest, J.spine)[1] + at(s.rest, J.pelvis)[1]) / 2
      ? J.spine
      : J.pelvis
/** Rest figure space into a bone's space (rest rotations are the identity). */
export const local = (s: Skeleton, bone: number, p: V3): V3 => {
  const r = at(s.rest, bone)
  return [p[0] - r[0], p[1] - r[1], p[2] - r[2]]
}

export const piece = (
  bone: number,
  material: string,
  group: number,
  seam: number,
  o: Superquadric,
): Part => ({
  bone,
  material,
  group,
  seam,
  mesh: superquadric({ e: [0.5, 0.55], seg: 10, rings: 6, ...o }),
})
export const skinned = (
  mesh: Mesh,
  material: string,
  group: number,
  seam: number,
  f: (x: number, y: number, z: number) => Weight[],
): Part => ({ mesh, material, group, seam, skin: weights(mesh, f) })

/** A line of marks from a to b on a bone, close enough to be unbroken: a zip, a drawstring, a stitch. */
export function stroke(bone: number, a: V3, b: V3, normal: V3, material: string, step = 0.004): Decal[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step))
  const out: Decal[] = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    out.push({ bone, at: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], normal, material })
  }
  return out
}
/** A line of marks along a shell's front (`back`, its back) from a to b (x, y), `lift` off it, each riding
 * the torso's bone there and facing out of the cloth: a zip's teeth, a welt, a seam. */
export function onShell(
  s: Skeleton,
  sh: Shell,
  a: [number, number],
  b: [number, number],
  material: string,
  back = false,
  lift = 0.002,
): Decal[] {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.004))
  const d = back ? -1 : 1
  const out: Decal[] = []
  for (let i = 0; i <= n; i++) {
    const x = lerp(a[0], b[0], i / n)
    const y = lerp(a[1], b[1], i / n)
    const z = frontOf(sh, x, y, back)
    if (z === null) continue
    const { c, r } = sh.section((y - sh.from) / (sh.to - sh.from))
    const bone = torsoBone(s, y)
    out.push({
      bone,
      at: local(s, bone, [x, y, z + d * lift]),
      normal: normalize([(x - c[0]) / r[0] ** 2, 0, (z - c[1]) / r[1] ** 2]),
      material,
    })
  }
  return out
}
