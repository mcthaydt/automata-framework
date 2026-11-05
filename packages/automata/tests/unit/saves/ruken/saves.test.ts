import { settle } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { Saves } from '#src/app/boot/effect-tags.ts'
import { defineSave } from '#src/features/saves/save.schema.ts'
import { saveOf } from '#src/features/saves/saves.manager.ts'
import { RuntimeTest } from '#src/testing/runtime/ruken/runtime-test.ts'
import { Hosting } from '../../../../src/shared/host/hosting.ts'
import { FakeHostHandle } from '../../../../src/testing/host/page/ruken/hosting-test.ts'

// The game's save as a runtime service (M5 spec §4.3, §5): `GameDefinition.saves` boots it, and a screen asks for it
// by the definition, as `settingsStore(def)` does for settings.

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
    Effect.gen(function* () {
      const save = saveOf(yield* Saves, run)
      expect(save.loaded.get()).toBeUndefined()
      const loaded = yield* Effect.promise(() => save.load(1))
      expect(loaded.ok && loaded.value.data).toEqual({ coins: 0 })
      expect(save.loaded.get()).toBe(1)
    }).pipe(Effect.provide(RuntimeTest({ saves: run })), Effect.runPromise))

  it('throws for a definition the game did not boot with', () =>
    Effect.gen(function* () {
      const saves = yield* Saves
      expect(() => saveOf(saves, other)).toThrow("'other'")
    }).pipe(Effect.provide(RuntimeTest({ saves: run })), Effect.runPromise))

  it('holds nothing for a game without saves, and throws when one is asked for', () =>
    Effect.gen(function* () {
      const saves = yield* Saves
      expect(saves).toEqual({ key: undefined, save: undefined })
      expect(() => saveOf(saves, run)).toThrow()
    }).pipe(Effect.provide(RuntimeTest()), Effect.runPromise))

  it('writes the touched progress when a round ends, through the booted triggers', () =>
    Effect.gen(function* () {
      const hosting = yield* Hosting
      const { sentByGame } = yield* FakeHostHandle
      const save = saveOf(yield* Saves, run)
      yield* Effect.promise(() => save.load(0))
      yield* Effect.promise(() => settle(2))
      save.touch(() => ({ coins: 3 }))
      yield* hosting.round.start
      yield* hosting.round.end('complete')
      yield* Effect.promise(() => settle(2))
      expect(sentByGame('saves.set')).toEqual([expect.objectContaining({ key: 'run.slot.0' })])
    }).pipe(Effect.provide(RuntimeTest({ saves: run })), Effect.runPromise))
})
