// What `geometry.golden.json` holds and how to put ported geometry in the same shape, so a test can compare the two.
import type { Blockout } from '../format/blockout.schema'
import { type Expanded, expand } from '../format/expand'
import type { Edge, Resolved, ResolvedMap } from '../geometry/sectors'
import { loadFixture, loadGolden } from './fixtures'

/** The four shipped blockouts, each of which the golden holds the geometry of. */
export const BLOCKOUT_NAMES = [
  'blockout-clinic',
  'blockout-clinic-dawn',
  'blockout-bay',
  'blockout-prologue',
] as const

export type BlockoutName = (typeof BLOCKOUT_NAMES)[number]

/** A `sectorAt` and `floorAt` grid over the plan's bounding box: the sector's index (or -1), and the floor height. */
export interface GoldenGrid {
  step: number
  x0: number
  z0: number
  sector: number[][]
  floor: number[][]
}

export interface GeometryGolden {
  map: {
    sectors: unknown
    masses: unknown
    pieces: unknown
    colliders: unknown
    sightWalls: unknown
  }
  grid: GoldenGrid
  nav: unknown
}

export function loadGeometryGolden(): Record<BlockoutName, GeometryGolden> {
  return JSON.parse(loadGolden('geometry')) as Record<BlockoutName, GeometryGolden>
}

/** The expanded data a blockout gives, which is what Last Light's `useMap` took when the golden was recorded. */
export function expandedBlockout(name: BlockoutName): Expanded {
  return expand(JSON.parse(loadFixture(name)) as Blockout)
}

/** An edge by where it lives: its sector, its loop and its place in the loop. */
export const edgeRef = (edge: Edge): { sector: string; loop: number; index: number } => ({
  sector: edge.sector.id,
  loop: edge.loop,
  index: edge.index,
})

const edgeShape = (edge: Edge): unknown => ({
  loop: edge.loop,
  index: edge.index,
  a: edge.a,
  b: edge.b,
  length: edge.length,
  dir: edge.dir,
  normal: edge.normal,
  wall: edge.wall,
  next: edge.next ? edge.next.id : null,
  u0: edge.u0,
  thick: edge.thick,
  cut: edge.cut,
  trim: edge.trim,
  prev: edge.prev.index,
  succ: edge.succ.index,
})

/** Sectors as the golden writes them (the links between edges become indexes), through a JSON round trip: the golden is JSON, which writes -0 as 0. */
export function sectorsShape(resolved: Resolved): unknown {
  return JSON.parse(
    JSON.stringify(
      resolved.sectors.map(({ loops, ...rest }) => ({
        ...rest,
        loops: loops.map((loop) => loop.map(edgeShape)),
      })),
    ),
  )
}

const asJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

/** The wall pieces, colliders and sight walls as the golden writes them: each edge by where it lives. */
export function piecesShape(map: ResolvedMap): { pieces: unknown; colliders: unknown; sightWalls: unknown } {
  return {
    pieces: asJson(map.pieces.map((p) => ({ ...edgeRef(p.edge), y0: p.y0, y1: p.y1, kind: p.kind }))),
    colliders: asJson(map.colliders.map((c) => ({ ...edgeRef(c.edge), y0: c.y0, y1: c.y1 }))),
    sightWalls: asJson(map.sightWalls.map(edgeRef)),
  }
}
