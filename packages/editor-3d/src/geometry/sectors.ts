// Extracted from The Last Light src/game/sectors.ts (92e6704) and src/game/sector-format.ts: a level's sectors as
// Build-engine sectors (as in eduke32). Each room is a polygon on the floor plan (x, z) with a floor height and a
// ceiling height; its edges are walls, each solid or a portal into the next sector. Loops are normalised so the room
// is on the left of every edge: outer loops run counter-clockwise on the plan (x right, z up), holes clockwise.
//
// Pure functions over data. The arithmetic is Last Light's expression for expression, so floats are bit-equal (the
// golden proves it); what changes is the types, and that the game's module state (`useMap`) is a value the caller holds.
import type { Corner, SectorDef } from '../format/expand'
import type { MassDef, PartialTrim, Point, Trim, WallDef } from '../format/sector.schema'

/** Masonry thickness behind a wall's face when the wall does not say. */
export const WALL_THICK = 0.125
/** A floor step a person can walk up. Anything taller is a wall. */
export const STEP = 0.25
/** What a sector's trim is, laid under whatever the sector and then its walls set. */
export const DEFAULT_TRIM: Trim = { skirting: 0.14, wainscot: 1.14, rail: 0.08, cap: true }

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

/** Expands pilasters into notches in the loop, so trims wrap round them, and adds their masonry. */
function notchPilasters(corners: readonly Corner[], top: number, masses: MassDef[]): Corner[] {
  const out: Corner[] = []
  corners.forEach(([x, z, w], i) => {
    if (!w?.pilaster) {
      out.push(corner(x, z, w))
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
      masses.push({
        points: [at(s, -WALL_THICK), at(s + width, -WALL_THICK), at(s + width, depth), at(s, depth)],
        top,
        cut: w.cut,
      })
    }
    if (pilaster.start) {
      notch(0, pilaster.start[0], pilaster.start[1])
      const q = at(pilaster.start[0], 0)
      out.push([q.x, q.z, plain])
    } else out.push([x, z, plain])
    if (pilaster.end) notch(length - pilaster.end[0], pilaster.end[0], pilaster.end[1])
  })
  return out
}

/** `over` laid on `base`; a piece `over` leaves out keeps its value from `base`. */
const withTrim = (base: Trim, over: PartialTrim | undefined): Trim => ({ ...base, ...over }) as Trim

/** An edge before the loop it is in has linked it to its neighbours. */
type Unlinked = Omit<Writable<Edge>, 'prev' | 'succ'> & { prev?: Edge; succ?: Edge }

export function resolveSectors(defs: readonly SectorDef[], massDefs: readonly MassDef[] = []): Resolved {
  const masses = [...massDefs]
  const raw: Corner[][][] = []
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
      points: loops.map((loop) => loop.map(([x, z]) => ({ x, z }))),
    }
  })
  const byId = new Map(sectors.map((s) => [s.id, s]))
  sectors.forEach((sector, si) => {
    sector.loops = (raw[si] as Corner[][]).map((loop, li) => {
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
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t)
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
export const insideSector = (p: Point, s: Sector): boolean =>
  insideLoop(p, s.points[0] as readonly Point[]) && !s.points.slice(1).some((h) => insideLoop(p, h))

/** The first sector that holds the point. A point on a wall shared by two goes to the one the ray test puts it in. */
export const sectorAt = (map: Pick<Resolved, 'sectors'>, p: Point): Sector | undefined =>
  map.sectors.find((s) => insideSector(p, s))

/** Floor height under a point (0 outside the map). */
export const floorAt = (map: Pick<Resolved, 'sectors'>, x: number, z: number): number =>
  sectorAt(map, { x, z })?.floor ?? 0

export const polygonArea = (points: readonly Point[]): number =>
  points.reduce((sum, p, i) => {
    const q = wrapped(points, i + 1)
    return sum + p.x * q.z - q.x * p.z
  }, 0) / 2
