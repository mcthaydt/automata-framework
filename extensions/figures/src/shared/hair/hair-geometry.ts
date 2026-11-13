import { type HeadForm, headAt, headNormal, insideHead } from '../body/head'
import type { Mesh } from '../body/parts'
import type { Skeleton } from '../body/rig'
import {
  add,
  axisAngle,
  clamp,
  cross,
  dot,
  hash,
  lerp,
  normalize,
  scale,
  smooth,
  sub,
  type V3,
} from '../math/math'
import type { Line, Rope, Scalp, Skull } from './hair-types'
export function skull(s: Skeleton): Skull {
  const g = s.genes,
    hw = (g.head * g.headWidth) / 2,
    hd = (g.head * g.headDepth) / 2
  return {
    c: [0, g.head * 0.5, hd * (g.faceAhead - 0.15)],
    r: [hw * 1.04, g.head * 0.5, hd * 1.15],
    e: [0.6, 0.65],
    taper: [0.9, 1],
  }
}
const sp = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e
/** A point on the skull at angle `a` and height `y`, `lift` of its radius off it. */
export function onSkull(k: Skull, a: number, y: number, lift = 0): V3 {
  const yy = clamp(y, -1, 1),
    u = Math.asin(sp(yy, 1 / k.e[0])),
    v = Math.PI / 2 - a,
    cu = sp(Math.cos(u), k.e[0])
  const tk = lerp(k.taper[0], k.taper[1], (yy + 1) / 2),
    f = 1 + lift
  return [
    k.c[0] + cu * sp(Math.cos(v), k.e[1]) * k.r[0] * tk * f,
    k.c[1] + yy * k.r[1] * f,
    k.c[2] + cu * sp(Math.sin(v), k.e[1]) * k.r[2] * tk * f,
  ]
}
/** Where the ray from the skull's centre along `d` leaves the head's own form, `lift` of the skull's half-width beyond
 * (bisection on its inside test): a row's path, a bun's or a tail's root. */
export function toHead(f: HeadForm, k: Skull, d: V3, lift = 0): V3 {
  const n = normalize(d)
  let lo = 0,
    hi = 2 * f.h
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2
    if (insideHead(f, add(k.c, scale(n, m)))) lo = m
    else hi = m
  }
  return add(k.c, scale(n, lo + lift * k.r[0]))
}
/** A lit streak's width along it (`u` 0 its root … 1 its tip, 0 outside): a spindle, full a little root-ward of its
 * middle and tapering to a point at either end, as a pixel artist draws a strand's shine, never a bar. */
const spindle = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u ** 0.8) ** 0.6)
export function along(line: Line, a: number) {
  const x = Math.abs(((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI)
  if (x <= line[0][0]) return line[0][1]
  for (let i = 1; i < line.length; i++)
    if (x <= line[i][0]) {
      const [a0, y0] = line[i - 1],
        [a1, y1] = line[i]
      return lerp(y0, y1, smooth((x - a0) / (a1 - a0 || 1)))
    }
  return line[line.length - 1][1]
}

// ─── Meshes ───
/** A grid point this close (m) to its row's inner point is a pole: its outward direction is its row's, not its offset's. */
const POLE = 1e-6
/** A grid of points into a mesh: normals from its neighbours, turned away from `inner` (a point, per row, inside it). */
export function grid(
  rows: number,
  cols: number,
  at: (i: number, j: number) => V3,
  wrap: boolean,
  inner: (i: number) => V3,
  skip?: (i: number, j: number) => boolean,
): Mesh {
  const P: V3[][] = []
  for (let i = 0; i <= rows; i++) {
    const row: V3[] = []
    for (let j = 0; j < cols; j++) row.push(at(i, j))
    P.push(row)
  }
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = []
  const get = (i: number, j: number) => P[clamp(i, 0, rows)][wrap ? (j + cols) % cols : clamp(j, 0, cols - 1)]
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j < cols; j++) {
      // A pole (a row pinched to a point) takes its tangent from the row beside it.
      let du = sub(get(i + 1, j), get(i - 1, j)),
        dv = sub(get(i, j + 1), get(i, j - 1))
      if (Math.hypot(...dv) < 1e-7) dv = sub(get(i === 0 ? 1 : i - 1, j + 1), get(i === 0 ? 1 : i - 1, j - 1))
      let n = normalize(cross(dv, du))
      const p = P[i][j]
      // Outward is away from `inner`. At a pole that offset is exactly 0 or rounding (1e-10 m), so its sign, and the whole
      // normal's, was the maths library's last bit and not the shape's: the pole faces the way the row beside it does.
      const k = i === 0 ? 1 : i - 1
      const away = Math.hypot(...sub(p, inner(i))) < POLE ? sub(get(k, j), inner(k)) : sub(p, inner(i))
      if (dot(n, away) < 0) n = scale(n, -1)
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
/** A smooth path through control points (Catmull-Rom), resampled to `n + 1` points evenly along its length. */
export function spline(points: V3[], n: number): V3[] {
  const pts = [points[0], ...points, points[points.length - 1]],
    dense: V3[] = []
  for (let s = 1; s < pts.length - 2; s++)
    for (let i = 0; i < 24; i++) {
      const t = i / 24,
        [p0, p1, p2, p3] = [pts[s - 1], pts[s], pts[s + 1], pts[s + 2]],
        t2 = t * t,
        t3 = t2 * t
      dense.push(
        [0, 1, 2].map(
          (c) =>
            0.5 *
            (2 * p1[c] +
              (-p0[c] + p2[c]) * t +
              (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
              (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3),
        ) as V3,
      )
    }
  dense.push(points[points.length - 1])
  const len = [0]
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(...sub(dense[i], dense[i - 1])))
  const out: V3[] = [],
    total = len[len.length - 1] || 1
  for (let i = 0, d = 0; i <= n; i++) {
    const want = (total * i) / n
    while (d < dense.length - 2 && len[d + 1] < want) d++
    const k = (want - len[d]) / (len[d + 1] - len[d] || 1)
    out.push([0, 1, 2].map((c) => lerp(dense[d][c], dense[d + 1][c], clamp(k, 0, 1))) as V3)
  }
  return out
}
/**
 * A tube along a path, its section an (super)ellipse `a` across and `b` deep (metres, scaled along it by the rope's
 * ends), turned so its depth faces `out` at each point. Returns the mesh and each vertex's share of the way along.
 */
export function sweep(
  path: V3[],
  rope: Rope,
  unit: number,
  out: (p: V3, t: number) => V3,
  rings = 0,
): { mesh: Mesh; lit?: Mesh; t: number[] } {
  const total = path.reduce((l, p, i) => (i ? l + Math.hypot(...sub(p, path[i - 1])) : 0), 0)
  const a0 = rope.r * unit,
    b0 = a0 * (rope.flat ?? 1),
    e = rope.e ?? 1,
    depth = rope.depth ?? 0.25
  const beads = rope.pitch ? Math.max(2, Math.round(total / (rope.pitch * unit))) : (rope.beads ?? 0)
  const n = rings || Math.max(8, Math.ceil(total / (a0 * 0.5)), beads * 6),
    seg = rope.seg ?? 10,
    P = spline(path, n)
  const T = P.map((_, i) => normalize(sub(P[Math.min(n, i + 1)], P[Math.max(0, i - 1)])))
  const root = rope.root ?? 0.06,
    tip = rope.tip ?? 'round',
    taper = rope.taper ?? 1
  const tipLen =
    tip === 'point'
      ? 0.25
      : tip === 'round'
        ? Math.min(0.5, a0 / (total || 1))
        : Math.min(0.5, (a0 * 0.15) / (total || 1))
  const profile = (t: number) => {
    const r = t < root ? Math.sqrt(1 - (1 - t / root) ** 2) : 1,
      q = (t - (1 - tipLen)) / tipLen
    const end = q <= 0 ? 1 : tip === 'point' ? (1 - q) ** 1.3 : Math.sqrt(Math.max(0, 1 - q * q))
    return r * end * lerp(1, taper, t)
  }
  const frame = (i: number) => {
    const t = T[i],
      o = out(P[i], i / n),
      N = normalize(sub(o, scale(t, dot(o, t)))),
      B = cross(t, N)
    return { N, B }
  }
  const F = P.map((_, i) => frame(i))
  // The beads' count along it at (t, θ): its phase, and its slant across the face its depth turns to (cos θ runs across it).
  const phase = rope.phase ?? 0,
    slant = rope.slant ?? 0,
    bead = (t: number, th: number) => beads * t + phase - slant * 0.5 * Math.cos(th)
  const at = (i: number, j: number): V3 => {
    const t = i / n,
      th = (2 * Math.PI * j) / seg,
      f = profile(t)
    let m = 1
    if (beads) m += depth * (2 * Math.abs(Math.sin(Math.PI * bead(t, th))) ** 0.7 - 1)
    if (rope.ridges) m += rope.ridges[1] * Math.cos(rope.ridges[0] * th)
    const c = sp(Math.cos(th), e) * a0 * f * m,
      s = sp(Math.sin(th), e) * b0 * f * m,
      { N, B } = F[i]
    return add(P[i], add(scale(B, c), scale(N, s)))
  }
  // The plait: the upper half of every bead lit, its edge a V down the middle, so the light runs down the rope in chevrons.
  const plait = beads && rope.plait !== false ? (rope.plait ?? 0.35) : null
  const streaks = rope.streaks,
    lit =
      plait !== null
        ? (i: number, j: number) => {
            const th = (2 * Math.PI * (j + 0.5)) / seg,
              b = bead((i + 0.5) / n, th) - (slant ? 0 : plait * (1 - Math.abs(Math.cos(th))))
            return b - Math.floor(b) < 0.5
          }
        : streaks
          ? (i: number, j: number) => {
              // Across the outer face (θ from 0 to π), `count` streaks evenly, each up to `width` of its share either side,
              // tapering to points along the rope (spindle).
              const th = (2 * Math.PI * (j + 0.5)) / seg,
                q = (th / Math.PI) * streaks[0] - 0.5,
                at = Math.round(q),
                t = (i + 0.5) / n,
                r = (hash(at * 31 + 7) - 0.5) * 0.25
              const lo = streaks[1] + r,
                hi = streaks[2] + r
              return th < Math.PI && Math.abs(q - at) < (streaks[3] ?? 0.34) * spindle((t - lo) / (hi - lo))
            }
          : undefined
  const mesh = grid(n, seg, at, true, (i) => P[i], lit)
  const ts: number[] = []
  for (let i = 0; i <= n; i++) for (let j = 0; j < seg; j++) ts.push(i / n)
  return {
    mesh,
    lit:
      lit &&
      grid(
        n,
        seg,
        at,
        true,
        (i) => P[i],
        (i, j) => !lit(i, j),
      ),
    t: ts,
  }
}
/** The turn that takes +y onto `dir`. */
export const alignY = (dir: V3) => {
  const d = normalize(dir),
    axis = cross([0, 1, 0], d)
  return Math.hypot(...axis) < 1e-6
    ? axisAngle([1, 0, 0], d[1] > 0 ? 0 : Math.PI)
    : axisAngle(axis, Math.acos(clamp(d[1], -1, 1)))
}
/** A point on the head's own form (head.ts headAt) at a skull angle and height, `lift` of the skull's half-width out. */
export function onHead(f: HeadForm, k: Skull, a: number, y: number, lift = 0): V3 {
  const t = (clamp(y, -1, 1) + 1) / 2,
    v = Math.PI / 2 - a
  return add(headAt(f, t, v), scale(headNormal(f, t, v), lift * k.r[0]))
}
/** A shell between two lines round the head (`to` the crown when left out), `lift` of the skull's half-width off its form
 * `f` along its normal, `keep` picks its cells by row (a fade's tiers), and `o.span` keeps it within that angle of the
 * front (a line-up). */
export function shell(
  k: Skull,
  o: Scalp,
  f: HeadForm,
  keep?: (i: number) => boolean,
): { mesh: Mesh; lit?: Mesh; part?: Mesh } {
  const cols = 56,
    // A foot or a lip needs the rows to follow its curve.
    rows = o.foot || o.under ? 36 : 18,
    lift = (t: number, a: number, y: number) => {
      const comb = o.ridges
        ? 1 + o.ridges[1] * Math.cos(o.ridges[0] * combPhase(k, o.comb ?? [0, 1, 0], a, y)) * smooth(t * 3)
        : 1
      // Thinner at the hairline (`edge`, of the lift), fuller toward the crown; or, with a `foot`, the foot's lift by angle,
      // easing to `lift` over `reach` of the shell's height.
      const blend = smooth(t * (1 / (o.reach ?? 0.25))),
        base = o.foot ? lerp(along(o.foot, a), o.lift, blend) : o.lift * lerp(o.edge ?? 1, 1, blend),
        // The lip: the lift falls to nothing along a quarter circle over the foot's last `under`.
        lip = o.under && t < o.under ? Math.sqrt(1 - (1 - t / o.under) ** 2) : 1
      return (base + (o.crown ?? 0) * Math.max(0, y)) * comb * lip
    }
  const point = (i: number, j: number) => {
    const a = -Math.PI + (2 * Math.PI * j) / cols,
      y0 = along(o.from, a),
      y1 = o.to ? along(o.to, a) : 1,
      t = i / rows,
      y = lerp(y0, y1, t)
    return onHead(f, k, a, y, lift(t, a, y))
  }
  const mid = (i: number, j: number) => {
    const a = -Math.PI + (2 * Math.PI * (j + 0.5)) / cols,
      y0 = along(o.from, a)
    return { a, y0, y: lerp(y0, o.to ? along(o.to, a) : 1, (i + 0.5) / rows) }
  }
  const cut = (i: number, j: number) => {
    if (keep && !keep(i)) return true
    if (o.span !== undefined && Math.abs(mid(i, j).a) > o.span) return true
    return false
  }
  const streak = (i: number, j: number) => {
    if (!o.sheen) return false
    const { a, y } = mid(i, j),
      q = (o.sheen.count * (combPhase(k, o.comb ?? [0, 1, 0], a, y) - (o.sheen.at ?? 0))) / (2 * Math.PI),
      n = Math.round(q),
      r = (o.sheen.ragged ?? 0.12) * (hash(n * 13 + 5) - 0.5) * 2
    const lo = o.sheen.from + r,
      hi = o.sheen.to + r * 0.5
    return Math.abs(q - n) < (o.sheen.width ?? 0.22) * spindle((y - lo) / (hi - lo))
  }
  // The parting: the one column whose middle is nearest the angle asked for (none when `parting` is left out).
  const split =
    o.parting === undefined
      ? -1
      : Math.round(
          ((((o.parting + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / cols) -
            0.5,
        ) % cols
  const parted = (j: number) => split >= 0 && split === j
  const mesh = grid(
    rows,
    cols,
    point,
    true,
    () => k.c,
    (i, j) => cut(i, j) || streak(i, j) || parted(j),
  )
  return {
    mesh,
    part:
      split < 0
        ? undefined
        : grid(
            rows,
            cols,
            point,
            true,
            () => k.c,
            (i, j) => cut(i, j) || !parted(j),
          ),
    lit: o.sheen
      ? grid(
          rows,
          cols,
          point,
          true,
          () => k.c,
          (i, j) => cut(i, j) || !streak(i, j) || parted(j),
        )
      : undefined,
  }
}
/** The angle round the way the hair is combed: round the axis it is combed toward, or across the head (combed back). */
export function combPhase(k: Skull, comb: V3 | 'back', a: number, y: number) {
  const p = sub(onSkull(k, a, y), k.c),
    d: V3 = [p[0] / k.r[0], p[1] / k.r[1], p[2] / k.r[2]]
  if (comb === 'back') return Math.asin(clamp(d[0] / (Math.hypot(...d) || 1), -1, 1))
  const ax = normalize(comb),
    u = normalize(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])),
    w = cross(ax, u)
  return Math.atan2(dot(d, w), dot(d, u))
}
