import { type AfCorner2, type AfSector2, insideSector, type SectorPlan } from '@automata/3d/level'
import type { Tuning } from './tuning.ts'

// Reads a room the 3D level editor wrote into what this game plays: the floors Wick can stand on, the props he cannot
// walk through, and where he starts. Pure, so the sim can hold the result. Everything is in metres.

/** A prop's round footprint: Wick cannot come nearer its centre than its radius. */
export interface Blocker {
  readonly x: number
  readonly z: number
  readonly r: number
}

/** A room as the game plays it. */
export interface Room {
  readonly id: string
  /** The floors, one for each room in the file (a pit is not a floor). */
  readonly floors: readonly SectorPlan[]
  readonly blockers: readonly Blocker[]
  /** Where Wick starts. */
  readonly start: { readonly x: number; readonly z: number }
}

/** What the sim reads as its content: the room and the numbers a designer tunes. */
export interface PlayContent {
  readonly room: Room
  readonly tuning: Tuning
}

/** The content a system finds in ctx.content: the app gives the sim PlayContent (src/app/game.ts). */
export const playIn = (content: unknown): PlayContent => content as PlayContent

/** The part of a prop's definition (content/world-props) that decides its footprint. */
export interface PropShape {
  readonly kind: string
  /** A box's width, height and depth. */
  readonly size?: readonly number[] | undefined
  /** A cylinder's radius. */
  readonly radius?: number | undefined
}

const point = (corner: AfCorner2) => ({ x: corner[0], z: corner[1] })

/** The round footprint that covers a prop: a cylinder's radius, or a box's corners whichever way it is turned. */
function reachOf(shape: PropShape | undefined): number {
  if (shape?.kind === 'cylinder') return shape.radius ?? 0.5
  const [width = 1, , depth = 1] = shape?.size ?? []
  return Math.sqrt(width * width + depth * depth) / 2
}

/** The room in `level`, with each prop's footprint from `props` (the game's content, by prop name). */
export function roomOf(level: AfSector2, props: Readonly<Record<string, PropShape>>): Room {
  const floors = level.sectors
    .filter((sector) => sector.pit !== true)
    .map((sector) => ({
      points: [sector.corners.map(point), ...(sector.holes ?? []).map((hole) => hole.map(point))],
    }))
  const blockers = (level.props ?? []).map((prop) => ({
    x: prop.at[0] ?? 0,
    z: prop.at[1] ?? 0,
    r: reachOf(props[prop.use ?? '']),
  }))
  const starts = (level.entities ?? []).filter((entity) => entity.def === 'spawn')
  const [start] = starts
  if (starts.length !== 1 || start === undefined)
    throw new Error(
      'Room "' +
        level.name +
        '" needs one start point. It has ' +
        starts.length +
        '. Open the room in the level editor and place one.',
    )
  return { id: level.name, floors, blockers, start: { x: start.x, z: start.z } }
}

/** True when a square of half-side `half` centred on (x, z) is on the floor and clear of every prop. */
export function standsAt(room: Room, x: number, z: number, half: number): boolean {
  for (const [dx, dz] of [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ] as const)
    if (!room.floors.some((floor) => insideSector({ x: x + dx, z: z + dz }, floor))) return false
  return room.blockers.every((blocker) => {
    const apart = Math.sqrt((x - blocker.x) * (x - blocker.x) + (z - blocker.z) * (z - blocker.z))
    return apart >= blocker.r + half
  })
}
