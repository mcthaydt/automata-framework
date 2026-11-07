// The world's view of sector geometry: an outline and its holes, where a point stands, a plane's height, and a level's
// wall segments: each room's edges cut where other rooms share them, the shared stretches being portals. The point tests
// and the triangulation live once in `shared/level/geometry.ts`; these are thin adapters over `[x, z]` pairs. Changed: a
// sector is `/2`'s `corners` and `holes` (the builder's `verts`/`rect` are converted, never read), a hole is walled and
// filled, a room with no area is reported by `isDegenerate` instead of failing the triangulation, and the diorama's
// cut-away rules (`dollhouseStub`, `wallInDiorama`, `lintel*`) are not here: views belong to the editor.
import type { AfCorner2, AfSector2, AfSectorEntry2, Plane } from '../../shared/level/af-sector-2.schema.ts'
import { insideSector, polygonArea, triangulate } from '../../shared/level/geometry.ts'
import type { Point } from '../../shared/level/sector.schema.ts'

export type V2 = readonly [number, number]

const toPoint = ([x, z]: V2): Point => ({ x, z })

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
  return insideSector({ x, z }, { points: [polygon.map(toPoint)] })
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
export const signedArea = (polygon: readonly V2[]): number => polygonArea(polygon.map(toPoint))

/** A room with fewer than three corners or no area: it cannot be walled or filled, and the builder says so. */
export function isDegenerate(sector: AfSectorEntry2): boolean {
  return sector.corners.length < 3 || Math.abs(signedArea(ringsOf(sector)[0] as V2[])) < 1e-6
}

/**
 * The room as its points and its triangles: the outline, then each hole, as given, and indices into them (a bridge
 * from each hole to the outline is the shared triangulation's business, one geometry for the world, the editor and the
 * sectors extension).
 */
export function fill(
  outline: readonly V2[],
  holes: readonly (readonly V2[])[] = [],
): { points: V2[]; triangles: number[] } {
  const { points, triangles } = triangulate(
    outline.map(toPoint),
    holes.map((hole) => hole.map(toPoint)),
  )
  return { points: points.map((p): V2 => [p.x, p.z]), triangles: triangles.flat() }
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
