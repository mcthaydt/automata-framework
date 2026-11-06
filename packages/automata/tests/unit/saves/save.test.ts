import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  autosaveOf,
  defineSave,
  encodeEnvelope,
  readSave,
  type SaveEnvelope,
  slotKey,
  slotOf,
  slotState,
} from '#src/features/saves/save.schema.ts'

// The save envelope, slot keys, classification and migrations (M5 spec §4.2, §6). The newer-build and passthrough
// rules are strict; an unreadable slot is kept, never read as empty.

const BUILD = 'c0ffee'

// Version 3 of a small progress record. Version 1 stored `best`; version 2 renamed it; version 3 added `coins`.
const progress = defineSave({
  key: 'run',
  version: 3,
  schema: z.object({ name: z.string(), bestTime: z.number(), coins: z.number() }),
  empty: () => ({ name: '', bestTime: 0, coins: 0 }),
  migrations: {
    1: ({ best, ...rest }) => ({ ...rest, bestTime: best }),
    2: (record) => ({ ...record, coins: 0 }),
  },
  slots: { count: 3 },
})

const envelope = (fields: Partial<SaveEnvelope> = {}): SaveEnvelope => ({
  format: 1,
  version: 3,
  contentHash: BUILD,
  savedAt: 1000,
  data: { name: 'Kite', bestTime: 12, coins: 4 },
  ...fields,
})
const stored = (fields: Partial<SaveEnvelope> = {}) => encodeEnvelope(envelope(fields))

describe('slot keys', () => {
  it('stores each slot under `<key>.slot.<n>`, and reads the slot back from the key', () => {
    expect(slotKey(progress, 0)).toBe('run.slot.0')
    expect(slotKey(progress, 2)).toBe('run.slot.2')
    expect(slotOf(progress, 'run.slot.2')).toBe(2)
  })

  it('ignores keys that are not one of its slots', () => {
    for (const key of [
      'run',
      'run.slot.3',
      'run.slot.x',
      'run.slot.-1',
      'run.slot.01',
      'other.slot.0',
      'run.slot.',
    ])
      expect(slotOf(progress, key)).toBeUndefined()
  })

  it('keeps a save without slots at its key, as slot 0', () => {
    const { slots: _slots, ...one } = progress
    const single = defineSave(one)
    expect(slotKey(single, 0)).toBe('run')
    expect(slotOf(single, 'run')).toBe(0)
    expect(slotOf(single, 'run.slot.0')).toBeUndefined()
  })
})

describe('the envelope', () => {
  it('is canonical JSON: the same state is the same bytes, whatever the key order', () => {
    const reordered = { data: { coins: 4, bestTime: 12, name: 'Kite' }, savedAt: 1000 }
    expect(stored(reordered)).toBe(stored())
    expect(stored()).toBe(
      '{"contentHash":"c0ffee","data":{"bestTime":12,"coins":4,"name":"Kite"},"format":1,"savedAt":1000,"version":3}',
    )
  })
})

describe('classifying a slot from its header (no migration)', () => {
  it('is empty with nothing stored', () => {
    expect(slotState(progress, 1, null, BUILD)).toEqual({ kind: 'empty', slot: 1 })
  })

  it('is ready with its metadata', () => {
    expect(slotState(progress, 1, stored({ label: 'Floor 3' }), BUILD)).toEqual({
      kind: 'ready',
      slot: 1,
      meta: { version: 3, contentHash: BUILD, savedAt: 1000, label: 'Floor 3', snapshot: false },
    })
  })

  it('is ready at an older version: migration waits for load', () => {
    expect(
      slotState(progress, 0, stored({ version: 1, data: { name: 'Kite', best: 12 } }), BUILD),
    ).toMatchObject({
      kind: 'ready',
      meta: { version: 1 },
    })
  })

  it.each([
    ['not JSON', '{"format":'],
    ['not an object', '[1]'],
    ['another format', JSON.stringify({ ...envelope(), format: 2 })],
    ['no version', JSON.stringify({ ...envelope(), version: undefined })],
    ['a version below 1', JSON.stringify({ ...envelope(), version: 0 })],
    ['data that is not an object', JSON.stringify({ ...envelope(), data: [] })],
    ['a label that is not text', JSON.stringify({ ...envelope(), label: 3 })],
  ])('is unreadable for %s', (_name, raw) => {
    expect(slotState(progress, 2, raw, BUILD)).toMatchObject({ kind: 'unreadable', slot: 2 })
  })

  it("is newer for a later build's save (S-e)", () => {
    expect(slotState(progress, 0, stored({ version: 4 }), BUILD)).toEqual({
      kind: 'newer',
      slot: 0,
      version: 4,
    })
  })

  it('is other-content for a snapshot taken with other content, ready for one taken with this content', () => {
    expect(slotState(progress, 0, stored({ contentHash: 'beef', snapshot: 'AAE=' }), BUILD)).toMatchObject({
      kind: 'other-content',
      meta: { contentHash: 'beef', snapshot: true },
    })
    expect(slotState(progress, 0, stored({ snapshot: 'AAE=' }), BUILD)).toMatchObject({
      kind: 'ready',
      meta: { snapshot: true },
    })
  })

  it('is ready for data saved with other content but no snapshot: only a snapshot depends on the content', () => {
    expect(slotState(progress, 0, stored({ contentHash: 'beef' }), BUILD)).toMatchObject({ kind: 'ready' })
  })
})

describe('migrations', () => {
  it('reads a version-1 save on version 3 through steps 1→2 and 2→3 (S-a)', () => {
    const read = readSave(progress, stored({ version: 1, data: { name: 'Kite', best: 12 } }))
    expect(read).toMatchObject({ ok: true, data: { name: 'Kite', bestTime: 12, coins: 0 } })
  })

  it('is unreadable when a step is missing, naming it (S-f)', () => {
    const gap = defineSave({ ...progress, migrations: { 2: progress.migrations[2]! } })
    const read = readSave(gap, stored({ version: 1, data: { name: 'Kite', best: 12 } }))
    expect(read).toEqual({ ok: false, reason: 'unreadable', detail: 'no migration from version 1' })
  })

  it('is unreadable when a step throws', () => {
    const broken = defineSave({
      ...progress,
      migrations: {
        ...progress.migrations,
        1: () => {
          throw new Error('bad record')
        },
      },
    })
    expect(readSave(broken, stored({ version: 1, data: {} }))).toMatchObject({
      ok: false,
      reason: 'unreadable',
    })
  })

  it('is unreadable when the migrated data fails the schema', () => {
    expect(readSave(progress, stored({ data: { name: 'Kite' } }))).toMatchObject({
      ok: false,
      reason: 'unreadable',
    })
  })

  it('is newer for a later build, and migrates nothing (S-e)', () => {
    expect(readSave(progress, stored({ version: 4 }))).toEqual({ ok: false, reason: 'newer', version: 4 })
  })

  it('keeps a field this build does not know, so a write by this build does not drop it', () => {
    const read = readSave(progress, stored({ data: { name: 'Kite', bestTime: 12, coins: 4, hat: 'red' } }))
    expect(read).toMatchObject({ ok: true, data: { hat: 'red' } })
  })
})

describe('the autosave policy (M5 spec §4.4, M5-D10)', () => {
  it('is, when absent, a save on leaving a screen, at a round end and in the background, with no timer', () => {
    expect(autosaveOf(progress)).toEqual({
      on: new Set(['screen-exit', 'round-end', 'background']),
      intervalSeconds: undefined,
    })
  })

  it('is off with an empty trigger list', () => {
    expect(autosaveOf({ ...progress, autosave: { on: [] } }).on.size).toBe(0)
  })

  it('takes exactly the triggers it lists, once each', () => {
    const policy = autosaveOf({ ...progress, autosave: { on: ['background', 'background', 'round-end'] } })
    expect([...policy.on]).toEqual(['background', 'round-end'])
  })

  it('has a 60 s timer when it lists `interval` and says no more, and the game can set it', () => {
    expect(autosaveOf({ ...progress, autosave: { on: ['interval'] } }).intervalSeconds).toBe(60)
    expect(
      autosaveOf({ ...progress, autosave: { on: ['interval'], intervalSeconds: 5 } }).intervalSeconds,
    ).toBe(5)
  })

  it('reads `intervalSeconds` only with `interval`: without it there is no timer, whatever the number', () => {
    expect(
      autosaveOf({ ...progress, autosave: { on: ['background'], intervalSeconds: 5 } }).intervalSeconds,
    ).toBeUndefined()
    expect(
      autosaveOf({ ...progress, autosave: { on: ['background'], intervalSeconds: 0 } }).intervalSeconds,
    ).toBeUndefined()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses an interval of %s seconds, which a timer cannot keep',
    (intervalSeconds) => {
      expect(() => autosaveOf({ ...progress, autosave: { on: ['interval'], intervalSeconds } })).toThrow(
        /intervalSeconds/,
      )
    },
  )
})
