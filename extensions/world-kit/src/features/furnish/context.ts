// What every layer of the dresser needs about the room it dresses, and where it puts what it places: the room's
// outline and walls, what is already taken, what hangs on each wall, and the footprints of the props it can place.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/dress.ts at 6d82a52 (`Ctx`,
// `footprintOf`, `fits`, `place`, `reserve`, and the wall helpers). Changed: walls are the corner records of the `/2`
// level (a ring and an edge, not an edge index), and a wall's door and window of the `/1` vocabulary count as decor.
import type { AfSector2, AfSectorEntry2, AfWall2, Dress, PropPlace } from '@automata/3d/level'
import type { WorldLibrary } from '@automata/3d/props-kit'
import {
  cornersOf,
  inside,
  inward,
  isFault,
  resolveProp,
  ringsOf,
  type Segment,
  type V2,
} from '@automata/3d/props-kit'
import { boundsOfMesh } from '../../shared/piece-helpers.ts'
import { boxOf, overlaps, type Rect, type Spot, turned } from './floor-plan.ts'
import type { Kit } from './kit.schema.ts'

/** What hangs on a wall so far: its edge, its span along the wall (the wall's own coordinate) and its heights. */
export interface Hung {
  readonly wall: string
  readonly p0: number
  readonly p1: number
  readonly y0: number
  readonly y1: number
}

export interface Ctx {
  readonly level: AfSector2
  readonly library: WorldLibrary
  readonly si: number
  readonly sector: AfSectorEntry2
  readonly kit: Kit
  readonly dress: Dress
  readonly next: () => number
  readonly density: number
  readonly poly: V2[]
  readonly area: number
  /** The floor's height at the room's first corner. */
  readonly floor: number
  readonly segs: Segment[]
  /** What is taken: doorway strips, paths, hand-placed props and what the layers have placed. */
  readonly occupied: Rect[]
  readonly out: PropPlace[]
  readonly counts: Record<string, number>
  readonly hung: Hung[]
}

// --- footprints ---

/** What a prop takes up, in its own space: the width (x) and depth (z) of its bounds, its height, and its top. */
export interface Footprint {
  readonly w: number
  readonly d: number
  readonly h: number
  readonly top?: { readonly y: number; readonly size: readonly [number, number] } | undefined
}

const prints = new WeakMap<WorldLibrary, Map<string, Footprint>>()
const HALF_METRE: Footprint = { w: 0.5, d: 0.5, h: 0.5 }

/**
 * What a prop built from `spec` takes up. A prop that will not build (a bare generator kind with no parameters, a
 * preset the library lacks) is half a metre, so the dresser carries on.
 */
export function footprintOf(
  library: WorldLibrary,
  spec: Pick<PropPlace, 'use' | 'kind' | 'with'>,
): Footprint {
  const cache = prints.get(library) ?? new Map<string, Footprint>()
  prints.set(library, cache)
  const key = JSON.stringify([spec.use, spec.kind, spec.with])
  const known = cache.get(key)
  if (known !== undefined) return known
  let print = HALF_METRE
  const resolved = resolveProp(spec, library)
  if (!isFault(resolved)) {
    try {
      const built = resolved.generator(resolved.params)
      const bounds = boundsOfMesh(built.pieces.map((piece) => piece.mesh))
      if (bounds !== null)
        print = {
          w: bounds[1][0] - bounds[0][0],
          d: bounds[1][2] - bounds[0][2],
          h: bounds[1][1],
          top: built.top,
        }
    } catch {
      // A generator that needs a parameter the preset leaves to its place.
    }
  }
  cache.set(key, print)
  return print
}

// --- walls ---

/** A thing set into or hung on a wall, in the wall's own coordinate: a window, a door, a shopfront or a sign. */
export interface Feature {
  readonly kind: 'window' | 'door' | 'shop' | 'sign'
  readonly pos: number
  readonly width: number
  readonly sill?: number | undefined
  readonly height?: number | undefined
}

export const wallOf = (c: Ctx, g: Segment): AfWall2 => cornersOf(c.sector, g.ring)[g.edge]?.[2] ?? {}

/** The wall's solid segments (a portal or an open edge has no wall to stand against). */
export const solidSegs = (c: Ctx): Segment[] => c.segs.filter((g) => g.next < 0 && wallOf(c, g).none !== true)

export const lengthOf = (g: Segment): number => Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1])

export function dirOf(g: Segment): V2 {
  const length = lengthOf(g) || 1
  return [(g.b[0] - g.a[0]) / length, (g.b[1] - g.a[1]) / length]
}

/** The axis a wall runs along: x for one running east-west, z for one running north-south. */
const axisOf = (a: V2, b: V2): 0 | 1 => (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1)

/** A segment's span along its wall, in the coordinate the wall runs along (what a decor's `pos` is). */
export function spanOfSeg(g: Segment): [number, number] {
  const k = axisOf(g.a, g.b)
  return [Math.min(g.a[k], g.b[k]), Math.max(g.a[k], g.b[k])]
}

/**
 * The point on a segment at `pos` (the coordinate its wall runs along: x for a north or south wall, z for an east or
 * west one), or null when `pos` is not on it.
 */
export function alongSeg(g: Segment, pos: number): V2 | null {
  const k = axisOf(g.a, g.b)
  const [lo, hi] = spanOfSeg(g)
  if (pos < lo - 1e-6 || pos > hi + 1e-6 || hi - lo < 1e-9) return null
  const t = (pos - g.a[k]) / (g.b[k] - g.a[k])
  return [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t]
}

/**
 * What a segment's wall carries: its `decor`, and the wall's own `door` and `window` (placed by metres from the start
 * of the edge) as a feature at the coordinate along the wall.
 */
export function featuresOf(c: Ctx, g: Segment): Feature[] {
  const wall = wallOf(c, g)
  const features: Feature[] = [...(wall.decor ?? [])]
  const ring = ringsOf(c.sector)[g.ring] as V2[]
  const start = ring[g.edge] as V2
  const end = ring[(g.edge + 1) % ring.length] as V2
  const k = axisOf(start, end)
  const at = (metres: number): number => start[k] + Math.sign(end[k] - start[k]) * metres
  if (wall.door !== undefined)
    features.push({ kind: 'door', pos: at(wall.door.at), width: wall.door.width, height: wall.door.height })
  if (wall.window !== undefined)
    features.push({
      kind: 'window',
      pos: at(wall.window.at),
      width: wall.window.width,
      sill: wall.window.y0,
      height: wall.window.y1 - wall.window.y0,
    })
  return features
}

/** The wall a segment is on, as a key: its ring and edge. */
export const wallKey = (g: Segment): string => `${g.ring}.${g.edge}`

// --- placing ---

/** Whether a piece of `w` × `d` can stand at `spot`: every corner inside the room, nothing taken under it. */
export function fits(c: Ctx, spot: Spot, w: number, d: number): boolean {
  const { corners, rect } = turned(spot.at, w, d, spot.angle)
  return corners.every((p) => inside(c.poly, p[0], p[1])) && !c.occupied.some((o) => overlaps(rect, o))
}

/**
 * Places a prop in layer `layer` (its id `<room>:<layer>:<n>`), and takes its floor rectangle unless it hangs on a
 * wall.
 */
export function place(c: Ctx, layer: string, prop: Omit<PropPlace, 'id'>, rect?: Rect): void {
  const n = c.counts[layer] ?? 0
  c.counts[layer] = n + 1
  c.out.push({ ...prop, id: `${c.sector.id}:${layer}:${n}` })
  if (rect !== undefined) c.occupied.push(rect)
}

/**
 * What the room starts with taken: the strips before each doorway and door (0.9 m deep, 0.1 m wider each side), the
 * paths (0.45 m either side of each leg), and what was placed by hand inside it.
 */
export function reserve(c: Ctx): void {
  for (const g of c.segs) {
    const n = inward(c.level, g)
    const dir = dirOf(g)
    const a: V2 = [g.a[0] - dir[0] * 0.1, g.a[1] - dir[1] * 0.1]
    const b: V2 = [g.b[0] + dir[0] * 0.1, g.b[1] + dir[1] * 0.1]
    // A doorway: a portal.
    if (g.next >= 0)
      c.occupied.push(
        boxOf(a, b, [a[0] + n[0] * 0.9, a[1] + n[1] * 0.9], [b[0] + n[0] * 0.9, b[1] + n[1] * 0.9]),
      )
    // A door in a solid wall.
    else
      for (const feature of featuresOf(c, g)) {
        const p = feature.kind === 'door' ? alongSeg(g, feature.pos) : null
        if (p === null) continue
        const half = feature.width / 2 + 0.1
        const l: V2 = [p[0] - dir[0] * half, p[1] - dir[1] * half]
        const r: V2 = [p[0] + dir[0] * half, p[1] + dir[1] * half]
        c.occupied.push(
          boxOf(l, r, [l[0] + n[0] * 0.9, l[1] + n[1] * 0.9], [r[0] + n[0] * 0.9, r[1] + n[1] * 0.9]),
        )
      }
  }
  for (const path of Object.values(c.level.paths ?? {}))
    for (let i = 1; i < path.length; i++) {
      const [p, q] = [path[i - 1] as readonly number[], path[i] as readonly number[]]
      const r = boxOf([p[0] as number, p[1] as number], [q[0] as number, q[1] as number])
      c.occupied.push([r[0] - 0.45, r[1] - 0.45, r[2] + 0.45, r[3] + 0.45])
    }
  for (const placed of c.level.props ?? []) {
    const [x, z] = placed.at as [number, number]
    if (!inside(c.poly, x, z)) continue
    const print = footprintOf(c.library, placed)
    c.occupied.push(turned([x, z], print.w, print.d, Math.round((placed.angle ?? 90) / 90) * 90).rect)
  }
  for (const who of c.level.cast ?? []) {
    const [x, z] = who.at as [number, number]
    if (inside(c.poly, x, z)) c.occupied.push([x - 0.25, z - 0.25, x + 0.25, z + 0.25])
  }
}
