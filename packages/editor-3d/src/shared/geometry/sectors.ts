// A level's sectors as Build-engine sectors (as in eduke32). Each room is a polygon on the floor plan (x, z) with a floor height and a
// ceiling height; its edges are walls, each solid or a portal into the next sector. Loops are normalised so the room
// is on the left of every edge: outer loops run counter-clockwise on the plan (x right, z up), holes clockwise.
//
// Pure functions over data. The arithmetic is Last Light's expression for expression, so floats are bit-equal (the
// golden proves it); what changes is the types, and that the game's module state (`useMap`) is a value the caller holds.
import {
  type Corner,
  DEFAULT_TRIM,
  insideSector,
  type MassDef,
  opening,
  type PartialTrim,
  type Point,
  type SectorDef,
  type Trim,
  WALL_THICK,
  type WallDef,
  walkBlocker,
} from '@automata/3d/level'

/** One wall of a sector, with its place in the loop and the numbers every query needs. */
export interface Edge {
  readonly sector: Sector
  readonly loop: number
  readonly index: number
  readonly a: Point
  readonly b: Point
  readonly length: number
  /** Unit direction a→b and the inward normal (into the room). */
  readonly dir: Point
  readonly normal: Point
  readonly wall: WallDef
  readonly next: Sector | undefined
  /** Distance along the loop to `a`, so wall textures run on round corners without a jump. */
  readonly u0: number
  readonly prev: Edge
  readonly succ: Edge
  readonly thick: number
  readonly cut: string
  readonly trim: Trim
  /**
   * Whether it is one of the walls round a pilaster's masonry. Those belong to a wall of the definition but do not lie on
   * its line, and can lie on a neighbouring wall's, so a caller that maps an edge back to its corner has to tell them apart.
   * Not in Last Light: an addition, which no part of the port reads.
   */
  readonly notch: boolean
}

/** A sector with its loops resolved: `loops[i]` are the edges of `points[i]`, the outer loop first and then the holes. */
export interface Sector extends Readonly<Omit<SectorDef, 'corners' | 'holes' | 'trim'>> {
  readonly trim: Trim
  readonly loops: readonly (readonly Edge[])[]
  readonly points: readonly (readonly Point[])[]
}

/** The sectors a level resolves to, and its masses of masonry (the file's own, then one for each pilaster). */
export interface Resolved {
  readonly sectors: readonly Sector[]
  readonly masses: readonly MassDef[]
}

type Writable<T> = { -readonly [K in keyof T]: T[K] }

/** The item at `index`, wrapping round the list: the wall from the last corner runs to the first. */
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

/**
 * Expands pilasters into notches in the loop, so trims wrap round them, and adds their masonry. `notched[k]` says whether
 * the wall that starts at the loop's corner `k` is one of the walls round a pilaster's masonry.
 */
function notchPilasters(
  corners: readonly Corner[],
  top: number,
  masses: MassDef[],
): { loop: Corner[]; notched: boolean[] } {
  const out: Corner[] = []
  const notched: boolean[] = []
  /** A corner that starts a wall of the definition's own, or a plain stretch of it. */
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
    const length = Math.hypot(x2 - x, z2 - z)
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
      masses.push({
        points: [at(s, -WALL_THICK), at(s + width, -WALL_THICK), at(s + width, depth), at(s, depth)],
        top,
        cut: w.cut,
      })
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

/** `over` laid on `base`; a piece `over` leaves out keeps its value from `base`. */
const withTrim = (base: Trim, over: PartialTrim | undefined): Trim => ({ ...base, ...over }) as Trim

/** An edge before the loop it is in has linked it to its neighbours. */
type Unlinked = Omit<Writable<Edge>, 'prev' | 'succ'> & { prev?: Edge; succ?: Edge }

export function resolveSectors(defs: readonly SectorDef[], massDefs: readonly MassDef[] = []): Resolved {
  const masses = [...massDefs]
  const raw: { loop: Corner[]; notched: boolean[] }[][] = []
  const sectors: Writable<Sector>[] = defs.map((def) => {
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
  const byId = new Map(sectors.map((s) => [s.id, s]))
  sectors.forEach((sector, si) => {
    sector.loops = (raw[si] as { loop: Corner[]; notched: boolean[] }[]).map(({ loop, notched }, li) => {
      let u = 0
      const loopEdges = loop.map(([x, z, w], index): Unlinked => {
        const [x2, z2] = wrapped(loop, index + 1)
        const length = Math.hypot(x2 - x, z2 - z)
        const dir = { x: (x2 - x) / length, z: (z2 - z) / length }
        const wallDef = w ?? {}
        const next = wallDef.next ? byId.get(wallDef.next) : undefined
        if (wallDef.next && !next) throw new Error(`${sector.id}: unknown portal target ${wallDef.next}`)
        const edge: Unlinked = {
          sector,
          loop: li,
          index,
          a: { x, z },
          b: { x: x2, z: z2 },
          length,
          dir,
          normal: { x: -dir.z, z: dir.x },
          wall: wallDef,
          next,
          u0: u,
          thick: wallDef.thick ?? WALL_THICK,
          cut: wallDef.cut ?? `${sector.id}:${li}:${index}`,
          trim: withTrim(sector.trim, wallDef.trim),
          notch: notched[index] === true,
        }
        u += length
        return edge
      })
      // Every edge of the loop is linked here, before anything else sees it, so `prev` and `succ` are never missing.
      loopEdges.forEach((edge, i) => {
        edge.prev = wrapped(loopEdges, i + loopEdges.length - 1) as Edge
        edge.succ = wrapped(loopEdges, i + 1) as Edge
      })
      return loopEdges as Edge[]
    })
  })
  return { sectors, masses }
}

/** Every edge of the sectors, loop by loop. */
export const edges = (sectors: readonly Sector[]): Edge[] => sectors.flatMap((s) => s.loops.flat())

// ─── Geometry queries ─────────────────────────────────────────────────────
// `crossing`, `segmentDistance`, `insideSector` and `polygonArea` are the level format's (`@automata/3d/level`).

/** The first sector that holds the point. A point on a wall shared by two goes to the one the ray test puts it in. */
export const sectorAt = (map: Pick<Resolved, 'sectors'>, p: Point): Sector | undefined =>
  map.sectors.find((s) => insideSector(p, s))

/** Floor height under a point (0 outside the map). */
export const floorAt = (map: Pick<Resolved, 'sectors'>, x: number, z: number): number =>
  sectorAt(map, { x, z })?.floor ?? 0

// ─── Wall pieces: what each edge actually builds ─────────────────────────

/** A vertical span of wall along an edge. A portal leaves only the strips its neighbour does not open. */
export interface Piece {
  readonly edge: Edge
  readonly y0: number
  readonly y1: number
  readonly kind: 'wall' | 'lower' | 'upper'
}

/** An edge that is a portal into another sector. */
export type PortalEdge = Edge & { readonly next: Sector }

/** A span of wall the capsule cannot pass. */
export interface Collider {
  readonly edge: Edge
  readonly y0: number
  readonly y1: number
}

export function pieces(edge: Edge): Piece[] {
  const { sector: s, next } = edge
  if (!next) return [{ edge, y0: s.floor, y1: s.ceiling, kind: 'wall' }]
  const out: Piece[] = []
  if (next.floor > s.floor)
    out.push({ edge, y0: s.floor, y1: Math.min(next.floor, s.ceiling), kind: 'lower' })
  if (next.ceiling < s.ceiling)
    out.push({ edge, y0: Math.max(next.ceiling, s.floor), y1: s.ceiling, kind: 'upper' })
  return out
}

/** Whether the edge is a portal, which narrows it to one `opening` can measure. */
export const isPortal = (edge: Edge): edge is PortalEdge => edge.next !== undefined

/** The eye height of a standing figure: a wall that reaches it blocks the line of sight. */
const EYE_HEIGHT = 1.5

/** Everything resolved from a level's sectors: the lists the views and checks read, built once. */
export interface ResolvedMap extends Resolved {
  readonly edges: readonly Edge[]
  readonly pieces: readonly Piece[]
  /** Collision spans: every piece the capsule cannot pass, and blocking portals across their opening. */
  readonly colliders: readonly Collider[]
  /** Walls that block a standing figure's line of sight. Glass does not. */
  readonly sightWalls: readonly Edge[]
}

/** Last Light's `useMap`, returned as a value instead of bound to module state. */
export function resolveMap(defs: readonly SectorDef[], massDefs: readonly MassDef[] = []): ResolvedMap {
  const resolved = resolveSectors(defs, massDefs)
  const all = edges(resolved.sectors)
  const list = all.flatMap(pieces)
  const colliders: Collider[] = [
    ...list.filter(walkBlocker).map((p) => ({ edge: p.edge, y0: p.y0, y1: p.y1 })),
    ...all
      .filter(isPortal)
      .filter((e) => e.wall.block)
      .map((e) => ({ edge: e, ...opening(e) })),
  ]
  const sightWalls = list.filter((p) => p.y0 <= EYE_HEIGHT && p.y1 >= EYE_HEIGHT).map((p) => p.edge)
  return { ...resolved, edges: all, pieces: list, colliders, sightWalls }
}
