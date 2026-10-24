// The `policy` check (ED3D.2b-2): The Last Light's room-visibility policy groups the sectors of a level into rooms and
// says which rooms each camera zone and each mass shows. This is the game's `validateRoomPolicy` (src/render/room-visibility.ts,
// 92e6704), which throws at the first fault, saying every fault instead, in its order and in its sentences. The policy is
// the game's, not the level file's: the host reads it from the scene and hands it in, with the ids it is checked against.
import { entitySelection, type Problem, place, sectorSelection } from '../check'

/** The rooms a camera zone or a mass shows, or `'global'` for a mass that shows in every room. */
export type RoomOwners = readonly string[] | 'global'

/**
 * The game's policy: rooms by name with the sectors they hold, the rooms each camera zone shows, and the owners of each
 * mass by its index. The game types a zone's owners as a list, but its validator takes `'global'` there as it does for a
 * mass, so this check does too.
 */
export interface RoomPolicy {
  readonly rooms: Readonly<Record<string, readonly string[]>>
  readonly zones: Readonly<Record<string, readonly string[]>>
  readonly masses: Readonly<Record<number, RoomOwners>>
}

/**
 * Every fault of `policy` against the level's sector ids, camera-zone ids and number of masses, in the order the game's
 * validator looks: the rooms and their sectors, the sectors no room holds, the level's zones, the policy's zones the
 * level lacks, the masses, the policy's masses the level lacks. A sector or zone the level has is located at it; the
 * rest name something the level does not have, or are about a room or a mass, and have no place.
 */
export function roomPolicyProblems(
  policy: RoomPolicy,
  sectors: readonly string[],
  zones: readonly string[],
  massCount: number,
): Problem[] {
  const problems: Problem[] = []
  const say = (message: string, locator?: Problem['locator']): number => problems.push({ message, locator })
  const sectorIds = new Set(sectors)
  const assigned = new Set<string>()
  // An own entry only: `constructor` or `toString` is no room, zone or mass of the policy.
  const own = <T>(record: Readonly<Record<string | number, T>>, key: string | number): T | undefined =>
    Object.hasOwn(record, key) ? record[key] : undefined
  const invalidOwners = (owners: RoomOwners): boolean =>
    owners !== 'global' &&
    (owners.length === 0 || owners.some((room) => own(policy.rooms, room) === undefined))

  for (const [room, members] of Object.entries(policy.rooms)) {
    if (members.length === 0) say(`${room}: empty room`)
    for (const id of members) {
      const known = sectorIds.has(id)
      if (known && !assigned.has(id)) {
        assigned.add(id)
        continue
      }
      // An id the level lacks is nowhere to point at; one it has was listed by an earlier room or by this one.
      say(`${room}: unknown or duplicate sector ${id}`, known ? place(() => sectorSelection(id)) : undefined)
    }
  }
  for (const id of sectorIds)
    if (!assigned.has(id))
      say(
        `unassigned sector ${id}`,
        place(() => sectorSelection(id)),
      )

  for (const zone of zones) {
    const owners = own(policy.zones, zone)
    const at = place(() => entitySelection('zone', zone))
    if (owners === undefined) say(`unassigned zone ${zone}`, at)
    else if (invalidOwners(owners)) say(`${zone}: invalid room owners`, at)
  }
  for (const zone of Object.keys(policy.zones)) if (!zones.includes(zone)) say(`unknown zone ${zone}`)

  for (let mass = 0; mass < massCount; mass++) {
    const owners = own(policy.masses, mass)
    if (owners === undefined) say(`unassigned mass ${mass}`)
    else if (invalidOwners(owners)) say(`mass ${mass}: invalid room owners`)
  }
  for (const key of Object.keys(policy.masses)) {
    const mass = Number(key)
    if (!Number.isInteger(mass) || mass < 0 || mass >= massCount) say(`unknown mass ${key}`)
  }
  return problems
}
