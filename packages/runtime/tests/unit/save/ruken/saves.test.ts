import { Hosting } from '@mcthaydt/automata-host'
import { FakeHostHandle } from '@mcthaydt/automata-host/testing'
import { settle } from '@ruken/sdk-host/testing'
import { Cause, Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { defineSave } from '#src/save/save.schema.ts'
import { Saves, saveOf } from '#src/save/saves.manager.ts'
import { RuntimeTest } from '#src/testing/ruken/runtime-test.ts'

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
      const save = yield* saveOf(run)
      expect(yield* save.loaded.get).toBeUndefined()
      expect((yield* save.load(1)).data).toEqual({ coins: 0 })
      expect(yield* save.loaded.get).toBe(1)
    }).pipe(Effect.provide(RuntimeTest({ saves: run })), Effect.runPromise))

  it('dies for a definition the game did not boot with', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(saveOf(other))
      expect(Exit.isFailure(exit) && Cause.isDie(exit.cause)).toBe(true)
      expect(JSON.stringify(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : '')).toContain("'other'")
    }).pipe(Effect.provide(RuntimeTest({ saves: run })), Effect.runPromise))

  it('holds nothing for a game without saves, and dies when one is asked for', () =>
    Effect.gen(function* () {
      expect(yield* Saves).toEqual({ key: undefined, save: undefined })
      expect(Exit.isFailure(yield* Effect.exit(saveOf(run)))).toBe(true)
    }).pipe(Effect.provide(RuntimeTest()), Effect.runPromise))

  it('writes the touched progress when a round ends, through the booted triggers', () =>
    Effect.gen(function* () {
      const hosting = yield* Hosting
      const { sentByGame } = yield* FakeHostHandle
      const save = yield* saveOf(run)
      yield* save.load(0)
      yield* Effect.promise(() => settle(2))
      save.touch(() => ({ coins: 3 }))
      yield* hosting.round.start
      yield* hosting.round.end('complete')
      yield* Effect.promise(() => settle(2))
      expect(sentByGame('saves.set')).toEqual([expect.objectContaining({ key: 'run.slot.0' })])
    }).pipe(Effect.provide(RuntimeTest({ saves: run })), Effect.runPromise))
})
