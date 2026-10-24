// The rules for a join and a lock that the facility file alone can judge (ED3D.9b). One module holds them so that the
// World edits refuse with the sentence the facility checks report with (the check adds the member in front of it).
// What a side's door, opening or wall means inside the level it names is not here: that needs the level's geometry.
import type { Facility, FacilityLock, JoinSide } from '../../format/facility.schema'

const isBlank = (value: string): boolean => value.trim() === ''

/** What is wrong with one side of a join: the phase and the room are there and the name is a name. A street side is always fine. */
export function joinSideProblem(facility: Facility, side: JoinSide): string | undefined {
  if ('street' in side) return undefined
  const phase = facility.phases.find((each) => each.id === side.phase)
  if (phase === undefined) return `no phase ${side.phase}`
  // `rooms` is every room of the phase's blockout and `seen` a subset of it, so a side may name a seen room (the P3 yard).
  if (!phase.rooms.includes(side.room)) return `phase ${side.phase} has no room ${side.room}`
  if ('wall' in side)
    return Number.isInteger(side.wall) && side.wall >= 0
      ? undefined
      : `wall ${side.wall} is not a whole number from 0`
  if ('door' in side) return isBlank(side.door) ? 'a door needs a name' : undefined
  return isBlank(side.opening) ? 'an opening needs a name' : undefined
}

/** Which place a side is, as one string: two sides with the same key are the same side. */
function sideKey(side: JoinSide): string {
  if ('street' in side) return JSON.stringify([side.street])
  if ('wall' in side) return JSON.stringify([side.phase, side.room, 'wall', side.wall])
  if ('door' in side) return JSON.stringify([side.phase, side.room, 'door', side.door])
  return JSON.stringify([side.phase, side.room, 'opening', side.opening])
}

/** True when two sides are the same place: the same street end, or the same wall, door or opening of one room of one phase. */
export const sameJoinSide = (a: JoinSide, b: JoinSide): boolean => sideKey(a) === sideKey(b)

/** What is wrong with a lock's phases and place: it is on a phase of the facility, and it says where. */
export function lockProblem(facility: Facility, lock: FacilityLock): string | undefined {
  if (lock.phases.length === 0) return 'a lock needs at least one phase'
  const missing = lock.phases.find((id) => !facility.phases.some((phase) => phase.id === id))
  if (missing !== undefined) return `no phase ${missing}`
  const places = typeof lock.at === 'string' ? [lock.at] : lock.at
  if (places.length === 0 || places.some(isBlank))
    return 'a lock needs a place: the hotspot, box or wall door it is on'
  return undefined
}
