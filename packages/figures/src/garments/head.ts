// The head: its form (the chin, the jaw rising back under the ear, the cheekbones, the eyes set in under the
// brow, a forehead and a round cranium), the skin over it as one smooth surface, a nose standing off the face
// and an ear each side. Hair and caps fit this same form (hair/).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`curve`,
// `HeadForm`, `faceRound`, `headAt`, `insideHead`, `headNormal`, `headMesh`, `headForm`, `ear`, `head`), with
// AF's strict types; the formulas and their order are the source's. Changed: the ears' painter materials (the
// skin's tones by hand) are variants of the skin (build/materials.ts), and the rim's texel width is held at
// the fixed ppm (parts/texels.ts).

import type { Made } from '../build/materials'
import { variant } from '../build/materials'
import type { Measure } from '../genes/genes'
import { sweep } from '../hair/sweep'
import { apply, axisAngle, compose, cross, dot, lerp, normalize, smooth, sub, type V3 } from '../math/math'
import { GROUP, type Mesh, type Part } from '../parts/mesh'
import { type Superquadric, superquadric } from '../parts/superquadric'
import { texels } from '../parts/texels'
import { at, J, type Skeleton } from '../rig/rig'
import { box } from './locks'

/** The face's surface: the head's skin and nose are one, so no line is drawn inside it. */
export const FACE_SEAM = 1000
/** The ears' surfaces: each its own, its rim against its bowl and the head behind it. */
const EAR = { L: 1001, R: 1002 } as const
const BOWL = { L: 1003, R: 1004 } as const
export const SIDES = [
  ['L', 1],
  ['R', -1],
] as const

/** A smooth curve through (t, value) keys (Catmull-Rom, t ascending), held flat past either end. */
function curve(keys: readonly (readonly [number, number])[]): (t: number) => number {
  return (t) => {
    let i = 0
    while (i < keys.length - 2 && t > at(keys, i + 1)[0]) i++
    const [t1, v1] = at(keys, i)
    const [t2, v2] = at(keys, i + 1)
    const [t0, v0] = at(keys, Math.max(0, i - 1))
    const [t3, v3] = at(keys, Math.min(keys.length - 1, i + 2))
    const u = Math.max(0, Math.min(1, (t - t1) / (t2 - t1)))
    const dt = t2 - t1
    const m1 = ((v2 - v0) / Math.max(1e-6, t2 - t0)) * dt
    const m2 = ((v3 - v1) / Math.max(1e-6, t3 - t1)) * dt
    return (
      (2 * u ** 3 - 3 * u ** 2 + 1) * v1 +
      (u ** 3 - 2 * u ** 2 + u) * m1 +
      (-2 * u ** 3 + 3 * u ** 2) * v2 +
      (u ** 3 - u ** 2) * m2
    )
  }
}

/**
 * A head's form: its half-width and its front and back at each height t (0 the chin's point … 1 the crown's),
 * `h` tall; each section a superellipse, its front half a little squarer than its back (a face's planes
 * before a round skull), rounding again over the cranium. One form for the head's skin and for whatever hugs
 * it (a fade, a sleek shell).
 */
export interface HeadForm {
  h: number
  width: (t: number) => number
  front: (t: number) => number
  back: (t: number) => number
}
/** The front half's roundness at height t: under the eyes a rounded wedge, from the eyes up full, over the
 * cranium round again. The back half is an ellipse. */
export const faceRound = (t: number): number =>
  lerp(lerp(1.3, 0.88, smooth((t - 0.32) / 0.1)), 1, smooth((t - 0.7) / 0.24))
/**
 * The point on the head's form at height `t` and angle `v` round its section (π/2 the front, 0 the figure's
 * left).
 */
export function headAt(f: HeadForm, t: number, v: number): V3 {
  const pow = (x: number, e: number) => Math.sign(x) * Math.abs(x) ** e
  const fr = f.front(t)
  const b = f.back(t)
  const c = Math.cos(v)
  const sn = Math.sin(v)
  const e = sn > 0 ? faceRound(t) : 1
  return [Math.max(0, f.width(t)) * pow(c, e), t * f.h, (fr + b) / 2 + ((fr - b) / 2) * pow(sn, e)]
}
/** Whether a point (the head's space) lies inside its form: what hair and a cap are fitted round. */
export function insideHead(f: HeadForm, p: V3): boolean {
  const t = p[1] / f.h
  if (t <= 0 || t >= 1) return false
  const W = f.width(t)
  const fr = f.front(t)
  const b = f.back(t)
  const H = (fr - b) / 2
  const dz = p[2] - (fr + b) / 2
  const e = dz > 0 ? faceRound(t) : 1
  return W > 0 && H > 0 && Math.abs(p[0] / W) ** (2 / e) + Math.abs(dz / H) ** (2 / e) < 1
}
/** The form's outward normal at (t, v), from its own derivatives. */
export function headNormal(f: HeadForm, t: number, v: number): V3 {
  const tt = Math.max(0.004, Math.min(0.996, t))
  const eps = 1e-3
  const p = headAt(f, tt, v)
  const n = normalize(
    cross(
      sub(headAt(f, tt, v + eps), headAt(f, tt, v - eps)),
      sub(headAt(f, tt + eps, v), headAt(f, tt - eps, v)),
    ),
  )
  return dot(n, [p[0], 0, p[2] - (f.front(tt) + f.back(tt)) / 2]) < 0 ? [-n[0], -n[1], -n[2]] : n
}
/** A head's skin as one smooth surface: its form's sections, normals from the surface's own derivatives. */
function headMesh(f: HeadForm, rings = 22, seg = 20): Mesh {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j < seg; j++) {
      const t = i / rings
      const v = (2 * Math.PI * j) / seg
      positions.push(...headAt(f, t, v))
      normals.push(...headNormal(f, t, v))
    }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j
      const b = i * seg + ((j + 1) % seg)
      const c = (i + 1) * seg + ((j + 1) % seg)
      const d = (i + 1) * seg + j
      indices.push(a, c, b, a, d, c)
    }
  return { positions, normals, indices }
}

/**
 * The head's form, every size from its genes and its shape from the head's structure (genes.ts HeadShape):
 * the chin, the jaw's underside rising back to its angle under the ear, the cheekbones at their height, the
 * eyes a little set in under the brow, a forehead, and a cranium round and full behind the ears, tapering
 * over the parietals to the crown, its back well behind the neck.
 */
export function headForm(m: Measure, s: Skeleton): HeadForm {
  const g = s.genes
  const F = m.face
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
  // Depths in half-depths: `z` from the face's set (genes.faceAhead; the face's front at 1), `back` from the
  // cranium's.
  const z = (u: number) => hd * (g.faceAhead + u)
  const back = (u: number) => hd * (g.faceAhead * 0.5 + u)
  const chin = lerp(0.22, 0.34, F.chin)
  const jaw = lerp(0.6, 0.84, F.jaw)
  const cheek = lerp(0.88, 1, F.cheekWidth)
  const cheekT = lerp(0.34, 0.44, F.cheekHeight)
  const width = curve(
    (
      [
        [0, 0],
        [0.03, chin * 0.8],
        [0.08, chin],
        [0.14, lerp(chin, jaw, 0.6)],
        [0.21, jaw],
        [0.29, lerp(0.84, 0.94, F.width)],
        [cheekT, cheek],
        [0.5, 0.95],
        [0.62, 0.97],
        [0.72, 0.95],
        [0.82, 0.87],
        [0.9, 0.7],
        [0.96, 0.44],
        [1, 0],
      ] as const
    ).map(([t, w]): [number, number] => [t, w * hw]),
  )
  const crown = (z(0.22) + back(-0.45)) / 2
  const point = z(0.7) - 0.04 * hd * F.chin
  // The profile: the chin, the hollow under the lower lip, the lips, the philtrum, the eyes set in, the brow,
  // the forehead.
  const front = curve([
    [0, point],
    [0.03, z(0.9)],
    [0.07, z(0.95 + 0.04 * F.chin)],
    [0.11, z(0.93)],
    [0.15, z(0.98 + 0.04 * F.lips)],
    [0.19, z(0.99 + 0.04 * F.lips)],
    [0.24, z(0.97)],
    [0.32, z(0.99)],
    [0.42, z(0.97)],
    [0.48, z(0.92)],
    [0.56, z(0.98)],
    [0.68, z(0.94)],
    [0.8, z(0.8)],
    [0.9, z(0.55)],
    [0.97, z(0.22)],
    [1, crown],
  ])
  const backOf = curve([
    [0, point],
    [0.04, z(0.5)],
    [0.1, z(0.1)],
    [0.18, back(-0.3)],
    [0.26, back(-0.62)],
    [0.36, back(-0.86)],
    [0.5, back(-0.98)],
    [0.62, back(-1.04)],
    [0.74, back(-1.02)],
    [0.84, back(-0.9)],
    [0.92, back(-0.68)],
    [0.97, back(-0.42)],
    [1, crown],
  ])
  return { h, width, front, back: backOf }
}

/**
 * An ear's place on the head: its centre, its half-height and half-depth, how far its back flares, its lobe.
 */
export interface Ear {
  c: V3
  r: [number, number]
  flare: number
  lobe: V3
}
/**
 * An ear (`x` the side, +1 the figure's left), in the head's space, from its height on the head (the brow's
 * line to the nose's foot) and the cranium's depth: its centre, its half-height and half-depth, and the lobe
 * (where a hoop or a stud hangs from). It stands off the side of the head, flaring at its back.
 */
export function ear(m: Measure, s: Skeleton, x: number): Ear {
  const g = s.genes
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
  const f = headForm(m, s)
  const t = 0.43
  const zc = hd * (g.faceAhead * 0.5 - 0.1)
  const mid = (f.front(t) + f.back(t)) / 2
  const half = (f.front(t) - f.back(t)) / 2
  // Its root on the head's side at that depth; the lobe at the rim's foot.
  const side = f.width(t) * Math.sqrt(Math.max(0, 1 - ((zc - mid) / half) ** 2))
  const c: V3 = [x * side, h * t, zc]
  const r: [number, number] = [h * 0.135, hd * 0.23]
  return { c, r, flare: 0.42, lobe: [x * (side + 0.13 * hw), c[1] - r[0] * 0.85, zc] }
}

/**
 * The head: its skin one smooth surface from chin to crown (headForm), a nose standing off the face and an
 * ear each side. The skin and nose are one surface (FACE_SEAM). Each ear is a bowl (the concha) inside a rim
 * (the helix, from over the opening round the top and down the back to the lobe), the rim standing proud of
 * the bowl.
 */
export function head(m: Measure, s: Skeleton, skin: string, made: Made): Part[] {
  const g = s.genes
  const F = m.face
  const hw = (g.head * g.headWidth) / 2
  const hd = (g.head * g.headDepth) / 2
  const h = g.head
  const z = (u: number) => hd * (g.faceAhead + u)
  const part = (o: Superquadric) => box(J.head, skin, GROUP.head, o, { seam: FACE_SEAM })
  const parts: Part[] = [
    { bone: J.head, material: skin, group: GROUP.head, mesh: headMesh(headForm(m, s)), seam: FACE_SEAM },
    // The nose: the bridge rising from below the brow, set back, sloping out to the ball and wings over the
    // lips.
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
  // The ear's rim is the skin without its gloss, lit by its own form; its bowl the skin in shadow.
  const rimSkin = variant(made, skin, 'ear', { matte: true })
  const bowlSkin = variant(made, skin, 'bowl', { matte: true, shade: -1 })
  for (const [side, x] of SIDES) {
    const e = ear(m, s, x)
    const [ry, rz] = e.r
    const turn = compose(axisAngle([0, 1, 0], -x * e.flare), e.c)
    // In the ear's own plane (y up, z along the head, its back flared out): a point round its outline at
    // angle `a` (0 the top, + toward the back), `w` of the way out to it, `out` off the plane.
    const rim = (a: number, w: number, out: number): V3 =>
      apply(turn, [x * out, Math.cos(a) * ry * w, -Math.sin(a) * rz * w])
    // The bowl: a thin plate on the head; the rim a whole texel thick at the fixed ppm, standing proud of it.
    const rimR = texels(0.13 * hw) / 2
    parts.push({
      bone: J.head,
      material: bowlSkin,
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
    // The rim: from over the opening at the front, round the top and down the back, to the lobe, fuller
    // there.
    const path: V3[] = []
    for (let q = 0; q <= 14; q++) path.push(rim(lerp(-0.9, Math.PI + 0.35, q / 14), 0.8, hw * 0.075 + rimR))
    parts.push({
      bone: J.head,
      material: rimSkin,
      group: GROUP.head,
      seam: EAR[side],
      mesh: sweep(path, { r: rimR / hw, flat: 1, tip: 'round', root: 0.1, taper: 1.35 }, hw, (p) =>
        sub(p, e.c),
      ).mesh,
    })
  }
  return parts
}
