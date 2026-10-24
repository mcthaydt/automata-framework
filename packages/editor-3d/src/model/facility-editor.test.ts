// The facility editor (ED3D.9a step 1): the kit's History and Selection over the facility file, and the protocol every
// World edit goes through. The edits here are small fakes over the shipped facility, so the protocol is tested apart
// from the rules of the real edits (steps 2 to 4).
import { describe, expect, it, vi } from 'vitest'
import type { Facility } from '../format/facility.schema'
import { facilityCodec } from '../profile/last-light-codecs'
import { loadFixture } from '../testing/fixtures'
import { ok, refuse } from './edit'
import { createFacilityEditor, type FacilityEdit } from './facility-editor'

const shipped: Facility = (() => {
  const result = facilityCodec.parse(loadFixture('facility'))
  if (!result.ok) throw new Error('the shipped facility does not parse')
  return result.value
})()

/** An edit that renames the pursuer of the bay wing. */
const setNpc = (npc: string, more: { coalesce?: string; select?: readonly string[] } = {}): FacilityEdit => ({
  id: 'test.npc',
  label: `Give the bay ${npc}`,
  ...(more.coalesce === undefined ? {} : { coalesce: more.coalesce }),
  run: (facility) =>
    ok(
      { ...facility, wings: facility.wings.map((wing) => (wing.id === 'bay' ? { ...wing, npc } : wing)) },
      more.select,
    ),
})

/** An edit that takes away a join, a lock, a wing and a phase by id. */
const without = (what: { join?: string; lock?: string; wing?: string; phase?: string }): FacilityEdit => ({
  id: 'test.without',
  label: 'Take things away',
  run: (facility) =>
    ok({
      ...facility,
      joins: facility.joins.filter((join) => join.id !== what.join),
      locks: facility.locks.filter((lock) => lock.id !== what.lock),
      wings: facility.wings.filter((wing) => wing.id !== what.wing),
      phases: facility.phases.filter((phase) => phase.id !== what.phase),
    }),
})

const bayNpc = (facility: Facility) => facility.wings.find((wing) => wing.id === 'bay')?.npc

function editor(now?: () => number) {
  return createFacilityEditor({ facility: shipped, ...(now === undefined ? {} : { now }) })
}

describe('a run', () => {
  it("applies an edit as one undo step with the edit's label, and answers its result", () => {
    const e = editor()
    expect(e.facility).toBe(shipped)
    const result = e.run(setNpc('clerk'))
    expect(result).toMatchObject({ ok: true })
    expect(bayNpc(e.facility)).toBe('clerk')
    expect(e.history.revision).toBe(1)
    expect(e.history.undoLabel).toBe('Give the bay clerk')
    e.history.undo()
    expect(e.facility).toBe(shipped)
  })

  it('records nothing and tells nobody when the edit refuses, and hands the refusal back', () => {
    const e = editor()
    const heard = vi.fn()
    e.history.subscribe(heard)
    const refusal = e.run({ id: 'test.no', label: 'No', run: () => refuse('not today', 'wing:bay') })
    expect(refusal).toEqual({ ok: false, reason: 'not today', at: 'wing:bay' })
    expect(e.facility).toBe(shipped)
    expect(e.history.canUndo).toBe(false)
    expect(heard).not.toHaveBeenCalled()
  })

  it('records nothing for an edit that leaves the facility as it was', () => {
    const e = editor()
    const result = e.run({ id: 'test.same', label: 'Same', run: (facility) => ok(facility) })
    expect(result).toMatchObject({ ok: true })
    expect(e.history.canUndo).toBe(false)
    expect(e.history.revision).toBe(0)
  })

  it('replaces the selection with what the edit says to select, and leaves it alone when it says nothing', () => {
    const e = editor()
    e.selection.set(['wing:clinic'])
    e.run(setNpc('clerk'))
    expect(e.selection.ids).toEqual(['wing:clinic'])
    e.run(setNpc('porter', { select: ['wing:bay', 'join:exit'] }))
    expect(e.selection.ids).toEqual(['wing:bay', 'join:exit'])
    expect(e.selection.primary).toBe('join:exit')
  })

  it('joins two runs with one coalesce key inside the window into one step, and not after it', () => {
    let clock = 0
    const e = editor(() => clock)
    e.run(setNpc('a', { coalesce: 'npc' }))
    clock = 100
    e.run(setNpc('b', { coalesce: 'npc' }))
    expect(e.history.revision).toBe(2)
    e.history.undo()
    expect(e.facility).toBe(shipped)
    expect(e.history.canUndo).toBe(false)
    e.history.redo()
    clock = 5000
    e.run(setNpc('c', { coalesce: 'npc' }))
    e.history.undo()
    expect(bayNpc(e.facility)).toBe('b')
  })

  it('keeps two runs with one coalesce key apart when they are further apart than the window', () => {
    let clock = 0
    const e = editor(() => clock)
    e.run(setNpc('a', { coalesce: 'npc' }))
    clock = 5000
    e.run(setNpc('b', { coalesce: 'npc' }))
    expect(e.history.revision).toBe(2)
    e.history.undo()
    expect(bayNpc(e.facility)).toBe('a')
  })

  it('refuses with the history sentence while a session is open', () => {
    const e = editor()
    e.begin('Drag the bay')
    const refusal = e.run(setNpc('clerk'))
    expect(refusal.ok).toBe(false)
    expect(refusal.ok ? '' : refusal.reason).toContain('Drag the bay')
    expect(e.facility).toBe(shipped)
  })
})

describe('the selection follows the document', () => {
  const everything = [
    'wing:bay',
    'join:exit',
    'lock:p0.cabinet',
    'phase:P2',
    'join:clinicDoor',
    'wing:clinic',
  ]

  it('drops the joins, locks, wings and phases an edit removed, and keeps the rest', () => {
    const e = editor()
    e.selection.set([...everything, 'lock:p0.supply', 'phase:P0'])
    e.run(without({ join: 'exit', lock: 'p0.cabinet', wing: 'bay', phase: 'P2' }))
    expect(e.selection.ids).toEqual(['join:clinicDoor', 'wing:clinic', 'lock:p0.supply', 'phase:P0'])
  })

  it('drops them again on undo of an add and on redo of a removal, since the selection is not a step', () => {
    const e = editor()
    e.run(without({ join: 'exit' }))
    e.history.undo()
    e.selection.set(['join:exit'])
    e.history.redo()
    expect(e.selection.ids).toEqual([])
    e.history.undo()
    expect(e.selection.ids).toEqual([])
  })

  it('leaves alone an id it cannot read and an id of a kind it does not know', () => {
    const e = editor()
    e.selection.set(['nonsense', 'sector:hall', 'join:a/b'])
    e.run(setNpc('clerk'))
    expect(e.selection.ids).toEqual(['nonsense', 'sector:hall', 'join:a/b'])
  })
})

describe('a session (a drag)', () => {
  it('shows each run live and records nothing until it commits, then one step with its label', () => {
    const e = editor()
    const session = e.begin('Drag the bay')
    expect(session.open).toBe(true)
    session.run(setNpc('a'))
    session.run(setNpc('b'))
    expect(bayNpc(e.facility)).toBe('b')
    expect(e.history.revision).toBe(0)
    session.commit()
    expect(session.open).toBe(false)
    expect(e.history.revision).toBe(1)
    expect(e.history.undoLabel).toBe('Drag the bay')
    e.history.undo()
    expect(e.facility).toBe(shipped)
    expect(e.history.canUndo).toBe(false)
  })

  it('puts the facility back at cancel', () => {
    const e = editor()
    const session = e.begin('Drag the bay')
    session.run(setNpc('a'))
    session.cancel()
    expect(e.facility).toBe(shipped)
    expect(session.open).toBe(false)
    expect(e.history.canUndo).toBe(false)
  })

  it('keeps the live facility and stays open when an edit inside it refuses', () => {
    const e = editor()
    const session = e.begin('Drag the bay')
    session.run(setNpc('a'))
    expect(session.run({ id: 'test.no', label: 'No', run: () => refuse('not today') })).toEqual({
      ok: false,
      reason: 'not today',
    })
    expect(bayNpc(e.facility)).toBe('a')
    expect(session.open).toBe(true)
    session.commit()
    expect(e.history.revision).toBe(1)
  })

  it('commits nothing when no run changed the facility', () => {
    const e = editor()
    const session = e.begin('Nothing')
    session.run({ id: 'test.same', label: 'Same', run: (facility) => ok(facility) })
    session.commit()
    expect(e.history.canUndo).toBe(false)
  })

  it('comes back closed, and refuses its runs, when another session is open', () => {
    const e = editor()
    const first = e.begin('Drag the bay')
    const second = e.begin('Another')
    expect(second.open).toBe(false)
    const refused = second.run(setNpc('a'))
    expect(refused.ok ? '' : refused.reason).toContain('Drag the bay')
    second.commit()
    second.cancel()
    expect(first.open).toBe(true)
    first.run(setNpc('b'))
    first.commit()
    expect(bayNpc(e.facility)).toBe('b')
  })

  it('is cancelled by an undo, and a run into the cancelled session is refused', () => {
    const e = editor()
    const session = e.begin('Drag the bay')
    session.run(setNpc('a'))
    e.history.undo()
    expect(session.open).toBe(false)
    expect(e.facility).toBe(shipped)
    const refused = session.run(setNpc('b'))
    expect(refused.ok).toBe(false)
    expect(e.facility).toBe(shipped)
  })

  it('selects what a run inside it says to select, and drops a selected join that a run removed', () => {
    const e = editor()
    const session = e.begin('Edit')
    session.run(setNpc('a', { select: ['join:exit'] }))
    expect(e.selection.ids).toEqual(['join:exit'])
    session.run(without({ join: 'exit' }))
    expect(e.selection.ids).toEqual([])
  })
})
