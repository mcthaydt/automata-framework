// The World edits and the facility checks agree (ED3D.9b, ED3-i second half): what the edits accept leaves a facility the
// checks have nothing to say about, and what the edits refuse is what the checks report when the file has it anyway.
import { describe, expect, it } from 'vitest'
import { facilityChecks } from '../checks/facility/facility-checks'
import type { Facility, FacilityJoin, FacilityLock } from '../format/facility.schema'
import { levelOf, reasonOf } from '../testing/edit-helpers'
import { shippedFacility } from '../testing/shipped-facility'
import { moveWing, removeJoin, setJoin, setLock } from './facility-edits'

const problemsOf = (facility: Facility): string[] =>
  facilityChecks(facility).flatMap((result) => result.problems.map((problem) => problem.message))

const clinicDoor = shippedFacility.joins.find((join) => join.id === 'clinicDoor') as FacilityJoin
const cabinet = shippedFacility.locks.find((lock) => lock.id === 'p0.cabinet') as FacilityLock
const hallDoor: FacilityLock = { ...cabinet, id: 'p3.hall', phases: ['P3'], at: 'hallDoor' }
const garden: FacilityJoin = {
  id: 'garden',
  a: { phase: 'P3', room: 'corridor', door: 'backDoor' },
  b: { phase: 'P3', room: 'yard', door: 'backDoor' },
}

describe('what the edits accept, the checks accept', () => {
  it('leaves nothing to report after each edit of the 9a tests', () => {
    const results: readonly Facility[] = [
      levelOf(moveWing({ wing: 'bay', offset: [10.875, -1, -6.6] }).run(shippedFacility)),
      levelOf(setJoin(garden).run(shippedFacility)),
      levelOf(setJoin({ ...clinicDoor, why: 'changed' }).run(shippedFacility)),
      levelOf(removeJoin('exit').run(shippedFacility)),
      levelOf(removeJoin('shutter').run(shippedFacility)),
      levelOf(setLock(hallDoor).run(shippedFacility)),
      levelOf(setLock({ ...cabinet, kind: 'key', hints: ['cabinet'] }).run(shippedFacility)),
      levelOf(setLock({ ...cabinet, at: ['cabinet', 'shelf'] }).run(shippedFacility)),
    ]
    expect(results).toHaveLength(8)
    for (const facility of results) expect(problemsOf(facility)).toEqual([])
  })
})

describe('what the edits refuse, the checks report', () => {
  it('names every refused join in the checks with the edit’s own sentence', () => {
    const hall = { phase: 'P3', room: 'hall' }
    const refused: readonly FacilityJoin[] = [
      { ...garden, id: 'g1', a: { phase: 'P9', room: 'hall', door: 'x' } },
      { ...garden, id: 'g2', b: { phase: 'P3', room: 'attic', door: 'x' } },
      { ...garden, id: 'g3', a: { ...hall, wall: 1.5 } },
      { ...garden, id: 'g4', b: { ...hall, door: '' } },
      { ...garden, id: 'g5', a: { ...hall, opening: ' ' } },
      { ...garden, id: 'g6', b: { ...garden.a } },
    ]
    for (const join of refused) {
      const reason = reasonOf(setJoin(join).run(shippedFacility))
      const forced: Facility = { ...shippedFacility, joins: [...shippedFacility.joins, join] }
      expect(problemsOf(forced), join.id).toEqual([`join ${join.id}: ${reason}`])
    }
  })

  it('names every refused lock in the checks with the edit’s own sentence', () => {
    const refused: readonly FacilityLock[] = [
      { ...hallDoor, id: 'k1', phases: [] },
      { ...hallDoor, id: 'k2', phases: ['P3', 'P9'] },
      { ...hallDoor, id: 'k3', at: '' },
      { ...hallDoor, id: 'k4', at: ['hallDoor', ' '] },
    ]
    for (const lock of refused) {
      const reason = reasonOf(setLock(lock).run(shippedFacility))
      const forced: Facility = { ...shippedFacility, locks: [...shippedFacility.locks, lock] }
      expect(problemsOf(forced), lock.id).toEqual([`lock ${lock.id}: ${reason}`])
    }
  })
})
