// The rules a join and a lock must meet that the facility file alone can judge (ED3D.9b), run on the shipped facility:
// the same functions the World edits refuse with and the facility checks report with.
import { describe, expect, it } from 'vitest'
import type { FacilityLock, JoinSide } from '../../format/facility.schema'
import { shippedFacility } from '../../testing/shipped-facility'
import { joinSideProblem, lockProblem, sameJoinSide } from './facility-rules'

const hall = { phase: 'P3', room: 'hall' }
const problem = (side: JoinSide) => joinSideProblem(shippedFacility, side)

describe('joinSideProblem', () => {
  it('takes a street side, and a wall, a door and an opening of a room the phase lists', () => {
    for (const side of [
      { street: 'start' },
      { street: 'end' },
      { ...hall, wall: 0 },
      { ...hall, wall: 3 },
      { ...hall, door: 'backDoor' },
      { ...hall, opening: 'exitWay' },
    ] as const)
      expect(problem(side), JSON.stringify(side)).toBeUndefined()
  })

  it('takes the P3 yard, which is a room and a seen room', () => {
    expect(problem({ phase: 'P3', room: 'yard', door: 'streetGate' })).toBeUndefined()
  })

  it('names a phase the facility does not have', () => {
    expect(problem({ phase: 'P9', room: 'hall', door: 'x' })).toBe('no phase P9')
  })

  it('names a room the phase does not list, and a room of another phase', () => {
    expect(problem({ phase: 'P3', room: 'attic', door: 'x' })).toBe('phase P3 has no room attic')
    expect(problem({ phase: 'P2', room: 'hall', door: 'x' })).toBe('phase P2 has no room hall')
  })

  it('refuses a wall that is not a whole number from 0', () => {
    for (const wall of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(problem({ ...hall, wall }), String(wall)).toBe(`wall ${wall} is not a whole number from 0`)
  })

  it('refuses a door or an opening with no name, spaces only included', () => {
    expect(problem({ ...hall, door: '' })).toBe('a door needs a name')
    expect(problem({ ...hall, door: '  ' })).toBe('a door needs a name')
    expect(problem({ ...hall, opening: '' })).toBe('an opening needs a name')
    expect(problem({ ...hall, opening: ' ' })).toBe('an opening needs a name')
  })
})

describe('sameJoinSide', () => {
  it('is true for the same street end and for the same place in a room', () => {
    expect(sameJoinSide({ street: 'start' }, { street: 'start' })).toBe(true)
    expect(sameJoinSide({ ...hall, wall: 1 }, { ...hall, wall: 1 })).toBe(true)
    expect(sameJoinSide({ ...hall, door: 'x' }, { ...hall, door: 'x' })).toBe(true)
    expect(sameJoinSide({ ...hall, opening: 'x' }, { ...hall, opening: 'x' })).toBe(true)
  })

  it('is false when the street end, the phase, the room, the wall or the name differs', () => {
    const pairs: readonly (readonly [JoinSide, JoinSide])[] = [
      [{ street: 'start' }, { street: 'end' }],
      [{ street: 'start' }, { ...hall, wall: 0 }],
      [
        { ...hall, wall: 0 },
        { ...hall, wall: 1 },
      ],
      [
        { ...hall, door: 'x' },
        { ...hall, door: 'y' },
      ],
      [
        { ...hall, opening: 'x' },
        { ...hall, opening: 'y' },
      ],
      [
        { ...hall, door: 'x' },
        { ...hall, opening: 'x' },
      ],
      ...(['wall', 'door', 'opening'] as const).flatMap(
        (kind): readonly (readonly [JoinSide, JoinSide])[] => {
          const at = (phase: string, room: string): JoinSide =>
            kind === 'wall' ? { phase, room, wall: 1 } : ({ phase, room, [kind]: 'x' } as JoinSide)
          return [
            [at('P3', 'hall'), at('P3', 'ward')],
            [at('P3', 'hall'), at('P1', 'hall')],
          ]
        },
      ),
    ]
    for (const [a, b] of pairs) expect(sameJoinSide(a, b), JSON.stringify([a, b])).toBe(false)
  })
})

const cabinet = shippedFacility.locks.find((lock) => lock.id === 'p0.cabinet') as FacilityLock
const lock = (change: Partial<FacilityLock>): string | undefined =>
  lockProblem(shippedFacility, { ...cabinet, ...change })

describe('lockProblem', () => {
  it('takes every lock of the shipped facility', () => {
    for (const each of shippedFacility.locks)
      expect(lockProblem(shippedFacility, each), each.id).toBeUndefined()
  })

  it('needs a phase, and names the first the facility does not have', () => {
    expect(lock({ phases: [] })).toBe('a lock needs at least one phase')
    expect(lock({ phases: ['P0', 'P9', 'P8'] })).toBe('no phase P9')
  })

  it('needs a place: a blank string, an empty list or a list with a blank entry names nothing', () => {
    for (const at of ['', '  ', [], ['cabinet', ''], [' ']])
      expect(lock({ at }), JSON.stringify(at)).toBe(
        'a lock needs a place: the hotspot, box or wall door it is on',
      )
    expect(lock({ at: ['cabinet', 'shelf'] })).toBeUndefined()
  })
})
