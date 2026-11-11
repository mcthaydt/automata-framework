import { describe, expect, it } from 'vitest'
import {
  checkRoomPolicy,
  parseRoomPolicy,
  roomPolicySchema,
} from '#src/features/room-visibility/room-policy.schema.ts'
import { LEVEL, POLICY } from './fixtures.ts'

const facts = { sectors: LEVEL.sectors.map((s) => s.id), zones: ['hall', 'corridor', 'closet'], massCount: 2 }
const messages = (policy: unknown) => checkRoomPolicy(parseRoomPolicy(policy), facts).map((p) => p.message)

describe('the room policy', () => {
  it('reads rooms, zones and masses, and a mass may be global', () => {
    expect(parseRoomPolicy(POLICY)).toEqual(POLICY)
  })

  it('a level with no masses leaves them out', () => {
    expect(parseRoomPolicy({ rooms: POLICY.rooms, zones: POLICY.zones }).masses).toEqual({})
  })

  it('refuses an empty room, an empty zone and an unknown key, in words', () => {
    expect(roomPolicySchema.safeParse({ ...POLICY, rooms: { ...POLICY.rooms, empty: [] } }).success).toBe(
      false,
    )
    expect(roomPolicySchema.safeParse({ ...POLICY, zones: { hall: [] } }).success).toBe(false)
    expect(roomPolicySchema.safeParse({ ...POLICY, extra: 1 }).success).toBe(false)
  })

  it('finds nothing wrong with a policy that covers the level', () => {
    expect(checkRoomPolicy(POLICY, facts)).toEqual([])
  })

  it('says which sector no room owns', () => {
    const without = {
      ...POLICY,
      rooms: { reception: ['hall', 'counter'], ward: ['ward'], corridor: ['corridor'] },
      zones: { hall: ['reception'], corridor: ['corridor'], closet: ['corridor'] },
    }
    expect(messages(without)).toContain('the sector "closet" is in no room')
  })

  it('says which sector two rooms both claim, and which sector is not in the level', () => {
    const twice = {
      ...POLICY,
      rooms: { ...POLICY.rooms, extra: ['hall'] },
      zones: { ...POLICY.zones, hall: ['reception', 'extra'] },
    }
    expect(messages(twice)).toContain('the sector "hall" is in more than one room (extra)')
    const ghost = { ...POLICY, rooms: { ...POLICY.rooms, ghosts: ['nowhere'] } }
    expect(messages(ghost)).toContain('the sector "nowhere" in room "ghosts" is not in the level')
  })

  it('says which zone has no rooms, which does not exist, and which names a room that is not there', () => {
    expect(messages({ ...POLICY, zones: { hall: ['reception'], corridor: ['corridor'] } })).toContain(
      'the zone "closet" has no rooms',
    )
    expect(messages({ ...POLICY, zones: { ...POLICY.zones, attic: ['ward'] } })).toContain(
      'the zone "attic" is not a camera zone of the level',
    )
    expect(messages({ ...POLICY, zones: { ...POLICY.zones, hall: ['lobby'] } })).toContain(
      'the zone "hall" sees the room "lobby", which is not there',
    )
  })

  it('says which mass no room owns, and a mass index that is not in the level', () => {
    expect(messages({ ...POLICY, masses: { 0: ['reception'] } })).toContain('the mass 1 has no owners')
    expect(messages({ ...POLICY, masses: { ...POLICY.masses, 7: ['ward'] } })).toContain(
      'the mass 7 is not in the level',
    )
    expect(messages({ ...POLICY, masses: { 0: ['lobby'], 1: 'global' } })).toContain(
      'the mass 0 is owned by the room "lobby", which is not there',
    )
  })
})
