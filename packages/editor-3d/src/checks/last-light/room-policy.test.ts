// The `policy` check (ED3D.2b-2): the game's room-visibility policy groups every sector of the level into a room, gives
// every camera zone and mass its owners, and names nothing the level does not have. Held to The Last Light's own
// `validateRoomPolicy` by the recorded corpus: each single-fault policy gives the sentence the game threw, and the
// check says every fault where the game stops at the first.
import { describe, expect, it } from 'vitest'
import { loadGameFactCases, loadGameFacts } from '../../testing/game-facts'
import { type RoomPolicy, roomPolicyProblems } from './room-policy'

const facts = loadGameFacts()
const cases = loadGameFactCases()

const policy = (more: Partial<RoomPolicy> = {}): RoomPolicy => ({
  rooms: { reception: ['hall', 'counter'], supply: ['closet'] },
  zones: { hall: ['reception'], closet: ['supply'] },
  masses: {},
  ...more,
})
const SECTORS = ['hall', 'counter', 'closet']
const ZONES = ['hall', 'closet']

const messages = (found: ReturnType<typeof roomPolicyProblems>) => found.map((problem) => problem.message)

describe('roomPolicyProblems: against the game’s own validator', () => {
  it('has an answer recorded for every policy of the corpus, and a corpus that tries each sentence of the validator', () => {
    expect(facts.policies.map((recorded) => recorded.id)).toEqual(cases.policies.map((c) => c.id))
    const accepted = facts.policies
      .filter((recorded) => recorded.thrown === null)
      .map((recorded) => recorded.id)
    expect(accepted).toEqual(['complete', 'mass-global', 'mass-owned'])
    const thrown = facts.policies.flatMap((recorded) => (recorded.thrown === null ? [] : [recorded.thrown]))
    for (const sentence of [
      /^unassigned sector /,
      /: unknown or duplicate sector /,
      /: empty room$/,
      /^unassigned zone /,
      /^unknown zone /,
      /: invalid room owners$/,
      /^unassigned mass /,
      /^unknown mass /,
    ])
      expect(
        thrown.some((message) => sentence.test(message)),
        String(sentence),
      ).toBe(true)
  })

  // The game's own test policy for an unassigned sector drops the `supply` room, so the closet zone's owner dangles too, a
  // fault the game never reaches because it throws at the first.
  const BEHIND_THE_FIRST: Record<string, string[]> = { 'unassigned-sector': ['closet: invalid room owners'] }
  for (const recorded of facts.policies) {
    const given = cases.policies.find((c) => c.id === recorded.id)
    if (given === undefined || recorded.id === 'several-faults') continue
    it(`says what the game threw for ${recorded.id}${recorded.thrown === null ? ' (nothing)' : ''}, and only what is behind it`, () => {
      const found = roomPolicyProblems(given.policy as RoomPolicy, given.sectors, given.zones, given.masses)
      const behind = BEHIND_THE_FIRST[recorded.id] ?? []
      expect(messages(found)).toEqual(recorded.thrown === null ? [] : [recorded.thrown, ...behind])
    })
  }

  it('says every fault of a policy that has several, the game’s first thrown sentence first, in the validator’s order', () => {
    const given = cases.policies.find((c) => c.id === 'several-faults')
    const recorded = facts.policies.find((c) => c.id === 'several-faults')
    const found = messages(
      roomPolicyProblems(
        given?.policy as RoomPolicy,
        given?.sectors ?? [],
        given?.zones ?? [],
        given?.masses ?? 0,
      ),
    )
    expect(found[0]).toBe(recorded?.thrown)
    expect(found).toEqual([
      'reception: unknown or duplicate sector porch',
      'attic: empty room',
      'unassigned sector closet',
      'hall: invalid room owners',
      'unassigned zone closet',
      'unknown zone porch',
      'unassigned mass 0',
      'unknown mass 5',
    ])
  })
})

describe('roomPolicyProblems: the faults', () => {
  it('passes a policy that groups every sector once and owns every zone and mass', () => {
    expect(roomPolicyProblems(policy(), SECTORS, ZONES, 0)).toEqual([])
    expect(
      roomPolicyProblems(policy({ masses: { 0: 'global', 1: ['reception', 'supply'] } }), SECTORS, ZONES, 2),
    ).toEqual([])
  })

  it('passes a level with no sectors, no zones and no masses against an empty policy', () => {
    expect(roomPolicyProblems({ rooms: {}, zones: {}, masses: {} }, [], [], 0)).toEqual([])
  })

  it('says a sector a second room lists once, at the second listing, and a repeat inside one room the same way', () => {
    const twice = policy({ rooms: { reception: ['hall', 'counter'], supply: ['closet', 'hall'] } })
    expect(messages(roomPolicyProblems(twice, SECTORS, ZONES, 0))).toEqual([
      'supply: unknown or duplicate sector hall',
    ])
    const repeated = policy({ rooms: { reception: ['hall', 'counter', 'hall'], supply: ['closet'] } })
    expect(messages(roomPolicyProblems(repeated, SECTORS, ZONES, 0))).toEqual([
      'reception: unknown or duplicate sector hall',
    ])
  })

  it('does not count a sector it refused as grouped: the sector the policy lists wrongly is still unassigned', () => {
    const wrong = policy({ rooms: { reception: ['hall', 'porch'], supply: ['closet'] } })
    expect(messages(roomPolicyProblems(wrong, SECTORS, ZONES, 0))).toEqual([
      'reception: unknown or duplicate sector porch',
      'unassigned sector counter',
    ])
  })

  it('says each unassigned sector once, in the level’s order, even when the level lists a sector twice', () => {
    const none = policy({ rooms: { supply: ['closet'] }, zones: { hall: ['supply'], closet: ['supply'] } })
    expect(messages(roomPolicyProblems(none, ['hall', 'counter', 'closet', 'hall'], ZONES, 0))).toEqual([
      'unassigned sector hall',
      'unassigned sector counter',
    ])
  })

  it('reads a room, a zone or a mass only by its own name: an inherited member name is not one', () => {
    const inherited = policy({ zones: { hall: ['constructor'], closet: ['supply'] } })
    expect(messages(roomPolicyProblems(inherited, SECTORS, ZONES, 0))).toEqual(['hall: invalid room owners'])
    expect(messages(roomPolicyProblems(policy(), SECTORS, ['hall', 'closet', 'toString'], 0))).toEqual([
      'unassigned zone toString',
    ])
    expect(messages(roomPolicyProblems(policy(), SECTORS, ZONES, 1))).toEqual(['unassigned mass 0'])
  })

  it('holds a zone’s owners to the same rule as a mass’s: not empty, every one a room, or “global”', () => {
    const owned = (zones: RoomPolicy['zones']) => roomPolicyProblems(policy({ zones }), SECTORS, ZONES, 0)
    expect(owned({ hall: ['reception', 'supply'], closet: ['supply'] })).toEqual([])
    expect(owned({ hall: 'global' as never, closet: ['supply'] })).toEqual([])
    expect(messages(owned({ hall: [], closet: ['supply'] }))).toEqual(['hall: invalid room owners'])
    expect(messages(owned({ hall: ['reception', 'attic'], closet: ['supply'] }))).toEqual([
      'hall: invalid room owners',
    ])
    expect(
      messages(roomPolicyProblems(policy({ masses: { 0: ['supply', 'attic'] } }), SECTORS, ZONES, 1)),
    ).toEqual(['mass 0: invalid room owners'])
  })

  it('names a mass key that is no whole number from nothing to the count as unknown, as the game does', () => {
    const keyed = (key: string, count: number) => {
      const masses: Record<string, RoomPolicy['masses'][number]> = { [key]: 'global' }
      for (let mass = 0; mass < count; mass++) masses[mass] = 'global'
      return messages(roomPolicyProblems(policy({ masses }), SECTORS, ZONES, count))
    }
    expect(keyed('2', 2)).toEqual(['unknown mass 2'])
    expect(keyed('-1', 2)).toEqual(['unknown mass -1'])
    expect(keyed('1.5', 2)).toEqual(['unknown mass 1.5'])
    expect(keyed('one', 2)).toEqual(['unknown mass one'])
    expect(keyed('1', 2)).toEqual([])
  })

  it('says the faults of the zones before the masses, and the masses’ unassigned before their unknown', () => {
    const found = roomPolicyProblems(
      policy({
        zones: { hall: ['reception'], closet: ['supply'], porch: ['supply'] },
        masses: { 9: 'global' },
      }),
      SECTORS,
      ZONES,
      1,
    )
    expect(messages(found)).toEqual(['unknown zone porch', 'unassigned mass 0', 'unknown mass 9'])
  })

  it('says the zones and masses the level lacks in the policy’s order: zones as written, masses by number', () => {
    const found = roomPolicyProblems(
      policy({
        zones: { hall: ['reception'], closet: ['supply'], porch: ['supply'], attic: ['supply'] },
        masses: { 7: 'global', 0: 'global', 4: 'global' },
      }),
      SECTORS,
      ZONES,
      1,
    )
    expect(messages(found)).toEqual([
      'unknown zone porch',
      'unknown zone attic',
      'unknown mass 4',
      'unknown mass 7',
    ])
  })

  it('says the zone’s own fault before the next zone’s, zone by zone in the level’s order', () => {
    const found = roomPolicyProblems(
      policy({ zones: { closet: ['nowhere'] } }),
      SECTORS,
      ['hall', 'closet'],
      0,
    )
    expect(messages(found)).toEqual(['unassigned zone hall', 'closet: invalid room owners'])
  })
})

describe('roomPolicyProblems: where each problem is', () => {
  it('puts an unassigned sector at the sector, and a sector listed twice at the sector the second listing names', () => {
    const missing = roomPolicyProblems(
      policy({
        rooms: { reception: ['hall', 'counter'] },
        zones: { hall: ['reception'], closet: ['reception'] },
      }),
      SECTORS,
      ZONES,
      0,
    )
    expect(missing.map((problem) => problem.locator)).toEqual([{ selection: 'sector:closet', at: undefined }])
    const twice = roomPolicyProblems(
      policy({ rooms: { reception: ['hall', 'counter'], supply: ['closet', 'hall'] } }),
      SECTORS,
      ZONES,
      0,
    )
    expect(twice.map((problem) => problem.locator)).toEqual([{ selection: 'sector:hall', at: undefined }])
  })

  it('has no place for a sector the level does not have, an empty room or a mass', () => {
    const found = roomPolicyProblems(
      policy({
        rooms: { reception: ['hall', 'counter', 'porch'], supply: ['closet'], attic: [] },
        masses: { 0: [], 4: 'global' },
      }),
      SECTORS,
      ZONES,
      1,
    )
    expect(messages(found)).toEqual([
      'reception: unknown or duplicate sector porch',
      'attic: empty room',
      'mass 0: invalid room owners',
      'unknown mass 4',
    ])
    expect(found.map((problem) => problem.locator)).toEqual([undefined, undefined, undefined, undefined])
  })

  it('puts a level zone’s problem at the zone, and has no place for a zone the level does not have', () => {
    const found = roomPolicyProblems(
      policy({ zones: { hall: ['nowhere'], porch: ['supply'] } }),
      SECTORS,
      ZONES,
      0,
    )
    expect(messages(found)).toEqual([
      'hall: invalid room owners',
      'unassigned zone closet',
      'unknown zone porch',
    ])
    expect(found.map((problem) => problem.locator)).toEqual([
      { selection: 'entity:zone/hall', at: undefined },
      { selection: 'entity:zone/closet', at: undefined },
      undefined,
    ])
  })

  it('reports a name that cannot be part of a selection id without a place instead of failing', () => {
    const found = roomPolicyProblems(
      { rooms: { all: ['a/b'] }, zones: {}, masses: {} },
      ['a/b', 'c:d'],
      ['x/y'],
      0,
    )
    expect(messages(found)).toEqual(['unassigned sector c:d', 'unassigned zone x/y'])
    expect(found.map((problem) => problem.locator)).toEqual([undefined, undefined])
  })
})
