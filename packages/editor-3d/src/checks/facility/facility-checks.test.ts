// The facility checks (ED3D.9b), run on the shipped facility and on the shipped facility with one thing broken. Each
// seeded case names every problem it must cause, in every result, so a rule that fires too much fails here as well.
import { describe, expect, it } from 'vitest'
import type {
  Facility,
  FacilityJoin,
  FacilityLock,
  FacilityPhase,
  FacilityWing,
  JoinSide,
} from '../../format/facility.schema'
import { shippedFacility } from '../../testing/shipped-facility'
import type { CheckResult } from '../check'
import { facilityChecks } from './facility-checks'

const NAMES = ['ids', 'wings', 'phases', 'joins', 'locks', 'street', 'notes'] as const
type Name = (typeof NAMES)[number]

/** A problem as the tests compare it: the sentence and the selection id it is at (nothing when it has no place). */
type Found = readonly [message: string, selection: string | undefined]

const found = (result: CheckResult): Found[] =>
  result.problems.map((problem) => [problem.message, problem.locator?.selection])

/** Every result's problems must be exactly the ones listed for it, and none for the results not listed. */
function expectProblems(facility: Facility, expected: Partial<Record<Name, readonly Found[]>>): void {
  const results = facilityChecks(facility)
  NAMES.forEach((name, index) => {
    const result = results[index] as CheckResult
    expect(found(result), name).toEqual(expected[name] ?? [])
    expect(result.ok, `${name} ok`).toBe((expected[name] ?? []).length === 0)
  })
}

const withWing = (id: string, change: Partial<FacilityWing>): Facility => ({
  ...shippedFacility,
  wings: shippedFacility.wings.map((wing) => (wing.id === id ? { ...wing, ...change } : wing)),
})

const withPhase = (id: string, change: Partial<FacilityPhase>): Facility => ({
  ...shippedFacility,
  phases: shippedFacility.phases.map((phase) => (phase.id === id ? { ...phase, ...change } : phase)),
})

const phase = (id: string) => shippedFacility.phases.find((each) => each.id === id) as FacilityPhase
const wing = (id: string) => shippedFacility.wings.find((each) => each.id === id) as FacilityWing

describe('facilityChecks: the whole', () => {
  it('answers the seven results in order, with their ids and severities', () => {
    const results = facilityChecks(shippedFacility)
    expect(results.map((result) => result.id)).toEqual([
      'facility-ids',
      'facility-wings',
      'facility-phases',
      'facility-joins',
      'facility-locks',
      'facility-street',
      'facility-notes',
    ])
    expect(results.map((result) => result.severity)).toEqual([
      'error',
      'error',
      'error',
      'error',
      'error',
      'error',
      'warning',
    ])
  })

  it('finds nothing wrong with the shipped facility', () => {
    expectProblems(shippedFacility, {})
    for (const result of facilityChecks(shippedFacility)) expect(result.detail, result.id).toBe('ok')
  })
})

describe('facility-ids', () => {
  it('reports an id used twice in each of the four lists, at the member', () => {
    const exit = shippedFacility.joins[0] as Facility['joins'][number]
    const cabinet = shippedFacility.locks[0] as Facility['locks'][number]
    expectProblems(
      { ...shippedFacility, wings: [...shippedFacility.wings, { ...wing('bay') }] },
      { ids: [['wing bay is listed 2 times', 'wing:bay']] },
    )
    expectProblems(
      { ...shippedFacility, joins: [...shippedFacility.joins, { ...exit }] },
      { ids: [['join exit is listed 2 times', 'join:exit']] },
    )
    expectProblems(
      { ...shippedFacility, phases: [...shippedFacility.phases, { ...phase('P1'), scene: 'other' }] },
      { ids: [['phase P1 is listed 2 times', 'phase:P1']] },
    )
    expectProblems(
      { ...shippedFacility, locks: [...shippedFacility.locks, { ...cabinet }, { ...cabinet }] },
      { ids: [['lock p0.cabinet is listed 3 times', 'lock:p0.cabinet']] },
    )
  })

  it('reports two phases that run one scene, naming both', () => {
    expectProblems(withPhase('P0', { scene: 'clinic' }), {
      ids: [['scene clinic is run by 2 phases: P0, P1', undefined]],
    })
  })

  it('reports an id that cannot be selected without a place', () => {
    const exit = shippedFacility.joins[0] as Facility['joins'][number]
    expectProblems(
      {
        ...shippedFacility,
        joins: [...shippedFacility.joins, { ...exit, id: 'a:b' }, { ...exit, id: 'a:b' }],
      },
      { ids: [['join a:b is listed 2 times', undefined]] },
    )
  })
})

describe('facility-wings', () => {
  it('reports a phase the wing runs that the facility does not have', () => {
    expectProblems(withWing('clinic', { phases: ['P0', 'P1', 'P3', 'P9'] }), {
      wings: [['wing clinic runs phase P9, which the facility does not have', 'wing:clinic']],
    })
  })

  it("reports a reference phase that is not one of the wing's phases", () => {
    expectProblems(withWing('clinic', { reference: 'P2' }), {
      wings: [["wing clinic's reference phase P2 is not one of its phases", 'wing:clinic']],
    })
  })

  it('reports a phase the wing lists that runs in another wing', () => {
    expectProblems(withWing('clinic', { phases: ['P0', 'P1', 'P2', 'P3'] }), {
      wings: [['wing clinic lists phase P2, which runs in wing bay', 'wing:clinic']],
    })
  })
})

describe('facility-phases', () => {
  it('reports a phase that runs in a wing the facility does not have, and the wing that lists it', () => {
    expectProblems(withPhase('P2', { wing: 'barn' }), {
      wings: [['wing bay lists phase P2, which runs in wing barn', 'wing:bay']],
      phases: [['phase P2 runs in wing barn, which the facility does not have', 'phase:P2']],
    })
  })

  it('reports a phase its own wing does not list, and the wing that lists it instead', () => {
    expectProblems(withPhase('P3', { wing: 'bay' }), {
      wings: [['wing clinic lists phase P3, which runs in wing bay', 'wing:clinic']],
      phases: [['phase P3 is not listed by its wing bay', 'phase:P3']],
    })
  })

  it('reports a seen room that is not one of the rooms', () => {
    expectProblems(withPhase('P3', { seen: ['yard', 'attic'] }), {
      phases: [['phase P3 sees the room attic, which is not one of its rooms', 'phase:P3']],
    })
  })

  it('reports an exit to a scene no phase runs, and takes a phase with no exit', () => {
    expectProblems(
      withPhase('P2', {
        exit: { ...(phase('P2').exit as NonNullable<FacilityPhase['exit']>), to: 'nowhere' },
      }),
      {
        phases: [['phase P2 leaves for the scene nowhere, which no phase runs', 'phase:P2']],
      },
    )
    expect(phase('P3').exit).toBeNull()
  })

  it('reports a doors entry for a lock the facility does not have', () => {
    expectProblems(withPhase('P0', { doors: { ...phase('P0').doors, p9: 'shut' } }), {
      phases: [['phase P0 names the lock p9 in its doors, which the facility does not have', 'phase:P0']],
    })
  })

  it('reports a doors entry for a lock that is not a lock of that phase', () => {
    expectProblems(withPhase('P0', { doors: { ...phase('P0').doors, 'p1.exit': 'shut' } }), {
      phases: [['phase P0 names the lock p1.exit in its doors, which is not a lock of P0', 'phase:P0']],
    })
  })
})

const withJoin = (id: string, change: Partial<FacilityJoin>): Facility => ({
  ...shippedFacility,
  joins: shippedFacility.joins.map((join) => (join.id === id ? { ...join, ...change } : join)),
})

const withLock = (id: string, change: Partial<FacilityLock>): Facility => ({
  ...shippedFacility,
  locks: shippedFacility.locks.map((lock) => (lock.id === id ? { ...lock, ...change } : lock)),
})

const join = (id: string) => shippedFacility.joins.find((each) => each.id === id) as FacilityJoin

describe('facility-joins', () => {
  it('reports a side that names no phase, or a room the phase does not list, at the join and the side', () => {
    expectProblems(withJoin('exit', { a: { phase: 'P9', room: 'corridor', opening: 'exitWay' } }), {
      joins: [['join exit: side a: no phase P9', 'join:exit']],
    })
    expectProblems(withJoin('clinicDoor', { b: { phase: 'P2', room: 'attic', door: 'arrival' } }), {
      joins: [['join clinicDoor: side b: phase P2 has no room attic', 'join:clinicDoor']],
    })
  })

  it('reports both sides when both are wrong, a first and then b', () => {
    expectProblems(
      withJoin('shutter', {
        a: { phase: 'P2', room: 'recess', wall: -1 },
        b: { phase: 'P2', room: 'recess', door: '' },
      }),
      {
        joins: [
          ['join shutter: side a: wall -1 is not a whole number from 0', 'join:shutter'],
          ['join shutter: side b: a door needs a name', 'join:shutter'],
        ],
      },
    )
  })

  it('reports two sides that are the same place', () => {
    const side = join('exit').a
    expectProblems(withJoin('exit', { b: { ...side } }), {
      joins: [['join exit: a join needs two different sides', 'join:exit']],
    })
  })

  it('reports the same two sides even when they are also wrong', () => {
    const side = { phase: 'P9', room: 'hall', door: 'x' }
    expectProblems(withJoin('exit', { a: side, b: { ...side } }), {
      joins: [
        ['join exit: side a: no phase P9', 'join:exit'],
        ['join exit: side b: no phase P9', 'join:exit'],
        ['join exit: a join needs two different sides', 'join:exit'],
      ],
    })
  })

  it('reports a join whose id cannot be selected without a place', () => {
    const sides: { a: JoinSide; b: JoinSide } = { a: { street: 'start' }, b: { street: 'start' } }
    expectProblems(
      { ...shippedFacility, joins: [...shippedFacility.joins.slice(0, 3), { id: 'a:b', ...sides }] },
      {
        joins: [['join a:b: a join needs two different sides', undefined]],
        notes: [],
      },
    )
  })
})

describe('facility-locks', () => {
  it('reports a lock on no phase, and a lock on a phase the facility does not have', () => {
    expectProblems(withLock('p0.cabinet', { phases: [] }), {
      locks: [['lock p0.cabinet: a lock needs at least one phase', 'lock:p0.cabinet']],
    })
    expectProblems(withLock('p0.cabinet', { phases: ['P0', 'P9'] }), {
      locks: [['lock p0.cabinet: no phase P9', 'lock:p0.cabinet']],
    })
  })

  it('reports a lock with no place', () => {
    expectProblems(withLock('p0.cabinet', { at: '' }), {
      locks: [
        ['lock p0.cabinet: a lock needs a place: the hotspot, box or wall door it is on', 'lock:p0.cabinet'],
      ],
    })
  })
})

describe('facility-street', () => {
  it('reports a path of fewer than two points, with no place', () => {
    expectProblems(
      { ...shippedFacility, street: { ...shippedFacility.street, path: [[0, 0]] } },
      {
        street: [['the street path needs at least two points', undefined]],
      },
    )
    expectProblems(
      { ...shippedFacility, street: { ...shippedFacility.street, path: [] } },
      {
        street: [['the street path needs at least two points', undefined]],
      },
    )
  })

  it('takes a path of two points, the least that is a path', () => {
    expectProblems(
      {
        ...shippedFacility,
        street: {
          ...shippedFacility.street,
          path: [
            [0, 0],
            [1, 1],
          ],
        },
      },
      {},
    )
  })

  it('reports a clearance that is not more than 0, whatever it is instead', () => {
    for (const clear of [0, -1, Number.NaN])
      expectProblems(
        { ...shippedFacility, street: { ...shippedFacility.street, clear } },
        {
          street: [["the street's clearance must be more than 0", undefined]],
        },
      )
  })
})

describe('facility-notes', () => {
  it("is a warning for a wing's differences for a phase it does not run", () => {
    const differences = { P1: [{ path: 'sectors', why: 'moved' }] }
    expectProblems(withWing('bay', { differences }), {
      notes: [['wing bay has differences for phase P1, which it does not run', 'wing:bay']],
    })
    expect(facilityChecks(withWing('bay', { differences }))[6].severity).toBe('warning')
  })

  it('is a warning for a room a phase lists twice', () => {
    expectProblems(withPhase('P0', { rooms: [...phase('P0').rooms, 'hall'] }), {
      notes: [['phase P0 lists the room hall 2 times', 'phase:P0']],
    })
  })

  it('is a warning for a lock that opens a door its phase does not list', () => {
    const doors = Object.fromEntries(Object.entries(phase('P0').doors).filter(([id]) => id !== 'p0.supply'))
    expectProblems(withPhase('P0', { doors }), {
      notes: [
        [
          'lock p0.supply opens the door closetDoor, but the doors of phase P0 do not list it',
          'lock:p0.supply',
        ],
      ],
    })
  })

  it('does not take a lock named like an object member for a door the phase lists', () => {
    const odd: FacilityLock = {
      ...(withLock('p0.supply', {}).locks.find((lock) => lock.id === 'p0.supply') as FacilityLock),
      id: 'constructor',
    }
    const facility = { ...shippedFacility, locks: [...shippedFacility.locks, odd] }
    expectProblems(facility, {
      notes: [
        [
          'lock constructor opens the door closetDoor, but the doors of phase P0 do not list it',
          'lock:constructor',
        ],
      ],
    })
  })

  it('says nothing of a door lock on a phase the facility does not have; the locks result does', () => {
    expectProblems(withLock('p0.supply', { phases: ['P9'] }), {
      phases: [['phase P0 names the lock p0.supply in its doors, which is not a lock of P0', 'phase:P0']],
      locks: [['lock p0.supply: no phase P9', 'lock:p0.supply']],
    })
  })

  it('counts the street end on either side of a join', () => {
    const second: FacilityJoin = {
      id: 'second',
      a: { street: 'end' },
      b: { phase: 'P3', room: 'hall', wall: 0 },
    }
    expectProblems(
      { ...shippedFacility, joins: [...shippedFacility.joins, second] },
      { notes: [['the street end is the side of 2 joins: streetGate, second', 'join:streetGate']] },
    )
  })

  it('is a warning for a street end that is the side of two joins, naming the others', () => {
    const second: FacilityJoin = {
      id: 'second',
      a: { phase: 'P3', room: 'hall', wall: 0 },
      b: { street: 'start' },
    }
    const facility = { ...shippedFacility, joins: [...shippedFacility.joins, second] }
    expectProblems(facility, {
      notes: [['the street start is the side of 2 joins: shutter, second', 'join:shutter']],
    })
    expect(facilityChecks(facility)[6].problems[0]?.related?.map((place) => place.selection)).toEqual([
      'join:second',
    ])
  })
})
