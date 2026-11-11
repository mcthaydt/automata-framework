// The pending use and what reach means, with no extension behind them: plain points and numbers. A use is pending while
// the walker is on its way; each tick the game's walker is either in reach (the use fires), still walking, or has
// nowhere left to walk (the use is dropped). Kept apart from the rest of the extension so it can move to core unchanged
// if a second game, or the UI editor, needs it.
import { hypot } from '@automata/sim/math'

/** A use that has been asked for and not yet done: which hotspot, and the item held when it was asked. */
export interface Pending {
  readonly at: string
  readonly held?: string | undefined
}

/** A point on the plan, in metres. */
export interface Standing {
  readonly x: number
  readonly z: number
}

/** A place a walker may act on from within `reach` metres. */
export interface Spot extends Standing {
  readonly id: string
  readonly reach: number
}

/** Whether a walker standing at `from` is near enough to act on `spot`. */
export const inReach = (from: Standing, spot: Spot): boolean =>
  hypot(spot.x - from.x, spot.z - from.z) <= spot.reach

/** The spots in reach of `from`, nearest first; a tie goes to the lower id, so the order is the same every run. */
export function nearestInReach<S extends Spot>(from: Standing, spots: readonly S[]): S[] {
  return spots
    .filter((spot) => inReach(from, spot))
    .map((spot) => ({ spot, d: hypot(spot.x - from.x, spot.z - from.z) }))
    .sort((a, b) => a.d - b.d || (a.spot.id < b.spot.id ? -1 : a.spot.id > b.spot.id ? 1 : 0))
    .map((entry) => entry.spot)
}

/** What a pending use does this tick: act now, wait for the walk, or give up because the walk has ended short. */
export type Fate = 'fire' | 'wait' | 'drop'

/** The fate of a pending use at `spot` for a walker at `from` that is (or is not) still walking somewhere. */
export function fateOf(from: Standing | undefined, spot: Spot, walking: boolean): Fate {
  if (from !== undefined && inReach(from, spot)) return 'fire'
  return from !== undefined && walking ? 'wait' : 'drop'
}
