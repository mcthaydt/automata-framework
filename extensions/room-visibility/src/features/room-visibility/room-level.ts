// The part of an `af-sector/2` level this extension reads: each sector's id and its loops of corners, a wall's portal, its
// cutaway group and the camera zones it hides from, and how many masses there are. Structural, so a level read with
// `readLevel` (or any plain data of this shape) goes straight in.

import type { SectorPlan } from '@automata/3d/level'

export interface RoomWall {
  /** The sector on the other side of a portal. */
  readonly next?: string | undefined
  /** Cutaway group: walls with one id are hidden and owned together. */
  readonly cut?: string | undefined
  /** Camera zones that always cut this wall away. */
  readonly hideFrom?: readonly string[] | undefined
}

/** A corner starts the wall that runs from it to the next corner. */
export type RoomCorner = readonly [x: number, z: number, wall?: RoomWall | undefined]

export interface RoomSector {
  readonly id: string
  readonly corners: readonly RoomCorner[]
  readonly holes?: readonly (readonly RoomCorner[])[] | undefined
}

export interface RoomLevel {
  readonly sectors: readonly RoomSector[]
  /** Solid blocks that are not sectors; a room policy owns them by index. */
  readonly masses?: readonly unknown[] | undefined
}

/** A point on the plan: x east, z south. */
export interface PlanPoint {
  readonly x: number
  readonly z: number
}

/** A sector's loops as plan points, for a point-in-sector test. */
export interface RoomPlan extends SectorPlan {
  readonly id: string
}

const loop = (corners: readonly RoomCorner[]): PlanPoint[] => corners.map(([x, z]) => ({ x, z }))

/** Each sector's outer loop, then its holes. */
export function plansOf(level: RoomLevel): RoomPlan[] {
  return level.sectors.map((sector) => ({
    id: sector.id,
    points: [loop(sector.corners), ...(sector.holes ?? []).map(loop)],
  }))
}
