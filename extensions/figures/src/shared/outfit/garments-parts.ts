import type { Measure } from '../body/genes'
import { ear, headForm, headMesh } from '../body/head'
import {
  GROUP,
  type Limb,
  limb,
  type Material,
  type Part,
  placed,
  profileAt,
  type Superquadric,
  superquadric,
  weights,
} from '../body/parts'
import { J, type Side, type Skeleton } from '../body/rig'
import { PPM, sweep, texels } from '../hair/hair'
import { hexOf } from '../math/colour'
import { apply, axisAngle, compose, lerp, smooth, sub, type V3 } from '../math/math'
import { FACE_SEAM, tonesOf } from '../paint/paint'
import type { Body, Profiles } from './fit'
import { armGroup, box, legGroup, sides } from './garments-registry'
import type { Regions } from './garments-types'
import { type ShoeForm, shodSeam, sole, upperMesh } from './shoe'
/**
 * A top's cuff on a side: a box round the forearm (`long` sleeves, at 0.9 of its length) or the upper arm (short, at 0.86).
 * It hugs the arm: each radius is the arm's widest over the cuff's span plus the clearance (a texel), centred on the arm's
 * own profile there, so it clears any arm and follows fat, and a thin arm gets a slim cuff, not a flare.
 */
export function cuff(side: Side, material: string, long: boolean, m: Measure, s: Skeleton, body: Body): Part {
  const k = m.k,
    bone = long ? J[`foreArm.${side}`] : J[`upperArm.${side}`],
    rest = s.rest[bone]
  const y = rest[1] - (long ? 0.9 * s.foreArm : 0.86 * s.upperArm),
    hh = (long ? 0.022 : 0.02) * k
  const G = body.girth('arm', side, y + hh, y - hh),
    c = body.clear
  return box(bone, material, armGroup(side), {
    at: [(G.dx ?? 0) - rest[0], y - rest[1], (G.dz ?? 0) - rest[2]],
    r: [G.rx + c, hh, G.rz + c],
    e: [0.45, 0.6],
  })
}
/**
 * One side of a top's collar. It sits at 0.172 k above the chest bone, on the neck (past the trunk's top cap), so it is
 * sized from the neck's profile there, in the chest bone's space: today's centres are the floor, and the pieces stand out
 * only as far as their outer faces clear the neck's side and front by the clearance (a thick neck pushes it out).
 */
export function collarPiece(x: 1 | -1, material: string, m: Measure, s: Skeleton, body: Body): Part {
  const k = m.k,
    yc = 0.172 * k,
    N = profileAt(body.profiles.neck, s.rest[J.chest][1] + yc - s.rest[J.neck][1]),
    nz = s.rest[J.neck][2] - s.rest[J.chest][2] + (N.dz ?? 0)
  const cx = Math.max(0.04 * k, N.rx + body.clear - 0.04 * k),
    cz = Math.max(0.045 * k, nz + N.rz + body.clear - 0.04 * k)
  return box(J.chest, material, GROUP.torso, {
    at: [x * cx, yc, cz],
    r: [0.04 * k, 0.018 * k, 0.04 * k],
    turn: axisAngle([0, 1, 0], x * 0.5),
    e: [0.35, 0.5],
  })
}
/** The body's surfaces: the torso, each arm (shoulder to hand) and each leg (thigh to foot) one surface apiece, so the
 * painter draws no crevice or line at a waist, an elbow or a knee (paint.ts); garments keep their own edges. */
export const SURFACE: Record<number, number> = {
  [GROUP.torso]: 3000,
  [GROUP.armL]: 3001,
  [GROUP.armR]: 3002,
  [GROUP.legL]: 3003,
  [GROUP.legR]: 3004,
}
/** The thumbs are surfaces of their own, so the painter's crevice tone draws each against its palm. */
const THUMB = { L: 3005, R: 3006 } as const
function surfaces(parts: Part[]): Part[] {
  return parts.map((p) =>
    p.seam === undefined && SURFACE[p.group] !== undefined ? { ...p, seam: SURFACE[p.group] } : p,
  )
}
/** The tag on the body's neck part: the raster's neckline rule (paint/raster.ts `neckline`) finds it by this, so a texel
 * of neck poking down into a top's collar joins the top. A tag changes no pixel and no part order. */
export const NECK = 'neck'
/** One stretch of a skinned limb in rest figure space: the profile cut to [hi, lo], painted `material`. */
function stretch(
  material: string,
  group: number,
  o: Limb,
  hi: number,
  lo: number,
  skin: (x: number, y: number, z: number) => [number, number][],
): Part {
  const mesh = limb({ ...o, span: [hi, lo] })
  return { mesh, material, group, skin: weights(mesh, skin) }
}
/** Two bones' weights across a joint at `y`, blended over `soft` either side (a smooth union for the skinning). */
const across =
  (upper: number, lower: number, y: number, soft: number) =>
  (py: number): [number, number][] => {
    const w = smooth((py - (y - soft)) / (2 * soft))
    return [
      [upper, w],
      [lower, 1 - w],
    ]
  }
/**
 * The body under the clothes, every size from the measure. The torso, each arm (deltoid to wrist) and each leg (hip to
 * ankle) is one profiled limb (parts.ts), skinned across its joints, so it reads as anatomy, not stacked boxes: shoulders
 * that cap the arm, a waist and hips, arms that taper to a wrist, a knee, a calf and an ankle. Each region a garment may
 * repaint (chest, waist, pelvis; shoulder, upper arm, forearm; thigh, knee, shin) is its own stretch of the one profile,
 * cut ring to ring, so a sleeve's end is a material's edge on an unbroken form.
 */
export function body(
  m: Measure,
  s: Skeleton,
  r: Regions,
  thighs: boolean,
  ppm: number | undefined,
  P: Profiles,
  form?: ShoeForm,
): Part[] {
  const g = s.genes,
    k = m.k,
    t = m.thick,
    fw = m.foot,
    foot = g.foot,
    hand = m.hand
  const f = m.sliders.frame,
    mu = lerp(0.92, 1.1, m.sliders.muscle)
  const a = k * t * m.arm * mu * lerp(1.04, 0.94, f)
  const hipY = s.hipY,
    chestY = s.chestY,
    pelvisY = s.rest[J.pelvis][1]
  // ─── Torso: seat, hips, waist, ribs, chest, the shoulders up the trapezius to the neck ───
  const torso = P.torso
  // The trunk bends at the spine: the hips ride the pelvis, the ribs the chest, the waist between them.
  const trunk = (_x: number, y: number): [number, number][] => {
    const lo = smooth((y - (pelvisY + 0.02 * k)) / (s.rest[J.spine][1] - pelvisY)),
      hi = smooth((y - s.rest[J.spine][1]) / (chestY - s.rest[J.spine][1]))
    return [
      [J.pelvis, 1 - lo],
      [J.spine, lo * (1 - hi)],
      [J.chest, lo * hi],
    ]
  }
  const belt = hipY + 0.09 * k,
    ribs = chestY - 0.07 * k
  const parts: Part[] = [
    stretch(r.chest, GROUP.torso, torso, Infinity, ribs, trunk),
    stretch(r.waist, GROUP.torso, torso, ribs, belt, trunk),
    stretch(r.pelvis, GROUP.torso, torso, belt, -Infinity, trunk),
    // The neck, leaning forward to carry the head ahead of the shoulders: narrow under the jaw (which overhangs it a
    // texel), running up behind the ear, then flaring into the trapezius at its root, so it tapers from the head to the
    // collar rather than standing as a column the jaw's width. Its top is closed (seen from above and behind, past the
    // nape, it shows no hole).
    { bone: J.neck, material: r.neck, group: GROUP.head, tag: NECK, mesh: limb(P.neck) },
    ...head(m, s, r.skin, ppm),
  ]
  for (const [side, x] of sides) {
    const ag = armGroup(side),
      lg = legGroup(side)
    // ─── Arm: the deltoid's cap, biceps, elbow, the forearm's swell, a wrist ───
    // Drawn for the sprite's size: each change of the form a texel's step at D2, and the two contours curving against
    // each other (the deltoid out, the biceps forward, the elbow's point back, the forearm's swell out on its outer side
    // while its inner line runs straight), so the light turns over it rather than running down a ribbon.
    const ay = s.rest[J[`upperArm.${side}`]][1],
      U = s.upperArm,
      elbow = ay - U
    const arm = P.arm[side]
    const bend = across(J[`upperArm.${side}`], J[`foreArm.${side}`], elbow, 0.05 * k)
    // The shoulder's top rides the chest a little, so a swinging arm rolls under its cap rather than lifting it.
    const shoulder = (_x: number, y: number): [number, number][] => {
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
    const T = s.thigh,
      knee = hipY - T,
      ankle = g.ankle
    const leg = P.leg[side]
    const kneeBend = across(J[`thigh.${side}`], J[`shin.${side}`], knee, 0.05 * k)
    // The top of the thigh rides the pelvis in part: the hip creases as the leg swings, it does not lift out.
    const hip = (y: number): [number, number][] => {
      const p = 0.55 * smooth((y - (hipY - 0.07 * k)) / (0.12 * k))
      return [
        [J.pelvis, p],
        [J[`thigh.${side}`], 1 - p],
      ]
    }
    const legSkin = (_x: number, py: number) => (py > hipY - 0.1 * k ? hip(py) : kneeBend(py))
    const above = knee + 0.06 * k,
      below = knee - 0.06 * k
    if (thighs) parts.push(stretch(r.thigh, lg, leg, Infinity, above, legSkin))
    parts.push(
      stretch(r.knee, lg, leg, thighs ? above : knee + 0.03 * k, below, legSkin),
      stretch(r.shin, lg, leg, below, -Infinity, legSkin),
    )
    // ─── Foot: a shoe from the heel's round over the instep to the toe, on its sole ───
    parts.push(
      ...(r.shoe === r.skin
        ? bareFoot(J[`foot.${side}`], r.skin, lg, k, fw, foot, ankle)
        : shoe(J[`foot.${side}`], r.shoe, r.sole, lg, k, fw, foot, ankle, form, shodSeam(form, side))),
    )
  }
  return surfaces(parts)
}
/** The ears' surfaces: each its own, so the painter's crevice tone draws its rim against its bowl and the head behind it. */
const EAR = { L: 1001, R: 1002 } as const,
  BOWL = { L: 1003, R: 1004 } as const
/** The ears' skin: the head's swatch under its own name, so the painter shades each ear by its own form (its normals are
 * not smoothed into the head's round it) and the drawn face never lands on it. */
const earSkin = (skin: string) => `${skin}~ear`
/** The ear's materials: its rim the skin, lit by its own form (so a rim facing the camera reads light; no glint, which
 * would spot it like a stud), its bowl the
 * skin's shadow and deep (a hollow the light never reaches), so the bowl reads dark inside the rim in any view. */
export function earSkins(skin: string, m: Material): Record<string, Material> {
  const t = tonesOf(m).map(hexOf)
  return {
    [earSkin(skin)]: { ...m, gloss: undefined, tones: [0.42, -0.2, -0.62] },
    [`${earSkin(skin)}~bowl`]: { ...m, gloss: undefined, paint: [t[2], t[2], t[3], t[3]] },
  }
}
/**
 * The head: its skin one smooth surface from chin to crown (headForm), a nose standing off the face (in profile it breaks
 * the silhouette) and an ear each side. The face is drawn on the skin (paint.ts); the skin and nose are one surface
 * (FACE_SEAM), so the painter draws no line inside it. Each ear is a bowl (the concha) inside a rim (the helix, running
 * from over the opening round the top and down the back to the lobe), each its own surface, the rim standing proud of
 * the bowl, so the bowl takes the crevice tone inside a lit rim in three-quarter and profile, and the
 * head takes it round the ear.
 */
function head(m: Measure, s: Skeleton, skin: string, ppm = PPM): Part[] {
  const g = s.genes,
    F = m.face,
    hw = (g.head * g.headWidth) / 2,
    hd = (g.head * g.headDepth) / 2,
    h = g.head
  const z = (u: number) => hd * (g.faceAhead + u)
  const part = (o: Superquadric) => box(J.head, skin, GROUP.head, o, { seam: FACE_SEAM })
  const parts: Part[] = [
    { bone: J.head, material: skin, group: GROUP.head, mesh: headMesh(headForm(m, s)), seam: FACE_SEAM },
    // The nose: the bridge rising from below the brow, set back, sloping out to the ball and wings over the lips (its tip
    // two or three texels proud of the face at the judged size).
    part({
      at: [0, h * 0.36, z(0.86)],
      r: [hw * 0.09, h * 0.1, hd * 0.08],
      e: [0.6, 0.7],
      taper: [1.5, 0.7],
      shear: [0, (-lerp(0.08, 0.16, F.bridge) * hd) / (h * 0.1)],
      seg: 8,
      rings: 5,
    }),
    part({
      at: [0, h * 0.265, z(0.97 + 0.08 * F.bridge)],
      r: [hw * lerp(0.13, 0.22, F.nose), h * 0.06, hd * 0.13],
      e: [0.7, 0.7],
      seg: 8,
      rings: 5,
    }),
  ]
  for (const [side, x] of sides) {
    const e = ear(m, s, x),
      [ry, rz] = e.r,
      turn = compose(axisAngle([0, 1, 0], -x * e.flare), e.c)
    // In the ear's own plane (y up, z along the head, its back flared out): a point round its outline at angle `a` (0
    // the top, + toward the back), `w` of the way out to it, `out` off the plane.
    const rim = (a: number, w: number, out: number): V3 =>
      apply(turn, [x * out, Math.cos(a) * ry * w, -Math.sin(a) * rz * w])
    // The bowl: a thin plate on the head; the rim a whole texel thick at the drawing's density, standing proud of it,
    // so its crevice shows at any density.
    const rimR = texels(0.13 * hw, ppm) / 2
    parts.push({
      bone: J.head,
      material: `${earSkin(skin)}~bowl`,
      group: GROUP.head,
      seam: BOWL[side],
      mesh: superquadric({
        at: rim(0, 0, hw * 0.045),
        r: [hw * 0.045, ry * 0.9, rz * 0.88],
        e: [0.7, 0.7],
        seg: 10,
        rings: 6,
        turn: axisAngle([0, 1, 0], -x * e.flare),
      }),
    })
    // The rim: from over the opening at the front, round the top and down the back, to the lobe, fuller there.
    const path: V3[] = []
    for (let q = 0; q <= 14; q++) path.push(rim(lerp(-0.9, Math.PI + 0.35, q / 14), 0.8, hw * 0.075 + rimR))
    parts.push({
      bone: J.head,
      material: earSkin(skin),
      group: GROUP.head,
      seam: EAR[side],
      mesh: sweep(path, { r: rimR / hw, flat: 1, tip: 'round', root: 0.1, taper: 1.35 }, hw, (p) =>
        sub(p, e.c),
      ).mesh,
    })
  }
  return parts
}
/**
 * A hand as it hangs: the palm turned to the thigh, the fingers curled into it, the thumb standing off its front, so
 * it reads as a loose fist with a thumb (not a mitten) from the side and as a slim hand from the front. Its breadth is
 * the wrist's it hangs from (`w`, the wrist's radii across and front to back, so a thick pixel-build arm gets a hand to
 * match): the palm about 1.4 times the wrist across at the knuckles and a little flatter than it, so the wrist always
 * reads as a notch between forearm and hand; its length is the hands slider's (`u`, metres per unit). `x` the side (+1
 * left).
 */
function hands(
  bone: number,
  material: string,
  group: number,
  x: number,
  u: number,
  w: [number, number],
): Part[] {
  // Turned a little so the back of the hand faces forward of the thigh, as a relaxed arm hangs: it shows width from the front.
  const turn = axisAngle([0, 1, 0], -x * 0.22),
    [wx, wz] = w
  // The knuckles' half-breadth and the hand's half-thickness, from the wrist's: a hand nearly half again as broad as its wrist.
  const B = 1.45 * wz,
    T = 0.9 * wx
  return [
    // The back of the hand and the palm, flaring from the wrist's breadth (its top) to the knuckles' (its foot).
    box(bone, material, group, {
      at: [x * 0.12 * wx, -0.036 * u, -0.06 * wz],
      r: [T, 0.036 * u, B],
      e: [0.45, 0.6],
      taper: [1, 0.68],
    }),
    // The fingers, curled in toward the palm, narrower than the knuckles and set back from the palm's front and in from
    // its back: the fist's contour steps at the knuckle row, front and back.
    box(bone, material, group, {
      at: [-x * 0.2 * wx, -0.085 * u, -0.25 * wz],
      r: [0.8 * T, 0.027 * u, 0.86 * B],
      e: [0.7, 0.75],
      turn: axisAngle([0, 0, 1], -x * 0.4),
    }),
    // The thumb: off the heel of the hand, standing proud of the palm's front in its top half with its tip turned
    // forward, so it breaks the hand's contour as a nub (a texel at the sprite's size) and its own crevice notches it.
    box(
      bone,
      material,
      group,
      {
        at: [-x * 0.35 * wx, -0.045 * u, B + 0.2 * wz],
        r: [0.55 * wx, 0.03 * u, 0.5 * wz],
        e: [0.8, 0.8],
        seg: 8,
        rings: 5,
        turn: axisAngle([1, 0, 0], -0.35),
      },
      { seam: THUMB[x > 0 ? 'L' : 'R'] },
    ),
  ].map((p) => ({ ...p, mesh: placed(p.mesh, [0, 0, 0], turn) }))
}
/** A bare foot on the foot bone, where no shoe is worn: lower and narrower than a shoe, from a round heel over a low
 * instep to the toes, flat on the floor with no sole, in the skin (one surface with the leg). */
function bareFoot(
  bone: number,
  skin: string,
  group: number,
  k: number,
  fw: number,
  foot: number,
  ankle: number,
): Part[] {
  const floor = -ankle,
    base = floor + 0.004 * k
  const key = (z: number, high: number, wide: number) => ({
    y: z * foot * 0.92,
    rx: wide * k * fw,
    rz: high * k * fw,
    dz: -(base + high * k * fw),
  })
  const mesh = limb({
    seg: 12,
    caps: [0.04 * foot, 0.03 * foot],
    e: 0.8,
    rings: [
      key(0.66, 0.012, 0.03),
      key(0.5, 0.016, 0.034),
      key(0.26, 0.026, 0.031),
      key(0.02, 0.036, 0.026),
      key(-0.14, 0.03, 0.024),
    ],
  })
  return [{ bone, material: skin, group, mesh: placed(mesh, [0, 0, 0], axisAngle([1, 0, 0], Math.PI / 2)) }]
}
/** A shoe on the foot bone: one profile from the heel along to the toe (heights off the floor `ankle` below the joint),
 * and its sole (shoe.ts: a `form` shapes the sole and lifts the upper's bottom; a shaft's shoe is one surface with it, `seam`). `fw` the build's foot factor, `foot` its length. */
function shoe(
  bone: number,
  upper: string,
  soleMaterial: string,
  group: number,
  k: number,
  fw: number,
  foot: number,
  ankle: number,
  form?: ShoeForm,
  seam?: number,
): Part[] {
  const own = seam === undefined ? {} : { seam }
  return [
    { bone, material: upper, group, mesh: upperMesh(k, fw, foot, ankle, form), ...own },
    { ...sole(bone, soleMaterial, group, k, fw, foot, ankle, form), ...own },
  ]
}
