// base-3d's save (DESIGN.md §12.1): the shape, a new game, passthrough of unknown fields, the version-1 fixture, and
// the migration path a later version takes (G3-s), proved with a test-only version 2.
import type { SaveDef } from '@mcthaydt/automata-runtime'
import { describe, expect, it } from 'vitest'
import { type Base3dSave, base3dSave, base3dSaveSchema, newGame } from './save.ts'
import v1 from './save-fixtures/v1.json' with { type: 'json' }

describe('base3dSave', () => {
  it('is one slot under one key at version 1, autosaving on screen exit, background and every 60 s', () => {
    expect(base3dSave.key).toBe('base-3d')
    expect(base3dSave.version).toBe(1)
    expect(base3dSave.slots).toBeUndefined()
    expect(base3dSave.migrations).toEqual({})
    expect(base3dSave.autosave).toEqual({
      on: ['screen-exit', 'background', 'interval'],
      intervalSeconds: 60,
    })
  })

  it('starts a new game in the hub with three hearts, nothing found and no play time', () => {
    const fresh = newGame()
    expect(base3dSaveSchema.parse(fresh)).toEqual(fresh)
    expect(fresh).toMatchObject({ hearts: { max: 3, pieces: [] }, embers: 0, resume: 'hub', playTicks: 0 })
    expect(fresh.items).toEqual({ sling: false, bombs: false, hookchain: false })
    expect(base3dSave.empty()).toEqual(fresh)
  })

  it('rejects a malformed record', () => {
    expect(base3dSaveSchema.safeParse({ ...newGame(), resume: 'moon' }).success).toBe(false)
    expect(base3dSaveSchema.safeParse({ ...newGame(), embers: -1 }).success).toBe(false)
    expect(base3dSaveSchema.safeParse({ ...newGame(), hearts: undefined }).success).toBe(false)
  })

  it('keeps fields it does not know (a later build of this version may have added them)', () => {
    expect(base3dSaveSchema.parse({ ...newGame(), lantern: 'lit' })).toMatchObject({ lantern: 'lit' })
  })

  it('parses the version-1 fixture', () => {
    const parsed: Base3dSave = base3dSaveSchema.parse(v1)
    expect(parsed.resume).toBe('kiln')
    expect(parsed.kiln.visited).toEqual(['d1', 'd2'])
  })

  it('migrates the version-1 fixture through a version-2 step (test only: the shipped save stays at 1)', () => {
    const v2Schema = base3dSaveSchema.extend({ bottles: base3dSaveSchema.shape.embers })
    const v2: SaveDef<Base3dSave & { bottles: number }> = {
      ...base3dSave,
      version: 2,
      schema: v2Schema,
      empty: () => ({ ...newGame(), bottles: 0 }),
      migrations: { 1: (record) => ({ ...record, bottles: 0 }) },
    }
    const step = v2.migrations[1]
    expect(step).toBeTypeOf('function')
    const migrated = v2.schema.parse(step?.(v1))
    expect(migrated).toMatchObject({ bottles: 0, embers: 1, resume: 'kiln' })
  })
})
