// An `af-sector/2` level resolved for the sim: loops normalised so the room is on the left of every edge (outer
// loops counter-clockwise on the plan, x right and z up; holes clockwise), pilasters expanded into notches with their
// masonry, portals linked, and the collision spans listed. The same steps as the 3D level editor's float geometry, on
// the sim's deterministic `hypot`. Edges link by index, not by reference: `sector` and `next` index
// `sectors`, `prev` and `succ` index the edge's own loop, so the result is plain data.
import {
  type AfCorner2,
  type AfWall2,
  DEFAULT_TRIM,
  type MassDef,
  type PartialTrim,
  type Point,
  type Trim,
  WALL_THICK,
} from '@automata/3d/level'
import { hypot } from '@automata/sim/math'
import { heightOf, type SectorMap, type StoredSector } from './check-level'
import { opening, type PieceKind, pieceSpans, walkBlocker } from './pieces'
import { insideSector, segmentDistance } from './queries'

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
  readonly wall: AfWall2
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
  /**
   * The loop was wound the other way to put the room on the left, so this edge runs against the order the file wrote
   * it. A wall's `door.at` and `window.at` are measured from the file's start of the wall, which is then `b`.
   */
  readonly reversed: boolean
}

export interface Sector
  extends Readonly<Omit<StoredSector, 'corners' | 'holes' | 'trim' | 'floor' | 'ceiling' | 'pit' | 'zone'>> {
  /** The floor and ceiling heights: the sim reads both flat (`checkLevel` reports a slope). */
  readonly floor: number
  readonly ceiling: number
  /** What the rules call the room's zone: the level's `zone`, or the room's own id when it names none. */
  readonly zone: string
  /** The floor is a drop, not ground: nothing stands on it, and `floorAt` is undefined there. */
  readonly pit: boolean
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
  /** The floor height under the point; undefined outside the map and over a pit. */
  floorAt(p: Point): number | undefined
  /** Whether the plan segment a→b crosses, or comes within `margin` of, a collider. */
  segmentBlocked(a: Point, b: Point, margin?: number): boolean
}

type Corner = AfCorner2

type Writable<T> = { -readonly [K in keyof T]: T[K] }

const wrapped = <T>(items: readonly T[], index: number): T => items[index % items.length] as T

const area = (points: readonly Corner[]): number =>
  points.reduce((sum, [x, z], i) => {
    const [x2, z2] = wrapped(points, i + 1)
    return sum + x * z2 - x2 * z
  }, 0) / 2

const flipPilaster = (w: AfWall2): AfWall2 =>
  w.pilaster ? { ...w, pilaster: { start: w.pilaster.end, end: w.pilaster.start } } : w

const corner = (x: number, z: number, wall: AfWall2 | undefined): Corner => (wall ? [x, z, wall] : [x, z])

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
  /** Whether the file's loop was wound the other way. */
  readonly reversed: boolean
  readonly loop: Corner[]
  /** Whether the wall from each corner is one of the walls round a pilaster's masonry. */
  readonly notched: boolean[]
}

/** Expands pilasters into notches in the loop, so trims wrap round them, and adds their masonry to `masses`. */
function notchPilasters(
  corners: readonly Corner[],
  top: number,
  masses: MassDef[],
  reversed: boolean,
): Notched {
  const out: Corner[] = []
  const notched: boolean[] = []
  const keep = (x: number, z: number, w: AfWall2 | undefined): void => {
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
    const side: AfWall2 = { ...plain, thick: 0 }
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
  return { loop: out, notched, reversed }
}

const withTrim = (base: Trim, over: PartialTrim | undefined): Trim => ({ ...base, ...over }) as Trim

/** A wall's trim heights: its `trim` when that is heights, and none when it names a surface (a string or a `tile`). */
const trimHeights = (trim: AfWall2['trim']): PartialTrim | undefined =>
  typeof trim === 'object' && !('tile' in trim) ? trim : undefined

function loopEdges(
  sector: number,
  li: number,
  { loop, notched, reversed }: Notched,
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
    // checkLevel reports this at the corner; a map that skipped the schema still fails loudly here.
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
      trim: withTrim(own.trim, trimHeights(wall.trim)),
      notch: notched[index] === true,
      reversed,
    }
    u += length
    return edge
  })
}

/** `level` resolved for the sim. A level `checkLevel` reports on may throw here (a portal to no room). */
export function resolveLevel(level: SectorMap): ResolvedMap {
  const masses: MassDef[] = [...(level.masses ?? [])]
  const raw: Notched[][] = []
  const sectors: Writable<Sector>[] = level.sectors.map((def) => {
    const top = heightOf(def.ceiling)
    // Outer loops wind counter-clockwise and holes clockwise; a loop written the other way is reversed.
    const wound = (loop: readonly Corner[], clockwise: boolean): Notched => {
      const reversed = clockwise ? area(loop) > 0 : area(loop) < 0
      return notchPilasters(reversed ? reverse(loop) : loop, top, masses, reversed)
    }
    const loops = [wound(def.corners, false), ...(def.holes ?? []).map((h) => wound(h, true))]
    raw.push(loops)
    const { corners: _corners, holes: _holes, trim, floor, ceiling, pit, zone, ...rest } = def
    return {
      ...rest,
      zone: zone ?? def.id,
      floor: heightOf(floor),
      ceiling: heightOf(ceiling),
      pit: pit === true,
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
    floorAt: (p) => {
      const here = sectorAt(p)
      return here === undefined || here.pit ? undefined : here.floor
    },
    segmentBlocked: (a, b, margin = 0) =>
      colliderEdges.some((e) => segmentDistance(a, b, e.a, e.b) <= margin),
  }
}
