import { describe, expect, it } from 'vitest'
import { createSlotsModel, slotViewOf } from '#src/app/screens/saves/saves-view.svelte.ts'
import type { SlotState } from '#src/features/saves/save.schema.ts'

// The title's slot list as a view of the runtime's `SlotState` (M5 spec §4.3, §7): the same five kinds, with the
// slot's header copied out, and the activity only the screen knows (a write it started, or one that failed).

const meta = { version: 1, contentHash: 'abc', savedAt: 500, snapshot: false } as const

describe('slotViewOf', () => {
  it('copies the header a ready slot shows: its time and its label when it has one', () => {
    expect(slotViewOf({ kind: 'ready', slot: 1, meta: { ...meta, label: 'Run 2' } })).toEqual({
      kind: 'ready',
      slot: 1,
      savedAt: 500,
      label: 'Run 2',
    })
    expect(slotViewOf({ kind: 'ready', slot: 1, meta })).toEqual({ kind: 'ready', slot: 1, savedAt: 500 })
  })

  it('shows a slot saved with other content like a ready one, under its own kind', () => {
    expect(slotViewOf({ kind: 'other-content', slot: 0, meta })).toEqual({
      kind: 'other-content',
      slot: 0,
      savedAt: 500,
    })
  })

  it('keeps only the slot of an empty, an unreadable or a newer one: the reason stays in the logs', () => {
    expect(slotViewOf({ kind: 'empty', slot: 2 })).toEqual({ kind: 'empty', slot: 2 })
    expect(slotViewOf({ kind: 'unreadable', slot: 0, reason: 'not JSON' })).toEqual({
      kind: 'unreadable',
      slot: 0,
    })
    expect(slotViewOf({ kind: 'newer', slot: 0, version: 9 })).toEqual({ kind: 'newer', slot: 0 })
  })

  it('adds the activity it is given', () => {
    expect(slotViewOf({ kind: 'empty', slot: 2 }, 'writing')).toEqual({
      kind: 'empty',
      slot: 2,
      activity: 'writing',
    })
  })
})

describe('createSlotsModel', () => {
  const states: readonly SlotState[] = [
    { kind: 'empty', slot: 0 },
    { kind: 'ready', slot: 1, meta },
  ]

  it('is loading until the runtime has said what the slots hold', () => {
    const model = createSlotsModel()
    expect(model.view).toEqual({ state: 'loading' })
  })

  it('lists the slots it is given, and follows a change to them', () => {
    const model = createSlotsModel()
    model.set(states)
    expect(model.view).toEqual({
      state: 'slots',
      slots: [
        { kind: 'empty', slot: 0 },
        { kind: 'ready', slot: 1, savedAt: 500 },
      ],
    })
    model.set([{ kind: 'empty', slot: 0 }])
    expect(model.view).toEqual({ state: 'slots', slots: [{ kind: 'empty', slot: 0 }] })
  })

  it('marks a slot while a write of the screen’s is in flight or after it failed, and clears the mark', () => {
    const model = createSlotsModel()
    model.set(states)
    model.mark(1, 'writing')
    expect(model.view).toMatchObject({ slots: [{ slot: 0 }, { slot: 1, activity: 'writing' }] })
    model.mark(1, 'failed')
    expect(model.view).toMatchObject({ slots: [{ slot: 0 }, { slot: 1, activity: 'failed' }] })
    model.mark(1, undefined)
    expect(model.view).toEqual({
      state: 'slots',
      slots: [
        { kind: 'empty', slot: 0 },
        { kind: 'ready', slot: 1, savedAt: 500 },
      ],
    })
  })

  it('does not mark a slot it does not list, and drops a mark when a new list arrives', () => {
    const model = createSlotsModel()
    model.set(states)
    model.mark(1, 'failed')
    model.set(states)
    expect(model.view).toMatchObject({ slots: [{ slot: 0 }, { slot: 1 }] })
    const view = model.view
    expect(view.state === 'slots' ? view.slots[1]?.activity : 'loading').toBeUndefined()
  })
})
