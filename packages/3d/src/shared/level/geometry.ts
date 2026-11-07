// One sector geometry,
import type { Point } from './sector.schema.ts'
import { STEP } from './sector.schema.ts'

/** The item at `index`, wrapping round the list: the wall from the last corner runs to the first. */
const wrapped = <T>(items: readonly T[], index: number): T => items[index % items.length] as T

// ─── Plan queries ─────────────────────────────────────────────────────────

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
  // `Math.sqrt` is correctly rounded in every engine; `Math.hypot` is not.
  const ex = p.x - a.x - dx * t
  const ez = p.z - a.z - dz * t
  return Math.sqrt(ex * ex + ez * ez)
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

/** The loops of a sector the queries read: the outer loop first, then the holes. */
export interface SectorPlan {
  readonly points: readonly (readonly Point[])[]
}

/** Whether a point is in the sector: inside its outer loop and outside every hole. */
export const insideSector = (p: Point, s: SectorPlan): boolean =>
  insideLoop(p, s.points[0] as readonly Point[]) && !s.points.slice(1).some((h) => insideLoop(p, h))

/** The signed area of a loop on the plan: positive counter-clockwise (x right, z up), negative clockwise. */
export const polygonArea = (points: readonly Point[]): number =>
  points.reduce((sum, p, i) => {
    const q = wrapped(points, i + 1)
    return sum + p.x * q.z - q.x * p.z
  }, 0) / 2

// ─── What a wall builds and what blocks a walker ─────────────────────────

/** The heights of a room's floor and ceiling. */
interface Heights {
  readonly floor: number
  readonly ceiling: number
}

/** The opening a portal leaves, between the higher floor and the lower ceiling. */
export const opening = (edge: {
  readonly sector: Heights
  readonly next: Heights
}): { y0: number; y1: number } => ({
  y0: Math.max(edge.sector.floor, edge.next.floor),
  y1: Math.min(edge.sector.ceiling, edge.next.ceiling),
})

/** A vertical span of wall along an edge: a solid wall, or the lower or upper strip a portal leaves. */
export interface WallSpan {
  readonly y0: number
  readonly y1: number
  readonly kind: 'wall' | 'lower' | 'upper'
}

/** Walls a walker cannot pass: solid walls and steps too tall to climb. */
export const walkBlocker = (piece: WallSpan): boolean =>
  piece.kind === 'wall' || (piece.kind === 'lower' && piece.y1 - piece.y0 > STEP)

// ─── Triangles ────────────────────────────────────────────────────────────

// Triangles for the floor and ceiling of a sector: an outline and its holes in, triangles out, as indices into the
// into the points, so a mesh can share them between the floor and the ceiling. Ear clipping, which keeps every corner a
// room has (a collinear run along a wall stays, because a wall's trim and its portal are written on those corners),
// after each hole is joined to the outline by a bridge, a slit that the clipping then walks through. Orientation is
// not the caller's problem: the outline is taken counter-clockwise and the holes clockwise, in the sense of
// `polygonArea` (positive is counter-clockwise), and every triangle comes out with the outline's winding.
//
// A polygon that is not simple (a bow-tie, a hole that crosses the outline) is not refused, because the editor draws
// the level while its checks are still saying what is wrong with it: a hole that cannot be joined is left out, and
// when clipping gets stuck the rest is cut as a fan and the triangles that face the wrong way are dropped.

export type Triangle = readonly [number, number, number]

export interface Triangulation {
  /** The outline's points and then each hole's, as given. */
  readonly points: readonly Point[]
  /** Indices into `points`, each triangle turning the way a counter-clockwise outline does. */
  readonly triangles: readonly Triangle[]
}

/** Positive when `c` is to the left of the line from `a` to `b`: the sign `polygonArea` gives a counter-clockwise loop. */
const turn = (a: Point, b: Point, c: Point): number => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)

const sameSpot = (a: Point, b: Point): boolean => a.x === b.x && a.z === b.z

/** Twice the signed area of a loop of indices. */
function signedArea(points: readonly Point[], ring: readonly number[]): number {
  let sum = 0
  ring.forEach((index, at) => {
    const a = points[index] as Point
    const b = points[ring[(at + 1) % ring.length] as number] as Point
    sum += a.x * b.z - b.x * a.z
  })
  return sum
}

/** The ring counter-clockwise when `counterClockwise`, clockwise otherwise. */
function oriented(points: readonly Point[], ring: readonly number[], counterClockwise: boolean): number[] {
  const area = signedArea(points, ring)
  return area < 0 === counterClockwise ? [...ring].reverse() : [...ring]
}

/**
 * Whether the segment from `p` to `q` and the segment `a`–`b` meet anywhere but at an end they share. On one line that
 * is an overlap of more than a point; otherwise a touch or a cross.
 */
function meets(p: Point, q: Point, a: Point, b: Point): boolean {
  const [ta, tb] = [turn(p, q, a), turn(p, q, b)]
  if (ta === 0 && tb === 0) {
    const [dx, dz] = [q.x - p.x, q.z - p.z]
    const along = (r: Point): number => ((r.x - p.x) * dx + (r.z - p.z) * dz) / (dx * dx + dz * dz)
    const low = Math.max(0, Math.min(along(a), along(b)))
    const high = Math.min(1, Math.max(along(a), along(b)))
    return high - low > 0
  }
  const sharedEnd = sameSpot(a, p) || sameSpot(a, q) || sameSpot(b, p) || sameSpot(b, q)
  return !sharedEnd && ta * tb <= 0 && turn(a, b, p) * turn(a, b, q) <= 0
}

/** Whether a segment from the corner `at` of a loop to `target` leaves the corner into the room (O'Rourke's `InCone`). */
function leavesInward(before: Point, at: Point, after: Point, target: Point): boolean {
  if (turn(at, after, before) >= 0) return turn(at, target, before) > 0 && turn(target, at, after) > 0
  return !(turn(at, target, after) >= 0 && turn(target, at, before) >= 0)
}

/**
 * The ring with the hole spliced in along the shortest segment from a corner of the ring to a corner of the hole that
 * lies in the room: it crosses no edge of the ring or of a hole, and it leaves the ring's corner into the room (a
 * corner a bridge has already visited is there twice, once for each side of the slit). The ring goes through the
 * bridge twice. The ring itself when no such segment exists.
 */
function joinHole(
  points: readonly Point[],
  ring: readonly number[],
  hole: readonly number[],
  others: readonly (readonly number[])[],
): number[] {
  const at = (loop: readonly number[], position: number): Point =>
    points[loop[(position + loop.length) % loop.length] as number] as Point
  const edgesOf = (loop: readonly number[]): [Point, Point][] =>
    loop.map((_, position) => [at(loop, position), at(loop, position + 1)])
  const obstacles = [ring, hole, ...others].flatMap(edgesOf)
  let best: { ringAt: number; holeAt: number; length: number } | undefined
  for (let ringAt = 0; ringAt < ring.length; ringAt++) {
    const [before, p, after] = [at(ring, ringAt - 1), at(ring, ringAt), at(ring, ringAt + 1)]
    for (let holeAt = 0; holeAt < hole.length; holeAt++) {
      const q = at(hole, holeAt)
      const length = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z)
      if (best !== undefined && length >= best.length) continue
      if (leavesInward(before, p, after, q) && !obstacles.some(([a, b]) => meets(p, q, a, b)))
        best = { ringAt, holeAt, length }
    }
  }
  if (best === undefined) return [...ring]
  const turned = [...hole.slice(best.holeAt), ...hole.slice(0, best.holeAt)]
  const m = ring[best.ringAt] as number
  return [
    ...ring.slice(0, best.ringAt + 1),
    ...turned,
    turned[0] as number,
    m,
    ...ring.slice(best.ringAt + 1),
  ]
}

/** Whether `p` is in the triangle or on its edge; the triangle turns counter-clockwise. */
const inTriangle = (a: Point, b: Point, c: Point, p: Point): boolean =>
  turn(a, b, p) >= 0 && turn(b, c, p) >= 0 && turn(c, a, p) >= 0

/**
 * Whether the corner at `at` of the ring is an ear: it turns the right way and no other corner of the ring is in the
 * triangle it cuts off. A corner that lies where one of the triangle's own corners does is a bridge's second visit to
 * that spot, and does not count.
 */
function isEar(points: readonly Point[], ring: readonly number[], at: number): boolean {
  const n = ring.length
  const [before, after] = [(at + n - 1) % n, (at + 1) % n]
  const [a, b, c] = [
    points[ring[before] as number],
    points[ring[at] as number],
    points[ring[after] as number],
  ] as [Point, Point, Point]
  if (turn(a, b, c) <= 0) return false
  return ring.every((index, position) => {
    if (position === before || position === at || position === after) return true
    const p = points[index] as Point
    return sameSpot(p, a) || sameSpot(p, b) || sameSpot(p, c) || !inTriangle(a, b, c, p)
  })
}

/** The triangles of a ring (no holes left in it), by clipping its ears one at a time. */
function clipEars(points: readonly Point[], loop: readonly number[]): Triangle[] {
  const triangles: Triangle[] = []
  const ring = [...loop]
  const keep = (a: number, b: number, c: number): void => {
    if (turn(points[a] as Point, points[b] as Point, points[c] as Point) > 0) triangles.push([a, b, c])
  }
  while (ring.length > 3) {
    const n = ring.length
    const at = ring.findIndex((_, position) => isEar(points, ring, position))
    if (at < 0) {
      // Stuck: not a simple polygon. Cut what is left as a fan from its first corner.
      for (let i = 1; i < n - 1; i++) keep(ring[0] as number, ring[i] as number, ring[i + 1] as number)
      return triangles
    }
    keep(ring[(at + n - 1) % n] as number, ring[at] as number, ring[(at + 1) % n] as number)
    ring.splice(at, 1)
  }
  if (ring.length === 3) keep(ring[0] as number, ring[1] as number, ring[2] as number)
  return triangles
}

export function triangulate(
  outline: readonly Point[],
  holes: readonly (readonly Point[])[] = [],
): Triangulation {
  const points = [...outline, ...holes.flat()]
  // Each loop as the indices of its points in `points`, which holds them one loop after the other.
  let start = outline.length
  const holeRings = holes.map((hole) => {
    const ring = hole.map((_, k) => start + k)
    start += hole.length
    return ring
  })
  let ring = oriented(
    points,
    outline.map((_, k) => k),
    true,
  )
  const pending = holeRings.filter((hole) => hole.length >= 3).map((hole) => oriented(points, hole, false))
  pending.forEach((hole, i) => {
    ring = joinHole(points, ring, hole, pending.slice(i + 1))
  })
  return { points, triangles: clipEars(points, ring) }
}
