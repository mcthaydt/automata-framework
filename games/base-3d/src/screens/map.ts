// The Map screen's plan (DESIGN.md §9.4, GAME-3D.1e part 5c), drawn from the area's compiled geometry: nothing is
// authored. Each room is a plan box named by its camera view; the room Wick stands in and the visited ones are
// filled, the rest outlined with the map and left out without it. Metres, with north (+z) up. Presentation.
import { Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import type { Area } from '../systems/index.ts'

/** A full turn in the sim's turn units. */
const TURN = 65_536

export type RoomState = 'here' | 'visited' | 'outline'

export interface PlanRect {
  readonly minX: number
  readonly minZ: number
  readonly maxX: number
  readonly maxZ: number
}

export interface MapPlan {
  /** Every room's box together, drawn or not, so the plan keeps its scale as rooms are found. */
  readonly bounds: PlanRect
  readonly rooms: readonly (PlanRect & { readonly id: string; readonly state: RoomState })[]
  readonly walls: readonly PlanRect[]
  /** Wick's place, and his facing in degrees clockwise from north. */
  readonly wick: { readonly x: number; readonly z: number; readonly facingDeg: number }
  /** The camera's heading, in degrees clockwise from north. */
  readonly headingDeg: number
}

/** What the map knows of the game: Wick's place (Q16.16) and facing, the camera's heading, the visits and the map. */
export interface MapAt {
  readonly x: number
  readonly z: number
  readonly facing: number
  readonly heading: number
  /** The view ids of the rooms visited (the save's `kiln.visited`). */
  readonly visited: readonly string[]
  readonly hasMap: boolean
}

const inMetres = (box: { minX: number; minZ: number; maxX: number; maxZ: number }): PlanRect => ({
  minX: box.minX / Q16,
  minZ: box.minZ / Q16,
  maxX: box.maxX / Q16,
  maxZ: box.maxZ / Q16,
})
const contains = (box: PlanRect, x: number, z: number): boolean =>
  x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ
/** Whether two boxes overlap or share an edge (a wall stands on a room's edge). */
const touches = (a: PlanRect, b: PlanRect): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ
const degrees = (units: number): number => (((units % TURN) + TURN) % TURN) * (360 / TURN)

/** The plan of `area` as the map draws it for `at`. */
export function mapOf(area: Area, at: MapAt): MapPlan {
  const x = at.x / Q16
  const z = at.z / Q16
  const all = area.rooms.map((room) => ({ id: room.view, ...inMetres(room) }))
  const here = all.find((room) => contains(room, x, z))
  const rooms = all.flatMap((room) => {
    const state: RoomState | undefined =
      room === here ? 'here' : at.visited.includes(room.id) ? 'visited' : at.hasMap ? 'outline' : undefined
    return state === undefined ? [] : [{ ...room, state }]
  })
  const walls = area.walls.map(inMetres).filter((wall) => rooms.some((room) => touches(wall, room)))
  return {
    bounds: {
      minX: Math.min(...all.map((room) => room.minX)),
      minZ: Math.min(...all.map((room) => room.minZ)),
      maxX: Math.max(...all.map((room) => room.maxX)),
      maxZ: Math.max(...all.map((room) => room.maxZ)),
    },
    rooms,
    walls,
    wick: { x, z, facingDeg: degrees(at.facing) },
    headingDeg: degrees(at.heading),
  }
}
