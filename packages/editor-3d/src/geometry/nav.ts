// Extracted from The Last Light src/game/nav.ts (92e6704): clearance on the plan, which `validate` and the scene tests
// ask of a level (can a walk from a to b run through a wall, a box, a shut door?) and the plan, dollhouse and walk
// views ask for hit testing. `route`, `reserveNodes` and `reachable` are game behaviour (pathing for pursuers) and
// stay behind. Last Light's module state (the live map and level, and caches rebuilt when either changes) is a
// `NavWorld` the caller builds once for a resolved map and a level.

import type { NavEdge } from '../format/blockout.schema'
import type { Box } from '../format/expand'
import type { Point } from '../format/sector.schema'
import { type Edge, insideSector, type ResolvedMap, type Sector, STEP, segmentDistance } from './sectors'

/** Which doors are open, by door id. */
export type NavState = Readonly<Record<string, boolean | undefined>>

/**
 * Every door open, which is how the checks and the scene tests ask (Last Light's `validate` builds the same list): the
 * nav only ever stops a walk at a shut door box.
 */
export const openDoors = (level: Pick<NavLevel, 'boxes'>): NavState =>
  Object.fromEntries(level.boxes.filter((box) => box.kind === 'door').map((box) => [box.id, true]))

/** The parts of a level the queries read: the solid things in the rooms, and the authored nav graph. */
export interface NavLevel {
  readonly boxes: readonly Box[]
  readonly nodes: Readonly<Record<string, Point>>
  readonly edges: readonly NavEdge[]
}

/** A level on a resolved map, with the lists the queries scan built once. */
export interface NavWorld extends NavLevel {
  /** Edges that stop walking: every collider's edge, once. */
  readonly walkEdges: readonly Edge[]
  /** Edges that hide a standing figure. */
  readonly sightEdges: readonly Edge[]
  /** Raised solids (a counter): sectors with no neighbour a step away. A dock or a stair step has one, so it is floor. */
  readonly solids: ReadonlySet<Sector>
}

export function navWorld(map: ResolvedMap, level: NavLevel): NavWorld {
  return {
    boxes: level.boxes,
    nodes: level.nodes,
    edges: level.edges,
    walkEdges: [...new Set(map.colliders.map((c) => c.edge))],
    sightEdges: [...new Set(map.sightWalls)],
    solids: new Set(
      map.sectors.filter((s) =>
        s.loops.flat().every((e) => !e.next || Math.abs(e.next.floor - s.floor) > STEP),
      ),
    ),
  }
}

/** Liang–Barsky clip of segment a→b against a box footprint grown by `margin`. */
export function segmentHitsBox(a: Point, b: Point, box: Box, margin = 0): boolean {
  let near = 0
  let far = 1
  const axes: [number, number, number, number][] = [
    [a.x, b.x - a.x, box.x, box.w / 2 + margin],
    [a.z, b.z - a.z, box.z, box.d / 2 + margin],
  ]
  for (const [start, delta, center, half] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (start < center - half || start > center + half) return false
      continue
    }
    const t1 = (center - half - start) / delta
    const t2 = (center + half - start) / delta
    near = Math.max(near, Math.min(t1, t2))
    far = Math.min(far, Math.max(t1, t2))
    if (near > far) return false
  }
  return true
}

const blocks = (box: Box, nav: NavState, wallsOnly: boolean): boolean =>
  box.kind === 'exit' || (box.kind === 'door' && !nav[box.id]) || (!wallsOnly && box.kind !== 'door')

/**
 * Within `margin` of a sector wall: walls that stop walking, or (for sight) the ones that hide a standing figure.
 * As with boxes, an end inside a raised solid (a hotspot on the counter) ignores that solid's sides; a raised floor
 * walked on (the Bay's docks and their stairs) keeps them, so a walk between levels goes round by the stairs.
 */
const raisedAround = (world: NavWorld, e: Edge, p: Point): boolean =>
  !!e.next && e.next.floor - e.sector.floor > STEP && world.solids.has(e.next) && insideSector(p, e.next)

const nearWall = (world: NavWorld, a: Point, b: Point, margin: number, sight: boolean): boolean =>
  (sight ? world.sightEdges : world.walkEdges).some((e) => {
    if (raisedAround(world, e, a) || raisedAround(world, e, b)) return false
    const d = segmentDistance(a, b, e.a, e.b)
    return d === 0 || d < margin
  })

const inside = (p: Point, box: Box, margin: number): boolean =>
  Math.abs(p.x - box.x) <= box.w / 2 + margin && Math.abs(p.z - box.z) <= box.d / 2 + margin

/** How close a point may be to a sector wall (blocking glass included) before this says it is: within `margin`, or in it. */
export const nearAWall = (world: NavWorld, p: Point, margin: number): boolean =>
  nearWall(world, p, p, margin, false)

/** Whether a straight walk from a to b runs into a sector wall (blocking glass included); furniture aside. */
export const throughWall = (world: NavWorld, a: Point, b: Point): boolean => nearWall(world, a, b, 0, false)

/** Line of sight ignores furniture; walking clearance does not. An endpoint inside an obstacle (a hotspot on a desk) ignores that obstacle. */
export function clear(
  world: NavWorld,
  a: Point,
  b: Point,
  nav: NavState,
  margin = 0,
  wallsOnly = false,
): boolean {
  if (nearWall(world, a, b, margin, wallsOnly)) return false
  return !world.boxes.some(
    (box) =>
      blocks(box, nav, wallsOnly) &&
      !(inside(a, box, margin) || inside(b, box, margin)) &&
      segmentHitsBox(a, b, box, margin),
  )
}

/** The authored node nearest the point that a walk can reach, or null. */
export function nearestNode(world: NavWorld, p: Point, nav: NavState, margin = 0.2): string | null {
  let best: string | null = null
  let distance = Number.POSITIVE_INFINITY
  for (const [id, node] of Object.entries(world.nodes)) {
    const d = Math.hypot(node.x - p.x, node.z - p.z)
    if (d < distance && clear(world, p, node, nav, margin)) {
      best = id
      distance = d
    }
  }
  return best
}
