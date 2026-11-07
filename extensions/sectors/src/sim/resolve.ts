// A `sector-map` resolved for the sim (M6 spec §4.3): loops normalised so the room is on the left of every edge (outer
// loops counter-clockwise on the plan, x right and z up; holes clockwise), pilasters expanded into notches with their
// masonry, portals linked, and the collision spans listed. The same steps as the 3D level editor's float geometry, on
// the sim's deterministic `hypot` (§4.9). Edges link by index, not by reference (S4-D3): `sector` and `next` index
// `sectors`, `prev` and `succ` index the edge's own loop, so the result is plain data.
import {
  type Corner,
  DEFAULT_TRIM,
  type MassDef,
  type PartialTrim,
  type Point,
  type SectorDef,
  type Trim,
  WALL_THICK,
  type WallDef,
} from '@automata/3d/level'
import { hypot } from '@automata/sim/math'
import { opening, type PieceKind, pieceSpans, walkBlocker } from './pieces'
import { insideSector, segmentDistance } from './queries'
import type { SectorMap } from './sector-map.schema'

/** One wall of a sector, with its place in the loop and the numbers every query needs. */
export interface Edge {
  /** Index of its sector in `ResolvedMap.sectors`. */
  readonly sector: number
  readonly loop: number
  readonly index: number
  readonly a: Point
  readonly b: Point
  readonly length: number
  /** Unit direction a→b and the inward normal (into the room). */
  readonly dir: Point
  readonly normal: Point
  readonly wall: WallDef
  /** Index of the sector a portal leads into; undefined for a solid wall. */
  readonly next: number | undefined
  /** Distance along the loop to `a`. */
  readonly u0: number
  /** Indices of the neighbouring edges in the same loop. */
  readonly prev: number
  readonly succ: number
  readonly thick: number
  readonly cut: string
  readonly trim: Trim
  /** One of the three walls round a pilaster's masonry. */
  readonly notch: boolean
}

export interface Sector extends Readonly<Omit<SectorDef, 'corners' | 'holes' | 'trim'>> {
  readonly trim: Trim
  /** `loops[i]` are the edges of `points[i]`: the outer loop first, then the holes. */
  readonly loops: readonly (readonly Edge[])[]
  readonly points: readonly (readonly Point[])[]
}

/** A vertical span an edge builds. */
export interface Piece {
  readonly sector: number
  readonly loop: number
  readonly index: number
  readonly y0: number
  readonly y1: number
  readonly kind: PieceKind
}

/** A span a walker cannot pass: a walk-blocking piece, or a blocking masked portal across its opening. */
export interface Collider {
  readonly sector: number
  readonly loop: number
  readonly index: number
  readonly y0: number
  readonly y1: number
}

export interface ResolvedMap {
  readonly sectors: readonly Sector[]
  /** The map's own masses, then one for each pilaster. */
  readonly masses: readonly MassDef[]
  /** Every edge, sector by sector and loop by loop. */
  readonly edges: readonly Edge[]
  readonly pieces: readonly Piece[]
  readonly colliders: readonly Collider[]
  /** The first sector that holds the point. */
  sectorAt(p: Point): Sector | undefined
  /** The floor height under the point; undefined outside the map (S4-D4). */
  floorAt(p: Point): number | undefined
  /** Whether the plan segment a→b crosses, or comes within `margin` of, a collider. */
  segmentBlocked(a: Point, b: Point, margin?: number): boolean
}

type Writable<T> = { -readonly [K in keyof T]: T[K] }

const wrapped = <T>(items: readonly T[], index: number): T => items[index % items.length] as T

const area = (points: readonly Corner[]): number =>
  points.reduce((sum, [x, z], i) => {
    const [x2, z2] = wrapped(points, i + 1)
    return sum + x * z2 - x2 * z
  }, 0) / 2

const flipPilaster = (w: WallDef): WallDef =>
  w.pilaster ? { ...w, pilaster: { start: w.pilaster.end, end: w.pilaster.start } } : w

const corner = (x: number, z: number, wall: WallDef | undefined): Corner => (wall ? [x, z, wall] : [x, z])

/** Reverses a loop while keeping each wall on its own edge. */
function reverse(corners: readonly Corner[]): Corner[] {
  const n = corners.length
  return corners.map((_, j) => {
    const p = wrapped(corners, n - j)
    const w = wrapped(corners, 2 * n - j - 1)[2]
    return corner(p[0], p[1], w ? flipPilaster(w) : w)
  })
}

interface Notched {
  readonly loop: Corner[]
  /** Whether the wall from each corner is one of the walls round a pilaster's masonry. */
  readonly notched: boolean[]
}

/** Expands pilasters into notches in the loop, so trims wrap round them, and adds their masonry to `masses`. */
function notchPilasters(corners: readonly Corner[], top: number, masses: MassDef[]): Notched {
  const out: Corner[] = []
  const notched: boolean[] = []
  const keep = (x: number, z: number, w: WallDef | undefined): void => {
    out.push(corner(x, z, w))
    notched.push(false)
  }
  corners.forEach(([x, z, w], i) => {
    if (!w?.pilaster) {
      keep(x, z, w)
      return
    }
    const [x2, z2] = wrapped(corners, i + 1)
    const length = hypot(x2 - x, z2 - z)
    const d = { x: (x2 - x) / length, z: (z2 - z) / length }
    const n = { x: -d.z, z: d.x }
    const at = (along: number, into: number): Point => ({
      x: x + d.x * along + n.x * into,
      z: z + d.z * along + n.z * into,
    })
    const { pilaster, ...plain } = w
    const side: WallDef = { ...plain, thick: 0 }
    // Each pilaster is three short walls round a block of masonry that reaches back under the wall top.
    const notch = (s: number, width: number, depth: number): void => {
      out.push(
        [at(s, 0).x, at(s, 0).z, side],
        [at(s, depth).x, at(s, depth).z, side],
        [at(s + width, depth).x, at(s + width, depth).z, side],
      )
      notched.push(true, true, true)
      const mass: Writable<MassDef> = {
        points: [at(s, -WALL_THICK), at(s + width, -WALL_THICK), at(s + width, depth), at(s, depth)],
        top,
      }
      if (w.cut !== undefined) mass.cut = w.cut
      masses.push(mass)
    }
    if (pilaster.start) {
      notch(0, pilaster.start[0], pilaster.start[1])
      const q = at(pilaster.start[0], 0)
      keep(q.x, q.z, plain)
    } else keep(x, z, plain)
    if (pilaster.end) notch(length - pilaster.end[0], pilaster.end[0], pilaster.end[1])
  })
  return { loop: out, notched }
}

const withTrim = (base: Trim, over: PartialTrim | undefined): Trim => ({ ...base, ...over }) as Trim

function loopEdges(
  sector: number,
  li: number,
  { loop, notched }: Notched,
  own: Sector,
  byId: Map<string, number>,
  id: string,
): Edge[] {
  let u = 0
  const count = loop.length
  return loop.map(([x, z, w], index): Edge => {
    const [x2, z2] = wrapped(loop, index + 1)
    const length = hypot(x2 - x, z2 - z)
    const dir = { x: (x2 - x) / length, z: (z2 - z) / length }
    const wall = w ?? {}
    const next = wall.next === undefined ? undefined : byId.get(wall.next)
    // sectorMapSchema reports this at the corner; a map that skipped the schema still fails loudly here.
    if (wall.next !== undefined && next === undefined)
      throw new Error(`${id}: unknown portal target ${wall.next}`)
    const edge: Edge = {
      sector,
      loop: li,
      index,
      a: { x, z },
      b: { x: x2, z: z2 },
      length,
      dir,
      normal: { x: -dir.z, z: dir.x },
      wall,
      next,
      u0: u,
      prev: (index + count - 1) % count,
      succ: (index + 1) % count,
      thick: wall.thick ?? WALL_THICK,
      cut: wall.cut ?? `${id}:${li}:${index}`,
      trim: withTrim(own.trim, wall.trim),
      notch: notched[index] === true,
    }
    u += length
    return edge
  })
}

export function resolveMap(map: SectorMap): ResolvedMap {
  const masses: MassDef[] = [...(map.masses ?? [])]
  const raw: Notched[][] = []
  const sectors: Writable<Sector>[] = map.sectors.map((def) => {
    const outer = area(def.corners) < 0 ? reverse(def.corners) : def.corners
    const holes = (def.holes ?? []).map((h) => (area(h) > 0 ? reverse(h) : h))
    const loops = [outer, ...holes].map((loop) => notchPilasters(loop, def.ceiling, masses))
    raw.push(loops)
    const { corners: _corners, holes: _holes, trim, ...rest } = def
    return {
      ...rest,
      trim: withTrim(DEFAULT_TRIM, trim),
      loops: [],
      points: loops.map(({ loop }) => loop.map(([x, z]) => ({ x, z }))),
    }
  })
  const byId = new Map(sectors.map((s, i) => [s.id, i]))
  sectors.forEach((sector, si) => {
    sector.loops = (raw[si] ?? []).map((notched, li) => loopEdges(si, li, notched, sector, byId, sector.id))
  })
  const edges = sectors.flatMap((s) => s.loops.flat())
  const pieces: Piece[] = edges.flatMap((e) =>
    pieceSpans(sectors[e.sector] as Sector, e.next === undefined ? undefined : sectors[e.next]).map(
      (span) => ({
        sector: e.sector,
        loop: e.loop,
        index: e.index,
        ...span,
      }),
    ),
  )
  const colliders: Collider[] = [
    ...pieces.filter(walkBlocker).map(({ sector, loop, index, y0, y1 }) => ({ sector, loop, index, y0, y1 })),
    ...edges
      .filter((e) => e.next !== undefined && e.wall.block)
      .map((e) => ({
        sector: e.sector,
        loop: e.loop,
        index: e.index,
        ...opening(sectors[e.sector] as Sector, sectors[e.next as number] as Sector),
      })),
  ]
  const colliderEdges = colliders.map((c) => sectors[c.sector]?.loops[c.loop]?.[c.index] as Edge)
  const sectorAt = (p: Point): Sector | undefined => sectors.find((s) => insideSector(p, s))
  return {
    sectors,
    masses,
    edges,
    pieces,
    colliders,
    sectorAt,
    floorAt: (p) => sectorAt(p)?.floor,
    segmentBlocked: (a, b, margin = 0) =>
      colliderEdges.some((e) => segmentDistance(a, b, e.a, e.b) <= margin),
  }
}
