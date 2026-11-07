// The states the pieces of a built world are in while a scene plays: how far a door stands open, how bright a lamp
// burns, where a prop is and whether it is there. Plain data a track can drive (the sim, a cutscene extension and the
// renderer all read the same shape); nothing here knows a renderer. A piece with no entry is as the builder put it: a
// door shut, a lamp as authored, a prop where it was placed.
//
// Rewritten from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/stage/state.ts at 6d82a52 (`StateScript`
// and `Snapshot`): only the state of the pieces stays here; the keys, the director and the time of day are not core.

/** A point in the world: x, up, z. */
type Point = readonly [number, number, number]

/** A lamp's state: how bright it burns (1 as authored, 0 out) and, if it changes, its colour (`0xRRGGBB`). */
export interface LampState {
  readonly level: number
  readonly color?: number | undefined
}

/**
 * A prop's state: where its base stands now (the world's x, up, z), how far it is turned about its base from the way
 * it was placed (degrees, counter-clockwise seen from above), and whether it has gone.
 */
export interface PropState {
  readonly at?: Point | undefined
  readonly turn?: number | undefined
  readonly hidden?: boolean | undefined
}

export interface PieceStates {
  /** Doors by the id of the room that holds them: 0 shut … 1 open. */
  readonly doors: Readonly<Record<string, number>>
  /** Lamps by id (a level lamp's own, or `<prop>.light<n>` for the lamp a prop carries). */
  readonly lamps: Readonly<Record<string, LampState>>
  /** Props by id. */
  readonly props: Readonly<Record<string, PropState>>
}

/** Every piece as the builder put it. */
export const noPieceStates = (): PieceStates => ({ doors: {}, lamps: {}, props: {} })

/** How far the door of room `sector` stands open, held between shut (0) and open (1). */
export function doorOpen(states: PieceStates, sector: string): number {
  return Math.max(0, Math.min(1, states.doors[sector] ?? 0))
}

/** The state of a lamp: as authored (level 1) when it has none. */
export const lampState = (states: PieceStates, id: string): LampState => states.lamps[id] ?? { level: 1 }

/** The state of a prop: `{}`, the prop as placed, when it has none. */
export const propState = (states: PieceStates, id: string): PropState => states.props[id] ?? {}

/** Whether two states of a prop are the same by value. */
export function sameProp(a: PropState, b: PropState): boolean {
  return (
    a.turn === b.turn &&
    (a.hidden === true) === (b.hidden === true) &&
    (a.at === undefined ? b.at === undefined : b.at !== undefined && a.at.every((v, i) => v === b.at?.[i]))
  )
}
