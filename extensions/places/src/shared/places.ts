import type { SimContext, SpawnPart } from '@automata/sim'

// The contract `narrative`, `cutscenes`, `nav` and `systems` read the world through. The plan is in metres, in 2D and
// 3D alike: `z` is down the plan (a 2D level's `y`). Pure types and two helpers; nothing here is sim state.

/** A point on the plan, in metres. */
export interface PlanPoint {
  readonly x: number
  readonly z: number
}

/** A room: an id the content names, and the zone the rules call it. */
export interface PlanRoom {
  readonly id: string
  readonly zone: string
}

/** Where a walker leaves one room for another: the middle of the edge they share, and a point just inside the far room. */
export interface PlanCrossing {
  readonly x: number
  readonly z: number
  readonly into: PlanPoint
}

/** Movement and sight over the plan. */
export interface Blocked {
  /** Whether the plan segment a→b is blocked within `margin` (walls, tall steps, a game's boxes). */
  segment(a: PlanPoint, b: PlanPoint, margin: number): boolean
  /** Whether a door (an edge's third member) is open. */
  open(door: string): boolean
}

/** How far into the far room a walker comes through a crossing, in metres. */
export const THROUGH = 0.5

export interface Places {
  /** The extension that provides the places: `sectors` (3D) or `level-2d` (2D). Consumers require it. */
  readonly provider: string
  /** Where entity `sid` stands, or undefined when it has no place. */
  at(ctx: SimContext, sid: number): PlanPoint | undefined
  /** Puts entity `sid` at `to`, in the game's own position (one owner for that state). */
  move(ctx: SimContext, sid: number, to: PlanPoint): void
  /** The components a new agent standing at `p` is spawned with. */
  spawnAt(p: PlanPoint): readonly SpawnPart[]
  /** The rooms, in a fixed order. */
  rooms(ctx: SimContext): readonly PlanRoom[]
  /** The room `p` is in, as its 1-based place in `rooms`; 0 for none. */
  roomAt(ctx: SimContext, p: PlanPoint): number
  /**
   * The room entity `sid` stands in as of the last step, as a 1-based place in `rooms`; 0 for none. In 3D that is the
   * membership sectors decided at the end of the last step, which can lag the position by one step; every consumer that
   * reads it before the step ends keeps reading what it always read.
   */
  roomOf(ctx: SimContext, sid: number): number
  /** Walking: walls, steps, doors. */
  walk(ctx: SimContext, doors: Readonly<Record<string, boolean>>): Blocked
  /** Line of sight past the walls. */
  sight(ctx: SimContext, doors: Readonly<Record<string, boolean>>): Blocked
  /** Where a walker leaves room `from` for room `to` (room ids); null when they do not touch. */
  crossing(ctx: SimContext, from: string, to: string): PlanCrossing | null
}

/** A `Blocked` over a wall test and the doors' state: a door is open when `doors` says so. */
export const blockedWith = (
  segment: (a: PlanPoint, b: PlanPoint, margin: number) => boolean,
  doors: Readonly<Record<string, boolean>>,
): Blocked => ({ segment, open: (door) => doors[door] === true })

/**
 * The crossing through an edge: its middle, and the point `THROUGH` metres past it into the far room. `normal` is the
 * edge's unit normal pointing into the room being left, so the far side is against it.
 */
export const crossingThrough = (middle: PlanPoint, normal: PlanPoint): PlanCrossing => ({
  x: middle.x,
  z: middle.z,
  into: { x: middle.x - normal.x * THROUGH, z: middle.z - normal.z * THROUGH },
})
