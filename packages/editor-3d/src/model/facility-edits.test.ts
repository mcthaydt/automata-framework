// The World edits (ED3D.9a steps 2 to 4, spec §5.4): move a wing, set and remove a join, set a lock. Each is run over the
// shipped facility, and each result is also written back with the facility codec, so a change the file cannot take
// shows up here and not at Save.
import { describe, expect, it } from 'vitest'
import type { Facility, FacilityJoin, FacilityLock, JoinSide } from '../format/facility.schema'
import { facilityCodec } from '../profile/last-light-codecs'
import { levelOf, reasonOf } from '../testing/edit-helpers'
import { loadFixture } from '../testing/fixtures'
import { changedRegion, literalEdits } from '../testing/text-diff'
import { createFacilityEditor } from './facility-editor'
import { moveWing, removeJoin, setJoin, setLock } from './facility-edits'

const text = loadFixture('facility')
const shipped: Facility = (() => {
  const result = facilityCodec.parse(text)
  if (!result.ok) throw new Error('the shipped facility does not parse')
  return result.value
})()

const wing = (facility: Facility, id: string) => facility.wings.find((each) => each.id === id)

/** The text the codec writes for a facility changed from the shipped one; the test fails when the codec refuses. */
function written(after: Facility): string {
  const result = facilityCodec.patch(text, shipped, after)
  if (!result.ok) throw new Error(`the codec refused: ${result.reason}: ${result.detail}`)
  return result.text
}

describe('moveWing', () => {
  it('moves the offset of the wing and changes nothing else', () => {
    const after = levelOf(moveWing({ wing: 'bay', offset: [10.875, -1, -6.6] }).run(shipped))
    expect(wing(after, 'bay')?.offset).toEqual([10.875, -1, -6.6])
    expect(wing(after, 'bay')).toEqual({ ...wing(shipped, 'bay'), offset: [10.875, -1, -6.6] })
    expect(wing(after, 'clinic')).toBe(wing(shipped, 'clinic'))
    expect(after.joins).toBe(shipped.joins)
    expect(after.phases).toBe(shipped.phases)
    expect(after.locks).toBe(shipped.locks)
    expect(after.street).toBe(shipped.street)
  })

  it('keeps the members of the wing that it does not know', () => {
    const noted: Facility = {
      ...shipped,
      wings: shipped.wings.map((each) => (each.id === 'bay' ? { ...each, note: 'north' } : each)),
    }
    const after = levelOf(moveWing({ wing: 'bay', offset: [0, 0, 0] }).run(noted))
    expect(wing(after, 'bay')).toMatchObject({ id: 'bay', npc: 'porter', note: 'north', offset: [0, 0, 0] })
  })

  it('rounds the offset to four decimals, as the codec prints it', () => {
    const after = levelOf(moveWing({ wing: 'bay', offset: [10.123456, -1.00004, -6.654321] }).run(shipped))
    expect(wing(after, 'bay')?.offset).toEqual([10.1235, -1, -6.6543])
  })

  it('is one undo step, labelled by the wing, that selects the wing and joins a nudge of the same wing', () => {
    let clock = 0
    const editor = createFacilityEditor({ facility: shipped, now: () => clock })
    expect(moveWing({ wing: 'bay', offset: [1, 0, 0] }).id).toBe('wing.move')
    expect(moveWing({ wing: 'bay', offset: [1, 0, 0] }).coalesce).toBe('wing.move:bay')
    expect(moveWing({ wing: 'clinic', offset: [1, 0, 0] }).coalesce).toBe('wing.move:clinic')
    editor.run(moveWing({ wing: 'bay', offset: [11, -1, -6.6] }))
    expect(editor.history.undoLabel).toBe('Move wing bay')
    expect(editor.selection.ids).toEqual(['wing:bay'])
    clock = 100
    editor.run(moveWing({ wing: 'bay', offset: [11.5, -1, -6.6] }))
    editor.history.undo()
    expect(editor.facility).toBe(shipped)
    expect(editor.history.canUndo).toBe(false)
  })

  it('records nothing when the wing is already there', () => {
    const editor = createFacilityEditor({ facility: shipped })
    expect(editor.run(moveWing({ wing: 'bay', offset: [10.375, -1, -6.6] }))).toMatchObject({ ok: true })
    expect(editor.history.canUndo).toBe(false)
    expect(editor.selection.ids).toEqual(['wing:bay'])
  })

  it('refuses a wing the facility does not have', () => {
    expect(reasonOf(moveWing({ wing: 'barn', offset: [0, 0, 0] }).run(shipped))).toBe('no wing barn')
  })

  it('refuses an offset that is not three finite numbers, naming the wing', () => {
    for (const offset of [
      [Number.NaN, 0, 0],
      [0, Number.POSITIVE_INFINITY, 0],
      [0, 0, Number.NEGATIVE_INFINITY],
    ] as const)
      expect(reasonOf(moveWing({ wing: 'bay', offset }).run(shipped)), String(offset)).toBe(
        'the offset of bay must be three finite numbers',
      )
  })

  it('writes back as one number in facility.json (ED3-i: move the bay wing by 0.5 m)', () => {
    const editor = createFacilityEditor({ facility: shipped })
    const [x, y, z] = wing(shipped, 'bay')?.offset ?? [0, 0, 0]
    editor.run(moveWing({ wing: 'bay', offset: [x + 0.5, y, z] }))
    const saved = written(editor.facility)
    // Every byte outside one number is the file's own, and the number is the bay's x.
    expect(literalEdits(text, saved)).toEqual(['["wings",1,"offset",0]'])
    expect(changedRegion(text, saved)).toEqual({ removed: '3', added: '8' })
    expect(saved).toContain('10.875')
    editor.history.undo()
    expect(written(editor.facility)).toBe(text)
  })
})

/** The joins of the facility by id. */
const join = (facility: Facility, id: string) => facility.joins.find((each) => each.id === id)

/** A new join between the clinic's corridor and yard in P3, with the members a join has. */
const garden: FacilityJoin = {
  id: 'garden',
  why: 'the back way into the yard',
  a: { phase: 'P3', room: 'corridor', door: 'backDoor' },
  b: { phase: 'P3', room: 'yard', door: 'backDoor' },
}

/** What the codec writes for a facility, read back: it must be the facility. */
function roundTrip(after: Facility): void {
  const read = facilityCodec.parse(written(after))
  expect(read.ok && read.value).toEqual(after)
}

describe('setJoin', () => {
  it('appends a join the facility does not have, selects it, and changes nothing else', () => {
    const editor = createFacilityEditor({ facility: shipped })
    expect(editor.run(setJoin(garden))).toMatchObject({ ok: true })
    expect(editor.facility.joins).toEqual([...shipped.joins, garden])
    expect(editor.facility.wings).toBe(shipped.wings)
    expect(editor.facility.phases).toBe(shipped.phases)
    expect(editor.facility.locks).toBe(shipped.locks)
    expect(editor.selection.ids).toEqual(['join:garden'])
    expect(editor.history.undoLabel).toBe('Set join garden')
    expect(setJoin(garden).id).toBe('join.set')
    editor.history.undo()
    expect(editor.facility).toBe(shipped)
  })

  it('replaces the join of that id in place, keeping the order and the members it was given', () => {
    const clinicDoor = join(shipped, 'clinicDoor') as FacilityJoin
    const moved: FacilityJoin = {
      ...clinicDoor,
      b: { phase: 'P2', room: 'bay', door: 'arrival' },
      note: 'x',
    } as FacilityJoin
    const after = levelOf(setJoin(moved).run(shipped))
    expect(after.joins.map((each) => each.id)).toEqual(shipped.joins.map((each) => each.id))
    expect(join(after, 'clinicDoor')).toBe(moved)
    expect(join(after, 'exit')).toBe(join(shipped, 'exit'))
    expect(join(after, 'clinicDoor')).toMatchObject({ note: 'x' })
  })

  it('accepts a street side and a side with a wall or an opening', () => {
    for (const side of [
      { street: 'start' },
      { street: 'end' },
      { phase: 'P2', room: 'recess', wall: 0 },
      { phase: 'P3', room: 'corridor', opening: 'exitWay' },
      { phase: 'P3', room: 'yard', door: 'streetGate' },
    ] as const)
      expect(setJoin({ id: 'g2', a: { phase: 'P3', room: 'hall', wall: 1 }, b: side }).run(shipped).ok).toBe(
        true,
      )
  })

  it('records nothing for the join it already has', () => {
    const editor = createFacilityEditor({ facility: shipped })
    const exit = join(shipped, 'exit') as FacilityJoin
    expect(editor.run(setJoin({ ...exit }))).toMatchObject({ ok: true })
    expect(editor.history.canUndo).toBe(false)
    expect(editor.selection.ids).toEqual(['join:exit'])
  })

  it('refuses a side whose phase the facility does not have, saying which side', () => {
    const bad = { phase: 'P9', room: 'hall', door: 'x' }
    expect(reasonOf(setJoin({ id: 'g2', a: bad, b: garden.b }).run(shipped))).toBe('side a: no phase P9')
    expect(reasonOf(setJoin({ id: 'g2', a: garden.a, b: bad }).run(shipped))).toBe('side b: no phase P9')
  })

  it('refuses a room the phase does not list, and accepts the yard, which is a room and a seen room', () => {
    expect(
      reasonOf(setJoin({ id: 'g2', a: { phase: 'P3', room: 'attic', door: 'x' }, b: garden.b }).run(shipped)),
    ).toBe('side a: phase P3 has no room attic')
    expect(
      setJoin({ id: 'g2', a: { phase: 'P3', room: 'yard', door: 'x' }, b: garden.a }).run(shipped).ok,
    ).toBe(true)
  })

  it('refuses a wall that is not a whole number from 0, and a door or an opening with no name', () => {
    for (const wall of [-1, 1.5, Number.NaN])
      expect(
        reasonOf(setJoin({ id: 'g2', a: { phase: 'P3', room: 'hall', wall }, b: garden.b }).run(shipped)),
        String(wall),
      ).toBe(`side a: wall ${wall} is not a whole number from 0`)
    expect(
      reasonOf(setJoin({ id: 'g2', a: { phase: 'P3', room: 'hall', door: '' }, b: garden.b }).run(shipped)),
    ).toBe('side a: a door needs a name')
    expect(
      reasonOf(
        setJoin({ id: 'g2', a: garden.a, b: { phase: 'P3', room: 'yard', opening: '' } }).run(shipped),
      ),
    ).toBe('side b: an opening needs a name')
  })

  it('refuses a door or an opening whose name is only spaces', () => {
    expect(
      reasonOf(setJoin({ id: 'g2', a: { phase: 'P3', room: 'hall', door: '  ' }, b: garden.b }).run(shipped)),
    ).toBe('side a: a door needs a name')
    expect(
      reasonOf(
        setJoin({ id: 'g2', a: garden.a, b: { phase: 'P3', room: 'yard', opening: ' ' } }).run(shipped),
      ),
    ).toBe('side b: an opening needs a name')
  })

  it('takes two sides that differ only in the street end, the wall, the door or the kind of name', () => {
    const hall = { phase: 'P3', room: 'hall' }
    const pairs: readonly (readonly [JoinSide, JoinSide])[] = [
      [{ street: 'start' }, { street: 'end' }],
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
    ]
    for (const [a, b] of pairs)
      expect(setJoin({ id: 'g2', a, b }).run(shipped).ok, JSON.stringify([a, b])).toBe(true)
  })

  it('refuses two sides that are the same', () => {
    expect(reasonOf(setJoin({ id: 'g2', a: garden.a, b: { ...garden.a } }).run(shipped))).toBe(
      'a join needs two different sides',
    )
    expect(reasonOf(setJoin({ id: 'g2', a: { street: 'start' }, b: { street: 'start' } }).run(shipped))).toBe(
      'a join needs two different sides',
    )
    const hall = { phase: 'P3', room: 'hall' }
    for (const side of [
      { ...hall, wall: 1 },
      { ...hall, door: 'x' },
      { ...hall, opening: 'x' },
    ] as const)
      expect(
        reasonOf(setJoin({ id: 'g2', a: side, b: { ...side } }).run(shipped)),
        JSON.stringify(side),
      ).toBe('a join needs two different sides')
  })

  it('refuses an id that cannot be selected when the join is new, and takes one the file already has', () => {
    for (const id of ['', 'a:b', 'a/b'])
      expect(reasonOf(setJoin({ ...garden, id }).run(shipped)), JSON.stringify(id)).toBe(
        `join id ${JSON.stringify(id)} cannot be empty or hold ":" or "/"`,
      )
    const odd: Facility = { ...shipped, joins: [...shipped.joins, { ...garden, id: 'odd:id' }] }
    const editor = createFacilityEditor({ facility: odd })
    expect(editor.run(setJoin({ ...garden, id: 'odd:id', why: 'changed' })).ok).toBe(true)
    expect(join(editor.facility, 'odd:id')?.why).toBe('changed')
    expect(editor.selection.ids).toEqual([])
  })

  it('writes back through the codec: a join added and a join replaced', () => {
    const added = levelOf(setJoin(garden).run(shipped))
    const region = changedRegion(text, written(added))
    expect(region.removed).toBe('')
    expect(region.added).toContain('"id": "garden"')
    roundTrip(added)
    const clinicDoor = join(shipped, 'clinicDoor') as FacilityJoin
    const replaced = levelOf(setJoin({ ...clinicDoor, why: 'changed' }).run(shipped))
    roundTrip(replaced)
    expect(changedRegion(text, written(replaced)).added).toBe('changed')
  })
})

describe('removeJoin', () => {
  it('removes the join by id, as one undo step that takes it out of the selection', () => {
    const editor = createFacilityEditor({ facility: shipped })
    editor.selection.set(['join:exit', 'join:clinicDoor'])
    expect(editor.run(removeJoin('exit'))).toMatchObject({ ok: true })
    expect(editor.facility.joins.map((each) => each.id)).toEqual(['clinicDoor', 'streetGate', 'shutter'])
    expect(editor.facility.joins[0]).toBe(join(shipped, 'clinicDoor'))
    expect(editor.facility.wings).toBe(shipped.wings)
    expect(editor.selection.ids).toEqual(['join:clinicDoor'])
    expect(editor.history.undoLabel).toBe('Remove join exit')
    expect(removeJoin('exit').id).toBe('join.remove')
    editor.history.undo()
    expect(editor.facility).toBe(shipped)
  })

  it('removes the join that was named and no other, wherever it is in the list', () => {
    expect(levelOf(removeJoin('streetGate').run(shipped)).joins.map((each) => each.id)).toEqual([
      'exit',
      'clinicDoor',
      'shutter',
    ])
  })

  it('refuses a join the facility does not have', () => {
    expect(reasonOf(removeJoin('exit2').run(shipped))).toBe('no join exit2')
  })

  it('writes back through the codec', () => {
    roundTrip(levelOf(removeJoin('exit').run(shipped)))
    roundTrip(levelOf(removeJoin('shutter').run(shipped)))
  })
})

/** The locks of the facility by id. */
const lockOf = (facility: Facility, id: string) => facility.locks.find((each) => each.id === id)

/** A new lock on the P3 hall, with the members a lock has. */
const hallDoor: FacilityLock = {
  id: 'p3.hall',
  kind: 'latch',
  phases: ['P3'],
  at: 'hallDoor',
  opens: ['hallDoor.unlatch'],
  fallback: ['hallDoor.latched'],
  hints: ['hallDoor'],
}

describe('setLock', () => {
  it('appends a lock the facility does not have, selects it, and changes nothing else', () => {
    const editor = createFacilityEditor({ facility: shipped })
    expect(editor.run(setLock(hallDoor))).toMatchObject({ ok: true })
    expect(editor.facility.locks).toEqual([...shipped.locks, hallDoor])
    expect(editor.facility.wings).toBe(shipped.wings)
    expect(editor.facility.joins).toBe(shipped.joins)
    expect(editor.facility.phases).toBe(shipped.phases)
    expect(editor.selection.ids).toEqual(['lock:p3.hall'])
    expect(editor.history.undoLabel).toBe('Set lock p3.hall')
    expect(setLock(hallDoor).id).toBe('lock.set')
    editor.history.undo()
    expect(editor.facility).toBe(shipped)
  })

  it('replaces the lock of that id in place, keeping the order and the members it was given', () => {
    const cabinet = lockOf(shipped, 'p0.cabinet') as FacilityLock
    const changed = {
      ...cabinet,
      kind: 'key',
      opens: ['code.right', 'code.skip'],
      fallback: [],
      hints: ['cabinet'],
      note: 'x',
    } as FacilityLock
    const after = levelOf(setLock(changed).run(shipped))
    expect(after.locks.map((each) => each.id)).toEqual(shipped.locks.map((each) => each.id))
    expect(lockOf(after, 'p0.cabinet')).toBe(changed)
    expect(lockOf(after, 'p0.supply')).toBe(lockOf(shipped, 'p0.supply'))
    expect(lockOf(after, 'p0.cabinet')).toMatchObject({ kind: 'key', note: 'x', fallback: [] })
    expect(after.wings).toBe(shipped.wings)
    expect(after.joins).toBe(shipped.joins)
    expect(after.phases).toBe(shipped.phases)
  })

  it('takes a lock on several phases and a place that is a list', () => {
    const yard = lockOf(shipped, 'p3.yard') as FacilityLock
    expect(Array.isArray(yard.at)).toBe(true)
    expect(setLock({ ...yard, phases: ['P2', 'P3'] }).run(shipped).ok).toBe(true)
    expect(setLock({ ...hallDoor, phases: ['P0', 'P1', 'P3'], at: ['a', 'b'] }).run(shipped).ok).toBe(true)
  })

  it('records nothing for the lock it already has', () => {
    const editor = createFacilityEditor({ facility: shipped })
    const cabinet = lockOf(shipped, 'p0.cabinet') as FacilityLock
    expect(editor.run(setLock({ ...cabinet }))).toMatchObject({ ok: true })
    expect(editor.history.canUndo).toBe(false)
    expect(editor.selection.ids).toEqual(['lock:p0.cabinet'])
  })

  it('refuses a lock on no phase, and a phase the facility does not have', () => {
    expect(reasonOf(setLock({ ...hallDoor, phases: [] }).run(shipped))).toBe(
      'a lock needs at least one phase',
    )
    expect(reasonOf(setLock({ ...hallDoor, phases: ['P3', 'P9'] }).run(shipped))).toBe('no phase P9')
    expect(reasonOf(setLock({ ...hallDoor, phases: ['P9', 'P8'] }).run(shipped))).toBe('no phase P9')
  })

  it('refuses a place that names nothing: a blank string, an empty list, a list with a blank entry', () => {
    for (const at of ['', '  ', [], ['hallDoor', ''], [' ']])
      expect(reasonOf(setLock({ ...hallDoor, at }).run(shipped)), JSON.stringify(at)).toBe(
        'a lock needs a place: the hotspot, box or wall door it is on',
      )
  })

  it('refuses an id that cannot be selected when the lock is new, and takes one the file already has', () => {
    for (const id of ['', 'a:b', 'a/b'])
      expect(reasonOf(setLock({ ...hallDoor, id }).run(shipped)), JSON.stringify(id)).toBe(
        `lock id ${JSON.stringify(id)} cannot be empty or hold ":" or "/"`,
      )
    const odd: Facility = { ...shipped, locks: [...shipped.locks, { ...hallDoor, id: 'odd:id' }] }
    const editor = createFacilityEditor({ facility: odd })
    expect(editor.run(setLock({ ...hallDoor, id: 'odd:id', kind: 'key' })).ok).toBe(true)
    expect(lockOf(editor.facility, 'odd:id')?.kind).toBe('key')
    expect(editor.selection.ids).toEqual([])
  })

  it('writes back through the codec: a lock added, a lock replaced and a place that became a list', () => {
    const added = levelOf(setLock(hallDoor).run(shipped))
    const region = changedRegion(text, written(added))
    expect(region.removed).toBe('')
    expect(region.added).toContain('"id": "p3.hall"')
    roundTrip(added)
    const cabinet = lockOf(shipped, 'p0.cabinet') as FacilityLock
    const replaced = levelOf(setLock({ ...cabinet, kind: 'key', hints: ['cabinet'] }).run(shipped))
    roundTrip(replaced)
    expect(changedRegion(text, written(replaced)).removed).toContain('code')
    roundTrip(levelOf(setLock({ ...cabinet, at: ['cabinet', 'shelf'] }).run(shipped)))
  })
})
