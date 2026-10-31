// Plan geometry the sim asks of a resolved map (M6 spec §4.3): crossings, distances and point-in-sector. The same
// arithmetic as the 3D level editor's float geometry, with `hypot` from the sim's deterministic math (§4.9), so a
// distance is the same in every engine.
import type { Point } from '@mcthaydt/automata-sector-format'
import { hypot } from '@mcthaydt/automata-sim/math'

/** The part of a resolved sector that point-in-sector reads: its loops' corners, the outer loop first. */
export interface Outline {
  readonly points: readonly (readonly Point[])[]
}

const cross = (ax: number, az: number, bx: number, bz: number): number => ax * bz - az * bx

/** Parameter along p→q where it crosses segment a→b, or -1. */
export function crossing(px: number, pz: number, qx: number, qz: number, a: Point, b: Point): number {
  const rx = qx - px
  const rz = qz - pz
  const sx = b.x - a.x
  const sz = b.z - a.z
  const denom = cross(rx, rz, sx, sz)
  if (Math.abs(denom) < 1e-12) return -1
  const t = cross(a.x - px, a.z - pz, sx, sz) / denom
  const u = cross(a.x - px, a.z - pz, rx, rz) / denom
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1
}

function pointSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const l = dx * dx + dz * dz
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l)) : 0
  return hypot(p.x - a.x - dx * t, p.z - a.z - dz * t)
}

/** Shortest distance between two segments on the plan. */
export function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  if (crossing(a.x, a.z, b.x, b.z, c, d) >= 0) return 0
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b))
}

function insideLoop(p: Point, loop: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i] as Point
    const b = loop[j] as Point
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/** Whether a point is in the sector: inside its outer loop and outside every hole. */
export const insideSector = (p: Point, s: Outline): boolean =>
  insideLoop(p, s.points[0] ?? []) && !s.points.slice(1).some((h) => insideLoop(p, h))

/** Twice-signed shoelace area halved: positive for a counter-clockwise loop on the plan (x right, z up). */
export const polygonArea = (points: readonly Point[]): number =>
  points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length] as Point
    return sum + p.x * q.z - q.x * p.z
  }, 0) / 2
