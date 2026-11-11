// The room policy, as data: which sectors make each room, which rooms each camera zone sees, and which rooms own each
// mass (by its index in the level). A game writes it beside its level; `checkRoomPolicy` says in words what the level
// and the policy disagree about, and never throws.

import { z } from 'zod'

const owners = z.union([
  z.literal('global'),
  z.array(z.string()).min(1, 'a mass needs at least one owner, or "global"'),
])

export const roomPolicySchema = z.strictObject({
  /** Room id to the ids of the sectors in it. A sector is in exactly one room. */
  rooms: z.record(z.string(), z.array(z.string()).min(1, 'a room needs at least one sector')),
  /** Camera zone to the rooms it sees. */
  zones: z.record(z.string(), z.array(z.string()).min(1, 'a zone needs at least one room')),
  /** Mass index (as a number) to the rooms that own it, or `global` for one that always draws. A level with no masses leaves it out. */
  masses: z.record(z.string(), owners).default({}),
})

export type RoomOwners = readonly string[] | 'global'
export interface RoomPolicy {
  readonly rooms: Readonly<Record<string, readonly string[]>>
  readonly zones: Readonly<Record<string, readonly string[]>>
  readonly masses: Readonly<Record<string, RoomOwners>>
}

/** Reads a policy. Throws a `ZodError` naming what is wrong in its shape. */
export const parseRoomPolicy = (input: unknown): RoomPolicy => roomPolicySchema.parse(input)

/** What a policy is checked against: the level's sector ids, its camera zones and how many masses it has. */
export interface RoomFacts {
  readonly sectors: readonly string[]
  readonly zones: readonly string[]
  readonly massCount: number
}

export interface RoomPolicyProblem {
  /** Where in the policy: `rooms.ward`, `zones.hall`, `masses.1`. */
  readonly at: string
  readonly message: string
}

const has = (record: object, key: string): boolean => Object.hasOwn(record, key)

/** Everything the policy and the level disagree about, as a list (empty when they agree). */
export function checkRoomPolicy(policy: RoomPolicy, facts: RoomFacts): RoomPolicyProblem[] {
  const problems: RoomPolicyProblem[] = []
  const problem = (at: string, message: string): void => void problems.push({ at, message })
  const ids = new Set(facts.sectors)
  const claimed = new Set<string>()
  for (const [room, members] of Object.entries(policy.rooms)) {
    for (const id of members) {
      if (!ids.has(id)) problem(`rooms.${room}`, `the sector "${id}" in room "${room}" is not in the level`)
      else if (claimed.has(id))
        problem(`rooms.${room}`, `the sector "${id}" is in more than one room (${room})`)
      claimed.add(id)
    }
  }
  for (const id of ids) if (!claimed.has(id)) problem('rooms', `the sector "${id}" is in no room`)
  for (const zone of facts.zones)
    if (!has(policy.zones, zone)) problem(`zones.${zone}`, `the zone "${zone}" has no rooms`)
  for (const [zone, seen] of Object.entries(policy.zones)) {
    if (!facts.zones.includes(zone))
      problem(`zones.${zone}`, `the zone "${zone}" is not a camera zone of the level`)
    for (const room of seen)
      if (!has(policy.rooms, room))
        problem(`zones.${zone}`, `the zone "${zone}" sees the room "${room}", which is not there`)
  }
  for (let i = 0; i < facts.massCount; i++)
    if (!has(policy.masses, String(i))) problem(`masses.${i}`, `the mass ${i} has no owners`)
  for (const [key, mass] of Object.entries(policy.masses)) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || index >= facts.massCount)
      problem(`masses.${key}`, `the mass ${key} is not in the level`)
    if (mass === 'global') continue
    for (const room of mass)
      if (!has(policy.rooms, room))
        problem(`masses.${key}`, `the mass ${key} is owned by the room "${room}", which is not there`)
  }
  return problems
}

/** The room of each sector, from the policy. */
export const roomOfSector = (policy: RoomPolicy): Map<string, string> =>
  new Map(Object.entries(policy.rooms).flatMap(([room, ids]) => ids.map((id) => [id, room] as const)))
