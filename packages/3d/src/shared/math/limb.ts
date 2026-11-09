// A limb: a tube swept down its axis whose cross-section follows a profile, with rounded ends. One profile from the
// shoulder to the wrist (or the hip to the ankle) makes a deltoid, a biceps, an elbow, a forearm and a wrist as one
// form, never stacked boxes; skinned across its joints it bends without a bulge.

import { type MeshData as Mesh, sgnPow } from './geometry.ts'
import { at, cross, dot, lerp, normalize, sub, type V3 } from './math.ts'

/** A key of a limb's profile: at height `y` on its axis, its half-widths across (x) and front to back (z),
 * and how far its centre sits off the axis (`dx`, `dz`): a deltoid out, a biceps forward, a calf back. */
export interface Ring {
  y: number
  rx: number
  rz: number
  dx?: number
  dz?: number
}
export interface Limb {
  /** The profile's keys, top to bottom; a smooth curve runs through them (no overshoot, so no beads). */
  rings: Ring[]
  /** The cross-section's roundness: 1 an ellipse, below 1 squarer (a torso), 2 a diamond. */
  e?: number
  /** How far the top and bottom round out past their end keys (m); 0 leaves that end open. */
  caps?: [number, number]
  /**
   * How round each cap is: 1 a dome (default), 0 a cone (the trapezius's slope from the neck to the
   * shoulder).
   */
  round?: [number, number]
  /** Keep only the stretch between these heights (high, low): one material's share of a limb, open where it
   * is cut, so the stretches of one limb meet ring to ring. */
  span?: [number, number]
  /** Around the axis, and the spacing of rings along it (m). */
  seg?: number
  step?: number
}

/** A monotone cubic through (x, y) keys (Fritsch–Carlson): smooth, and never past its keys. */
function curve(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length
  const d: number[] = []
  const m: number[] = new Array<number>(n).fill(0)
  for (let i = 0; i < n - 1; i++) d.push((at(ys, i + 1) - at(ys, i)) / (at(xs, i + 1) - at(xs, i) || 1e-9))
  if (n > 1) {
    m[0] = at(d, 0)
    m[n - 1] = at(d, n - 2)
  }
  // A key between a rise and a fall is a flat top; elsewhere the slopes' weighted harmonic mean.
  for (let i = 1; i < n - 1; i++)
    if (at(d, i - 1) * at(d, i) > 0) {
      const w1 = 2 * (at(xs, i + 1) - at(xs, i)) + (at(xs, i) - at(xs, i - 1))
      const w2 = at(xs, i + 1) - at(xs, i) + 2 * (at(xs, i) - at(xs, i - 1))
      m[i] = (w1 + w2) / (w1 / at(d, i - 1) + w2 / at(d, i))
    }
  return (x: number) => {
    if (x <= at(xs, 0)) return at(ys, 0)
    if (x >= at(xs, n - 1)) return at(ys, n - 1)
    let i = 0
    while (x > at(xs, i + 1)) i++
    const h = at(xs, i + 1) - at(xs, i)
    const t = (x - at(xs, i)) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * at(ys, i) +
      (t3 - 2 * t2 + t) * h * at(m, i) +
      (-2 * t3 + 3 * t2) * at(ys, i + 1) +
      (t3 - t2) * h * at(m, i + 1)
    )
  }
}

/** The four monotone curves of a limb's sorted keys: half-widths across and front to back, and the centre's offsets. */
function curves(keys: readonly Ring[]): Record<'RX' | 'RZ' | 'DX' | 'DZ', (y: number) => number> {
  const ys = keys.map((r) => r.y)
  return {
    RX: curve(
      ys,
      keys.map((r) => r.rx),
    ),
    RZ: curve(
      ys,
      keys.map((r) => r.rz),
    ),
    DX: curve(
      ys,
      keys.map((r) => r.dx ?? 0),
    ),
    DZ: curve(
      ys,
      keys.map((r) => r.dz ?? 0),
    ),
  }
}
const curveCache = new WeakMap<Limb, { rings: Ring[]; n: number; c: ReturnType<typeof curves> }>()
/**
 * A limb's profile at height `y` on its axis: the very curves `limb()` sweeps, clamped to the keys' range. The curves
 * are built once per limb (its rings are never edited in place), so a query per vertex stays cheap.
 */
export function profileAt(o: Limb, y: number): Ring {
  let hit = curveCache.get(o)
  if (!hit || hit.rings !== o.rings || hit.n !== o.rings.length) {
    hit = { rings: o.rings, n: o.rings.length, c: curves([...o.rings].sort((a, b) => a.y - b.y)) }
    curveCache.set(o, hit)
  }
  const { RX, RZ, DX, DZ } = hit.c
  return { y, rx: RX(y), rz: RZ(y), dx: DX(y), dz: DZ(y) }
}

/** The limb's mesh: one parameter s down its whole length (the top cap, the body, the bottom cap). */
export function limb(o: Limb): Mesh {
  const keys = [...o.rings].sort((a, b) => a.y - b.y)
  const ys = keys.map((r) => r.y)
  const e = o.e ?? 1
  const seg = o.seg ?? 16
  const step = o.step ?? 0.012
  const { RX, RZ, DX, DZ } = curves(keys)
  const yLo = at(ys, 0)
  const yHi = at(ys, ys.length - 1)
  const [capHi, capLo] = o.caps ?? [0, 0]
  const [roundHi, roundLo] = o.round ?? [1, 1]
  const capScale = (a: number, round: number) => lerp(1 - Math.sin(a), Math.cos(a) ** 0.8, round)
  const top = Math.min(yHi, o.span?.[0] ?? Infinity)
  const bottom = Math.max(yLo, o.span?.[1] ?? -Infinity)
  const hiCap = top >= yHi - 1e-9 ? capHi : 0
  const loCap = bottom <= yLo + 1e-9 ? capLo : 0
  // A cap is a quarter ellipse of its end ring, so the form closes round, as a joint's end does.
  const capRings = (c: number) => (c > 0 ? 5 : 0)
  const body = Math.max(2, Math.ceil((top - bottom) / step))
  const nHi = capRings(hiCap)
  const nLo = capRings(loCap)
  const rings = nHi + body + nLo
  const point = (s: number, v: number): V3 => {
    let y: number
    let k = 1
    let ry: number
    if (s < nHi) {
      const a = (Math.PI / 2) * (1 - s / nHi)
      ry = top
      y = top + hiCap * Math.sin(a)
      k = capScale(a, roundHi)
    } else if (s > nHi + body) {
      const a = (Math.PI / 2) * ((s - nHi - body) / nLo)
      ry = bottom
      y = bottom - loCap * Math.sin(a)
      k = capScale(a, roundLo)
    } else {
      y = top - ((top - bottom) * (s - nHi)) / body
      ry = y
    }
    const c = Math.cos(v)
    const sn = Math.sin(v)
    return [DX(ry) + sgnPow(c, e) * RX(ry) * k, y, DZ(ry) + sgnPow(sn, e) * RZ(ry) * k]
  }
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j < seg; j++) {
      const v = -Math.PI + (2 * Math.PI * j) / seg
      const p = point(i, v)
      const eps = 1e-3
      // Normals: the surface's own tangents, taken just off the poles so they never degenerate.
      const si = Math.max(0.02, Math.min(rings - 0.02, i))
      const ds = sub(point(Math.min(rings, si + 0.02), v), point(Math.max(0, si - 0.02), v))
      const dv = sub(point(si, v + eps), point(si, v - eps))
      let n = normalize(cross(dv, ds))
      const q = point(si, v)
      const centre: V3 = [
        DX(Math.max(bottom, Math.min(top, q[1]))),
        q[1],
        DZ(Math.max(bottom, Math.min(top, q[1]))),
      ]
      const out = sub(q, centre)
      if (i <= 0 && hiCap > 0) n = [0, 1, 0]
      else if (i >= rings && loCap > 0) n = [0, -1, 0]
      else if (dot(n, out) < 0) n = [-n[0], -n[1], -n[2]]
      positions.push(...p)
      normals.push(...n)
    }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j
      const b = i * seg + ((j + 1) % seg)
      const c = (i + 1) * seg + ((j + 1) % seg)
      const d = (i + 1) * seg + j
      indices.push(a, b, c, a, c, d)
    }
  return { positions, normals, indices }
}
