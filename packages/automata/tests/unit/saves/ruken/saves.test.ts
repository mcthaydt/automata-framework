import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineSave } from '#src/features/saves/save.schema.ts'
import { saveOf } from '#src/features/saves/saves.manager.ts'
import { withRuntimeTest } from '#src/testing/runtime/ruken/runtime-test.ts'

// The game's save as a runtime service (M5 spec §4.3, §5): `GameDefinition.saves` boots it, and a screen asks for it
// by the definition, as `settingsStore(settings, def)` does for settings.

interface Run {
  readonly coins: number
}
const run = defineSave<Run>({
  key: 'run',
  version: 1,
  schema: z.object({ coins: z.number() }),
  empty: () => ({ coins: 0 }),
  migrations: {},
  slots: { count: 2 },
})
const other = defineSave<Run>({ ...run, key: 'other' })

describe('the Saves service', () => {
  it('gives a screen the booted save when asked by its definition', () =>
    withRuntimeTest(
      async ({ services }) => {
        const save = saveOf(services.saves, run)
        expect(save.loaded.get()).toBeUndefined()
        const loaded = await save.load(1)
        expect(loaded.ok && loaded.value.data).toEqual({ coins: 0 })
        expect(save.loaded.get()).toBe(1)
      },
      { saves: run },
    ))

  it('throws for a definition the game did not boot with', () =>
    withRuntimeTest(
      ({ services }) => {
        expect(() => saveOf(services.saves, other)).toThrow("'other'")
      },
      { saves: run },
    ))

  it('holds nothing for a game without saves, and throws when one is asked for', () =>
    withRuntimeTest(({ services }) => {
      expect(services.saves).toEqual({ key: undefined, save: undefined })
      expect(() => saveOf(services.saves, run)).toThrow()
    }))

  it('writes the touched progress when a round ends, through the booted triggers', () =>
    withRuntimeTest(
      async ({ services, handle }) => {
        const save = saveOf(services.saves, run)
        await save.load(0)
        await settle(2)
        save.touch(() => ({ coins: 3 }))
        services.hosting.round.start()
        services.hosting.round.end('complete')
        await settle(2)
        expect(handle.sentByGame('saves.set')).toEqual([expect.objectContaining({ key: 'run.slot.0' })])
      },
      { saves: run },
    ))
})
