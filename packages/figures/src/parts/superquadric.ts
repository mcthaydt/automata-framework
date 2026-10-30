// The kit's two parametric primitives: a tapered superquadric (heads' features, hands, shoes' soles, boxes,
// buttons) and an open tube (skirts, coat tails, capes), each with smooth normals from the surface's own
// derivatives, so tapers and rounded boxes shade as one form.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/parts.ts at a1f7246
// (`superquadric`, `tube`), with AF's strict types; the formulas and their order are the source's.

import {
  apply,
  applyDir,
  compose,
  cross,
  dot,
  IDENTITY_Q,
  lerp,
  normalize,
  type Q,
  sub,
  type V3,
} from '../math/math'
import { at } from '../rig/rig'
import { type Mesh, sgnPow } from './mesh'

export interface Superquadric {
  /**
   * Centre and radii in the part's space (before `turn`), roundness (1 a sphere, ~0.3 a rounded box) along
   * latitude and longitude.
   */
  at: V3
  r: V3
  e?: [number, number]
  /** Scales x and z from the bottom (−y) to the top (+y), for limbs that narrow. */
  taper?: [number, number]
  /**
   * Shift x and z by this much per unit of height (from −1 at the bottom to +1 at the top), for a slanted
   * shape.
   */
  shear?: [number, number]
  turn?: Q
  seg?: number
  rings?: number
  /** Keep only the triangles whose centroid (in the primitive's own unit space, before taper) passes. */
  keep?: (x: number, y: number, z: number) => boolean
}

/**
 * A tapered superquadric with normals from the surface's own derivatives, so tapers and rounded boxes shade
 * smoothly.
 */
export function superquadric(o: Superquadric): Mesh {
  const [rx, ry, rz] = o.r
  const [e1, e2] = o.e ?? [1, 1]
  const [t0, t1] = o.taper ?? [1, 1]
  const [hx, hz] = o.shear ?? [0, 0]
  const seg = o.seg ?? 10
  const rings = o.rings ?? 7
  const turn = o.turn ?? IDENTITY_Q
  const m = compose(turn, o.at)
  const unit = (u: number, v: number): V3 => [
    sgnPow(Math.cos(u), e1) * sgnPow(Math.cos(v), e2),
    sgnPow(Math.sin(u), e1),
    sgnPow(Math.cos(u), e1) * sgnPow(Math.sin(v), e2),
  ]
  const local = (u: number, v: number): V3 => {
    const [x, y, z] = unit(u, v)
    const k = lerp(t0, t1, (y + 1) / 2)
    return [x * rx * k + hx * y * ry, y * ry, z * rz * k + hz * y * ry]
  }
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const grid: number[][] = []
  for (let i = 0; i <= rings; i++) {
    const u = -Math.PI / 2 + (Math.PI * i) / rings
    const row: number[] = []
    for (let j = 0; j < seg; j++) {
      const v = -Math.PI + (2 * Math.PI * j) / seg
      const p = local(u, v)
      // Normals: the cross product of the surface's tangents, taken just inside the poles so it never
      // degenerates.
      const uu = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, u))
      const eps = 1e-3
      const du = sub(local(uu + eps, v), local(uu - eps, v))
      const dv = sub(local(uu, v + eps), local(uu, v - eps))
      let n = normalize(cross(dv, du))
      const outward = sub(local(uu, v), [hx * Math.sin(uu) * ry, 0, hz * Math.sin(uu) * ry])
      if (dot(n, outward) < 0) n = [-n[0], -n[1], -n[2]]
      row.push(positions.length / 3)
      positions.push(...apply(m, p))
      normals.push(...normalize(applyDir(m, n)))
    }
    grid.push(row)
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const here = at(grid, i)
      const next = at(grid, i + 1)
      const a = at(here, j)
      const b = at(here, (j + 1) % seg)
      const c = at(next, (j + 1) % seg)
      const d = at(next, j)
      for (const tri of [
        [a, b, c],
        [a, c, d],
      ]) {
        if (o.keep) {
          const u = -Math.PI / 2 + (Math.PI * (i + 0.5)) / rings
          const v = -Math.PI + (2 * Math.PI * (j + 0.5)) / seg
          const [x, y, z] = unit(u, v)
          if (!o.keep(x, y, z)) continue
        }
        indices.push(...tri)
      }
    }
  return { positions, normals, indices }
}

export interface TubeOptions {
  seg?: number
  rings?: number
  belly?: number
  x?: number
  arc?: [number, number] | undefined
  folds?: [count: number, depth: number] | undefined
}

/**
 * An open tube from `top` to `bottom` (each [y, radius x, radius z, centre z]), bulging by `belly` at its
 * middle: a skirt. `arc` keeps only the angles between its two ends (rad; π/2 is the front), for an apron's
 * front or a cape open at the front.
 */
export function tube(
  top: [number, number, number, number],
  bottom: [number, number, number, number],
  o: TubeOptions = {},
): Mesh {
  const rings = o.rings ?? 5
  const belly = o.belly ?? 0
  const cx = o.x ?? 0
  const arc = o.arc
  const seg = o.seg ?? 14
  const cols = arc ? seg + 1 : seg
  const angle = (j: number) => (arc ? arc[0] + ((arc[1] - arc[0]) * j) / seg : (2 * Math.PI * j) / seg)
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const point = (k: number, v: number): V3 => {
    // Folds: a ripple round the hem that fades toward the top, so the bands make vertical folds in the cloth.
    const y = lerp(top[0], bottom[0], k)
    const b =
      (1 + belly * Math.sin(Math.PI * k)) * (1 + (o.folds ? o.folds[1] * k * Math.sin(o.folds[0] * v) : 0))
    return [
      cx + Math.cos(v) * lerp(top[1], bottom[1], k) * b,
      y,
      lerp(top[3], bottom[3], k) + Math.sin(v) * lerp(top[2], bottom[2], k) * b,
    ]
  }
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j < cols; j++) {
      const k = i / rings
      const v = angle(j)
      const p = point(k, v)
      const eps = 1e-3
      const dk = sub(point(Math.min(1, k + eps), v), point(Math.max(0, k - eps), v))
      const dv = sub(point(k, v + eps), point(k, v - eps))
      let n = normalize(cross(dv, dk))
      if (dot(n, [Math.cos(v), 0, Math.sin(v)]) < 0) n = [-n[0], -n[1], -n[2]]
      positions.push(...p)
      normals.push(...n)
    }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const n = (j + 1) % cols
      const a = i * cols + j
      const b = i * cols + n
      const c = (i + 1) * cols + n
      const d = (i + 1) * cols + j
      indices.push(a, b, c, a, c, d)
    }
  return { positions, normals, indices }
}
