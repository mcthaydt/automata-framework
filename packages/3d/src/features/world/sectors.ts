// The geometry of sectors: an outline and its holes, where a point stands, a plane's height, the triangulation (ear
// clipping, with holes joined to the outline by a bridge), and a level's wall segments: each room's edges cut where
// other rooms share them, the shared stretches being portals. Pure functions of a `/2` level, with nothing but its
// types behind them, so the world builder, the dresser and the checks can all stand on them.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/sectors.ts at 6d82a52. Changed: a
// sector is `/2`'s `corners` and `holes` (the builder's `verts`/`rect` are converted, never read), a hole is walled
// and filled, a room with no area is reported by `isDegenerate` instead of failing the triangulation, and the
// diorama's cut-away rules (`dollhouseStub`, `wallInDiorama`, `lintel*`) are not here: views belong to the editor.
import type { AfCorner2, AfSector2, AfSectorEntry2, Plane } from '../../shared/level/af-sector-2.schema.ts'

export type V2 = readonly [number, number]

/** A sector's rings: its outline (ring 0), then each hole. */
export function ringsOf(sector: AfSectorEntry2): V2[][] {
  const point = ([x, z]: AfCorner2): V2 => [x, z]
  return [sector.corners.map(point), ...(sector.holes ?? []).map((hole) => hole.map(point))]
}

/** The ring's corner records, the walls riding on them: ring 0 is the outline, ring `1 + i` is hole `i`. */
export function cornersOf(sector: AfSectorEntry2, ring: number): readonly AfCorner2[] {
  return ring === 0 ? sector.corners : (sector.holes?.[ring - 1] ?? [])
}

/** Whether `(x, z)` is inside the polygon (even-odd). */
export function inside(polygon: readonly V2[], x: number, z: number): boolean {
  let within = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i] as V2
    const [xj, zj] = polygon[j] as V2
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) within = !within
  }
  return within
}

/** Whether `(x, z)` stands in the room: inside its outline and outside its holes. */
export function standsIn(sector: AfSectorEntry2, x: number, z: number): boolean {
  const [outline, ...holes] = ringsOf(sector) as [V2[], ...V2[][]]
  return inside(outline, x, z) && !holes.some((hole) => inside(hole, x, z))
}

/** The plane's height at `(x, z)`: its slope runs from `origin`, the room's first corner. */
export function heightAt(plane: Plane, origin: V2, x: number, z: number): number {
  return (
    plane.z +
    (plane.slope === undefined ? 0 : plane.slope[0] * (x - origin[0]) + plane.slope[1] * (z - origin[1]))
  )
}

/** The polygon's signed area: positive when its corners run counter-clockwise in `(x, z)` taken as (right, up). */
export function signedArea(polygon: readonly V2[]): number {
  let sum = 0
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length] as V2
    sum += p[0] * q[1] - q[0] * p[1]
  })
  return sum / 2
}

/** A room with fewer than three corners or no area: it cannot be walled or filled, and the builder says so. */
export function isDegenerate(sector: AfSectorEntry2): boolean {
  return sector.corners.length < 3 || Math.abs(signedArea(ringsOf(sector)[0] as V2[])) < 1e-6
}

const cross = (a: V2, b: V2, c: V2): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const same = (a: V2, b: V2): boolean => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9

/** Whether `p` is in or on the triangle, not counting a point that is one of its corners (a bridge's twin). */
function blocks(triangle: readonly [V2, V2, V2], p: V2): boolean {
  if (triangle.some((corner) => same(corner, p))) return false
  const [a, b, c] = triangle
  const signs = [cross(a, b, p), cross(b, c, p), cross(c, a, p)]
  return signs.every((s) => s >= -1e-9) || signs.every((s) => s <= 1e-9)
}

/** Ear clipping: a simple polygon (a bridged one too) into triangles, as index triples into `polygon`. */
export function triangulate(polygon: readonly V2[]): number[] {
  const remaining = polygon.map((_, i) => i)
  const out: number[] = []
  const ccw = signedArea(polygon) > 0
  let guard = 0
  while (remaining.length > 3 && guard++ < 10_000) {
    let clipped = false
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[(i + remaining.length - 1) % remaining.length] as number
      const b = remaining[i] as number
      const c = remaining[(i + 1) % remaining.length] as number
      const turn = cross(polygon[a] as V2, polygon[b] as V2, polygon[c] as V2)
      if (ccw ? turn <= 1e-9 : turn >= -1e-9) continue
      const triangle = [polygon[a], polygon[b], polygon[c]] as [V2, V2, V2]
      if (remaining.some((j) => j !== a && j !== b && j !== c && blocks(triangle, polygon[j] as V2))) continue
      out.push(a, b, c)
      remaining.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) break
  }
  if (remaining.length === 3) out.push(remaining[0] as number, remaining[1] as number, remaining[2] as number)
  return out
}

/** Whether the open segments `p`–`q` and `r`–`s` cross (touching at an end does not count). */
function crosses(p: V2, q: V2, r: V2, s: V2): boolean {
  const d1 = cross(p, q, r)
  const d2 = cross(p, q, s)
  const d3 = cross(r, s, p)
  const d4 = cross(r, s, q)
  return d1 * d2 < -1e-12 && d3 * d4 < -1e-12
}

/**
 * The room as one polygon and its triangles: each hole is joined to the outline (or to the outline with the holes
 * already joined) by a bridge from the hole's rightmost corner to the nearest corner it sees, walked there and back.
 * `points` holds the bridge's corners twice; `triangles` are indices into it.
 */
export function fill(
  outline: readonly V2[],
  holes: readonly (readonly V2[])[] = [],
): { points: V2[]; triangles: number[] } {
  let merged: V2[] = signedArea(outline) > 0 ? [...outline] : [...outline].reverse()
  const wanted = signedArea(merged) > 0
  const rightmost = (ring: readonly V2[]): number =>
    ring.reduce((best, p, i) => (p[0] > (ring[best] as V2)[0] ? i : best), 0)
  // Right to left, so a bridge never has to pass a hole that has not been joined yet.
  const rings = holes
    .map((hole) => (signedArea(hole) > 0 === wanted ? [...hole].reverse() : [...hole]))
    .sort((a, b) => (b[rightmost(b)] as V2)[0] - (a[rightmost(a)] as V2)[0])
  for (const hole of rings) {
    const at = rightmost(hole)
    const from = hole[at] as V2
    const visible = (index: number): boolean => {
      const to = merged[index] as V2
      const clear = (ring: readonly V2[]): boolean =>
        ring.every((p, i) => {
          const q = ring[(i + 1) % ring.length] as V2
          return !crosses(from, to, p, q)
        })
      return clear(merged) && clear(hole) && rings.every((other) => other === hole || clear(other))
    }
    const order = merged
      .map((p, i) => ({ i, d: Math.hypot(p[0] - from[0], p[1] - from[1]) }))
      .sort((a, b) => a.d - b.d)
    const bridge = (order.find(({ i }) => visible(i)) ?? order[0])?.i ?? 0
    const around = [...hole.slice(at), ...hole.slice(0, at), from]
    merged = [...merged.slice(0, bridge + 1), ...around, ...merged.slice(bridge)]
  }
  return { points: merged, triangles: triangulate(merged) }
}

/** A wall segment: part of a room's edge, solid (`next` −1) or a portal to the room `next` (an index into the level). */
export interface Segment {
  /** The room's index in the level. */
  readonly sector: number
  /** Which ring: 0 is the outline, `1 + i` is hole `i`. */
  readonly ring: number
  /** The edge: the ring's corner `edge` to the next. */
  readonly edge: number
  readonly a: V2
  readonly b: V2
  readonly next: number
  /** Where along the edge (0 to 1) the segment starts and ends. */
  readonly t0: number
  readonly t1: number
}

/** Each room's edges cut where other rooms share them: the shared stretches are portals, T-junctions included. */
export function segments(level: AfSector2): Segment[] {
  const out: Segment[] = []
  const rooms = level.sectors.map((sector) => (isDegenerate(sector) ? [] : ringsOf(sector)))
  rooms.forEach((rings, si) => {
    rings.forEach((ring, ri) => {
      ring.forEach((a, ei) => {
        const b = ring[(ei + 1) % ring.length] as V2
        const [dx, dz] = [b[0] - a[0], b[1] - a[1]]
        const length = Math.hypot(dx, dz)
        if (length < 1e-9) return
        const cuts: [number, number, number][] = []
        rooms.forEach((others, sj) => {
          if (sj === si) return
          for (const other of others)
            other.forEach((c, k) => {
              const d = other[(k + 1) % other.length] as V2
              // Collinear: both ends of the other edge on this edge's line.
              const off = (p: V2): number => ((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / length
              if (Math.abs(off(c)) > 1e-3 || Math.abs(off(d)) > 1e-3) return
              const along = (p: V2): number => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (length * length)
              const lo = Math.max(0, Math.min(along(c), along(d)))
              const hi = Math.min(1, Math.max(along(c), along(d)))
              if (hi - lo > 1e-4) cuts.push([lo, hi, sj])
            })
        })
        cuts.sort((p, q) => p[0] - q[0])
        const at = (u: number): V2 => [a[0] + dx * u, a[1] + dz * u]
        const push = (t0: number, t1: number, next: number): void => {
          out.push({ sector: si, ring: ri, edge: ei, a: at(t0), b: at(t1), next, t0, t1 })
        }
        let t = 0
        for (const [lo, hi, sj] of cuts) {
          if (lo > t + 1e-4) push(t, lo, -1)
          if (hi > t) {
            push(Math.max(t, lo), hi, sj)
            t = hi
          }
        }
        if (t < 1 - 1e-4) push(t, 1, -1)
      })
    })
  })
  return out
}

/** A segment’s normal into its room, `[x, z]`. */
export function inward(level: AfSector2, segment: Segment): V2 {
  const [dx, dz] = [segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]]
  const length = Math.hypot(dx, dz)
  const normal: V2 = [-dz / length || 0, dx / length || 0]
  const mx = (segment.a[0] + segment.b[0]) / 2 + normal[0] * 0.01
  const mz = (segment.a[1] + segment.b[1]) / 2 + normal[1] * 0.01
  const sector = level.sectors[segment.sector] as AfSectorEntry2
  return standsIn(sector, mx, mz) ? normal : [-normal[0] || 0, -normal[1] || 0]
}
