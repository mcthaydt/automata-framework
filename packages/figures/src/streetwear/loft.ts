// The loft, streetwear's one primitive for shells, sleeves, legs and shoes: sections along an axis, swelled
// by a bump (quilting, ribs, folds, a stacked break), shifted along it (a hem riding up over a shoe), open
// over an arc (a pocket, a lens) or closed at both ends. And the questions a garment asks of a shell it lies
// on: where its front is at (x, y), how wide it is, where its top is over x.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/streetwear.ts at a1f7246
// (`Section`, `Loft`, `loft`, `Shell`, `frontOf`, `widthOf`, `topAt`, `angleAt`, `sectionZ`, `quadricZ`,
// `torus`), with AF's strict types; the formulas and their order are the source's. Not taken: `backOf`
// (nothing builds with it).

import { clamp, cross, dot, lerp, normalize, sub, type V3 } from '../math/math'
import { type Mesh, sgnPow } from '../parts/mesh'
import type { Superquadric } from '../parts/superquadric'
import { at } from '../rig/rig'

/**
 * A section across a loft's axis: its centre and half-widths, and its roundness (1 an ellipse, ~0.4 a rounded
 * box).
 */
export interface Section {
  c: [number, number]
  r: [number, number]
  e?: number
}
export interface Loft {
  /** Rings along the axis and points round each. */
  rings?: number
  seg?: number
  /** Swells the radius at (t, angle): quilting, ribs, folds, a stacked break. */
  bump?: ((t: number, v: number) => number) | undefined
  /** Moves a point along the axis at (t, angle): a hem that rides up over the shoe. */
  shift?: ((t: number, v: number) => number) | undefined
  /**
   * An open patch between two angles (rad) at each t, for a pocket or a lens; closed at both ends otherwise.
   */
  arc?: (t: number) => [number, number]
}

/**
 * A loft along y (a sleeve, a leg, a torso: sections in x and z, angle π/2 the front) or z (a shoe: sections
 * in x and y, π/2 the top), from `from` to `to` as t runs 0 → 1; normals from the surface's own derivatives.
 */
export function loft(
  axis: 'y' | 'z',
  from: number,
  to: number,
  section: (t: number) => Section,
  o: Loft = {},
): Mesh {
  const rings = o.rings ?? 12
  const seg = o.seg ?? 16
  const cols = o.arc ? seg + 1 : seg
  const angle = (t: number, j: number) => {
    if (!o.arc) return -Math.PI + (2 * Math.PI * j) / seg
    const [a, b] = o.arc(t)
    return a + ((b - a) * j) / seg
  }
  const centre = (t: number): V3 => {
    const { c } = section(t)
    const along = lerp(from, to, t)
    return axis === 'y' ? [c[0], along, c[1]] : [c[0], c[1], along]
  }
  const point = (t: number, v: number): V3 => {
    const { c, r, e = 1 } = section(t)
    const b = 1 + (o.bump ? o.bump(t, v) : 0)
    const along = lerp(from, to, t) + (o.shift ? o.shift(t, v) : 0)
    const a = c[0] + sgnPow(Math.cos(v), e) * r[0] * b
    const d = c[1] + sgnPow(Math.sin(v), e) * r[1] * b
    return axis === 'y' ? [a, along, d] : [a, d, along]
  }
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j < cols; j++) {
      const t = i / rings
      const v = angle(t, j)
      const p = point(t, v)
      const eps = 1e-3
      const dt = sub(point(Math.min(1, t + eps), v), point(Math.max(0, t - eps), v))
      const dv = sub(point(t, v + eps), point(t, v - eps))
      let n = normalize(cross(dv, dt))
      if (dot(n, sub(p, centre(t))) < 0) n = [-n[0], -n[1], -n[2]]
      positions.push(...p)
      normals.push(...n)
    }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < (o.arc ? seg : cols); j++) {
      const n = (j + 1) % cols
      const a = i * cols + j
      const b = i * cols + n
      const c = (i + 1) * cols + n
      const d = (i + 1) * cols + j
      indices.push(a, b, c, a, c, d)
    }
  if (!o.arc) {
    // Each end closed at its ring's middle (so a hem the shift lifts at the back closes level with it, not in
    // a cone hanging below it), its normal along the axis.
    const dir = Math.sign(to - from)
    const ax: V3 = axis === 'y' ? [0, 1, 0] : [0, 0, 1]
    for (const [ring, s] of [
      [0, -dir],
      [rings, dir],
    ] as const) {
      const pole = positions.length / 3
      const mid = [0, 0, 0]
      for (let j = 0; j < cols; j++)
        for (let c = 0; c < 3; c++) mid[c] = at(mid, c) + at(positions, (ring * cols + j) * 3 + c) / cols
      positions.push(...mid)
      normals.push(ax[0] * s, ax[1] * s, ax[2] * s)
      for (let j = 0; j < cols; j++) indices.push(pole, ring * cols + j, ring * cols + ((j + 1) % cols))
    }
  }
  return { positions, normals, indices }
}

/** A shell's description in rest figure space, so a chain or a zip can lie on it. */
export interface Shell {
  from: number
  to: number
  section: (t: number) => Section
  bump?: ((t: number, v: number) => number) | undefined
  /** Where it is open (a jacket's V). */
  open?: (x: number, y: number) => boolean
}
/** A shell's front surface (z) at (x, y), or null above or below it; `back` its back surface instead. */
export function frontOf(sh: Shell, x: number, y: number, back = false): number | null {
  const t = (y - sh.from) / (sh.to - sh.from)
  if (t < 0 || t > 1) return null
  const { c, r, e = 1 } = sh.section(t)
  let best = Infinity
  let z: number | null = null
  for (let i = 0; i <= 64; i++) {
    const v = ((back ? -1 : 1) * Math.PI * i) / 64
    const b = 1 + (sh.bump?.(t, v) ?? 0)
    const px = c[0] + sgnPow(Math.cos(v), e) * r[0] * b
    if (Math.abs(px - x) < best) {
      best = Math.abs(px - x)
      z = c[1] + sgnPow(Math.sin(v), e) * r[1] * b
    }
  }
  return z
}
/** A shell's half-width at height y (its widest across, folds allowed), or 0 outside it. */
export function widthOf(sh: Shell, y: number): number {
  const t = (y - sh.from) / (sh.to - sh.from)
  if (t < 0 || t > 1) return 0
  const { c, r } = sh.section(t)
  return Math.abs(c[0]) + r[0] * (1 + Math.max(sh.bump?.(t, 0) ?? 0, sh.bump?.(t, Math.PI) ?? 0))
}
/**
 * The height of a shell's top over x: the highest it reaches out that far (the shoulder's line, for a strap
 * on it).
 */
export function topAt(sh: Shell, x: number): number {
  let lo = sh.to
  let hi = sh.from
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (widthOf(sh, mid) >= Math.abs(x)) lo = mid
    else hi = mid
  }
  return lo
}
/** The angle on a section where its front reaches x (for a patch's edges). */
export const angleAt = (sec: Section, x: number): number =>
  Math.acos(clamp(sgnPow(clamp((x - sec.c[0]) / sec.r[0], -1, 1), 1 / (sec.e ?? 1)), -1, 1))
/** A section's surface at x on its front (or back), or null off it. */
export function sectionZ(sec: Section, x: number, back = false): number | null {
  const e = sec.e ?? 1
  const u = Math.abs(x - sec.c[0]) / sec.r[0]
  return u >= 1 ? null : sec.c[1] + (back ? -1 : 1) * sec.r[1] * (1 - u ** (2 / e)) ** (e / 2)
}
/** A superquadric's surface at (x, y) on its front (or back), or null off it. */
export function quadricZ(q: Superquadric, x: number, y: number, back = false): number | null {
  const [rx, ry, rz] = q.r
  const [e1, e2] = q.e ?? [1, 1]
  const [t0, t1] = q.taper ?? [1, 1]
  const u = (y - q.at[1]) / ry
  if (Math.abs(u) >= 1) return null
  const ring = (1 - Math.abs(u) ** (2 / e1)) ** (e1 / 2)
  const tk = lerp(t0, t1, (u + 1) / 2)
  return sectionZ({ c: [q.at[0], q.at[2]], r: [ring * rx * tk, ring * rz * tk], e: e2 }, x, back)
}
/** A torus in the x–y plane round the origin (a hoop). */
export function torus(R: number, r: number, seg = 18, sides = 6): Mesh {
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < sides; j++) {
      const a = (2 * Math.PI * i) / seg
      const b = (2 * Math.PI * j) / sides
      const n: V3 = [Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)]
      positions.push(
        (R + r * Math.cos(b)) * Math.cos(a),
        (R + r * Math.cos(b)) * Math.sin(a),
        r * Math.sin(b),
      )
      normals.push(...n)
      const p = i * sides + j
      const q = ((i + 1) % seg) * sides + j
      const pn = i * sides + ((j + 1) % sides)
      const qn = ((i + 1) % seg) * sides + ((j + 1) % sides)
      indices.push(p, q, qn, p, qn, pn)
    }
  return { positions, normals, indices }
}
