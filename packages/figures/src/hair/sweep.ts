// The hair's meshes: a grid of points into a mesh, a smooth path through control points, and `sweep`, a tube
// along a path whose section turns its depth to face out (a rope, a braid, a lock, a quiff, an ear's rim, a
// hood's roll). A rope's texture is its own shape: beads along it (a plait), ridges, and the cells the lit
// tone takes split into a second mesh (`lit`), so the plait's V and a lock's streaks are geometry, drawn a
// tone up.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`grid`,
// `spline`, `spindle`, `sweep`), with AF's strict types; the formulas and their order are the source's.

import type { Rope } from '../library/hair.schema'
import { add, clamp, cross, dot, hash, lerp, normalize, scale, sub, type V3 } from '../math/math'
import { type Mesh, sgnPow } from '../parts/mesh'
import { at } from '../rig/rig'

/** A lit streak's width along it (`u` 0 its root … 1 its tip, 0 outside): a spindle, full a little root-ward
 * of its middle and tapering to a point at either end, as a pixel artist draws a strand's shine, never a bar.
 */
export const spindle = (u: number): number => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u ** 0.8) ** 0.6)

/**
 * A grid of points into a mesh: normals from its neighbours, turned away from `inner` (a point, per row,
 * inside it).
 */
export function grid(
  rows: number,
  cols: number,
  point: (i: number, j: number) => V3,
  wrap: boolean,
  inner: (i: number) => V3,
  skip?: (i: number, j: number) => boolean,
): Mesh {
  const P: V3[][] = []
  for (let i = 0; i <= rows; i++) {
    const row: V3[] = []
    for (let j = 0; j < cols; j++) row.push(point(i, j))
    P.push(row)
  }
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const get = (i: number, j: number) =>
    at(at(P, clamp(i, 0, rows)), wrap ? (j + cols) % cols : clamp(j, 0, cols - 1))
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j < cols; j++) {
      // A pole (a row pinched to a point) takes its tangent from the row beside it.
      const du = sub(get(i + 1, j), get(i - 1, j))
      let dv = sub(get(i, j + 1), get(i, j - 1))
      if (Math.hypot(...dv) < 1e-7) dv = sub(get(i === 0 ? 1 : i - 1, j + 1), get(i === 0 ? 1 : i - 1, j - 1))
      let n = normalize(cross(dv, du))
      const p = at(at(P, i), j)
      if (dot(n, sub(p, inner(i))) < 0) n = scale(n, -1)
      positions.push(...p)
      normals.push(...n)
    }
  const id = (i: number, j: number) => i * cols + (wrap ? j % cols : j)
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < (wrap ? cols : cols - 1); j++) {
      if (skip?.(i, j)) continue
      indices.push(id(i, j), id(i, j + 1), id(i + 1, j + 1), id(i, j), id(i + 1, j + 1), id(i + 1, j))
    }
  return { positions, normals, indices }
}

/**
 * A smooth path through control points (Catmull-Rom), resampled to `n + 1` points evenly along its length.
 */
export function spline(points: readonly V3[], n: number): V3[] {
  const first = at(points, 0)
  const last = at(points, points.length - 1)
  const pts = [first, ...points, last]
  const dense: V3[] = []
  for (let s = 1; s < pts.length - 2; s++)
    for (let i = 0; i < 24; i++) {
      const t = i / 24
      const p0 = at(pts, s - 1)
      const p1 = at(pts, s)
      const p2 = at(pts, s + 1)
      const p3 = at(pts, s + 2)
      const t2 = t * t
      const t3 = t2 * t
      const c = (k: 0 | 1 | 2) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
      dense.push([c(0), c(1), c(2)])
    }
  dense.push(last)
  const len = [0]
  for (let i = 1; i < dense.length; i++)
    len.push(at(len, i - 1) + Math.hypot(...sub(at(dense, i), at(dense, i - 1))))
  const out: V3[] = []
  const total = at(len, len.length - 1) || 1
  for (let i = 0, d = 0; i <= n; i++) {
    const want = (total * i) / n
    while (d < dense.length - 2 && at(len, d + 1) < want) d++
    const k = (want - at(len, d)) / (at(len, d + 1) - at(len, d) || 1)
    const a = at(dense, d)
    const b = at(dense, d + 1)
    const u = clamp(k, 0, 1)
    out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)])
  }
  return out
}

export interface Swept {
  mesh: Mesh
  /** The cells in the lit tone (a plait's upper halves, a lock's streaks), or none. */
  lit: Mesh | undefined
  /** Each vertex's share of the way along. */
  t: number[]
}

/**
 * A tube along a path, its section an (super)ellipse `a` across and `b` deep (metres, scaled along it by the
 * rope's ends), turned so its depth faces `out` at each point.
 */
export function sweep(
  path: readonly V3[],
  rope: Rope,
  unit: number,
  out: (p: V3, t: number) => V3,
  rings = 0,
): Swept {
  const total = path.reduce((l, p, i) => (i ? l + Math.hypot(...sub(p, at(path, i - 1))) : 0), 0)
  const a0 = rope.r * unit
  const b0 = a0 * (rope.flat ?? 1)
  const e = rope.e ?? 1
  const depth = rope.depth ?? 0.25
  const beads = rope.pitch ? Math.max(2, Math.round(total / (rope.pitch * unit))) : (rope.beads ?? 0)
  const n = rings || Math.max(8, Math.ceil(total / (a0 * 0.5)), beads * 6)
  const seg = rope.seg ?? 10
  const P = spline(path, n)
  const T = P.map((_, i) => normalize(sub(at(P, Math.min(n, i + 1)), at(P, Math.max(0, i - 1)))))
  const root = rope.root ?? 0.06
  const tip = rope.tip ?? 'round'
  const taper = rope.taper ?? 1
  const tipLen =
    tip === 'point'
      ? 0.25
      : tip === 'round'
        ? Math.min(0.5, a0 / (total || 1))
        : Math.min(0.5, (a0 * 0.15) / (total || 1))
  const profile = (t: number) => {
    const r = t < root ? Math.sqrt(1 - (1 - t / root) ** 2) : 1
    const q = (t - (1 - tipLen)) / tipLen
    const end = q <= 0 ? 1 : tip === 'point' ? (1 - q) ** 1.3 : Math.sqrt(Math.max(0, 1 - q * q))
    return r * end * lerp(1, taper, t)
  }
  const frame = (i: number) => {
    const t = at(T, i)
    const o = out(at(P, i), i / n)
    const N = normalize(sub(o, scale(t, dot(o, t))))
    const B = cross(t, N)
    return { N, B }
  }
  const F = P.map((_, i) => frame(i))
  // The beads' count along it at (t, θ): its phase, and its slant across the face its depth turns to (cos θ
  // runs across it).
  const phase = rope.phase ?? 0
  const slant = rope.slant ?? 0
  const bead = (t: number, th: number) => beads * t + phase - slant * 0.5 * Math.cos(th)
  const point = (i: number, j: number): V3 => {
    const t = i / n
    const th = (2 * Math.PI * j) / seg
    const f = profile(t)
    let m = 1
    if (beads)
      m +=
        depth *
        (rope.twist
          ? Math.cos(2 * Math.PI * beads * t - rope.twist * th)
          : 2 * Math.abs(Math.sin(Math.PI * bead(t, th))) ** 0.7 - 1)
    if (rope.ridges) m += rope.ridges[1] * Math.cos(rope.ridges[0] * th)
    const c = sgnPow(Math.cos(th), e) * a0 * f * m
    const s = sgnPow(Math.sin(th), e) * b0 * f * m
    const { N, B } = at(F, i)
    return add(at(P, i), add(scale(B, c), scale(N, s)))
  }
  // The plait: the upper half of every bead lit, its edge a V down the middle, so the light runs down the
  // rope in chevrons.
  const plait = beads && rope.plait !== false ? (rope.plait ?? 0.35) : null
  const streaks = rope.streaks
  let lit: ((i: number, j: number) => boolean) | undefined
  if (plait !== null)
    lit = (i, j) => {
      const th = (2 * Math.PI * (j + 0.5)) / seg
      const b = bead((i + 0.5) / n, th) - (slant ? 0 : plait * (1 - Math.abs(Math.cos(th))))
      return b - Math.floor(b) < 0.5
    }
  else if (streaks) {
    const count = at(streaks, 0)
    const from = at(streaks, 1)
    const to = at(streaks, 2)
    const width = streaks[3] ?? 0.34
    lit = (i, j) => {
      // Across the outer face (θ from 0 to π), `count` streaks evenly, each up to `width` of its share either
      // side, tapering to points along the rope (spindle).
      const th = (2 * Math.PI * (j + 0.5)) / seg
      const q = (th / Math.PI) * count - 0.5
      const near = Math.round(q)
      const t = (i + 0.5) / n
      const r = (hash(near * 31 + 7) - 0.5) * 0.25
      const lo = from + r
      const hi = to + r
      return th < Math.PI && Math.abs(q - near) < width * spindle((t - lo) / (hi - lo))
    }
  }
  const mesh = grid(n, seg, point, true, (i) => at(P, i), lit)
  const ts: number[] = []
  for (let i = 0; i <= n; i++) for (let j = 0; j < seg; j++) ts.push(i / n)
  const litMesh =
    lit &&
    grid(
      n,
      seg,
      point,
      true,
      (i) => at(P, i),
      (i, j) => !lit(i, j),
    )
  return { mesh, lit: litMesh, t: ts }
}
