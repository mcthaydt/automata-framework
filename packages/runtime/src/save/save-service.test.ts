import { Hosting } from '@mcthaydt/automata-host'
import { FakeHostHandle, HostingTest, runScoped } from '@mcthaydt/automata-host/testing'
import { settle } from '@ruken/sdk-host/testing'
import { Effect, Either, Fiber, type Scope, Stream, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  makePresentationBus,
  PresentationBus,
  type RuntimeFacts,
} from '../presentation/presentation-bus.manager.js'
import { type Save, saveService } from './save.manager.js'
import { defineSave, encodeEnvelope, type SaveEnvelope } from './save.schema.js'

// The `Save` service over `Hosting.saves` (M5 spec §4.3, §5 "Load a slot", §6), under the fake Ruken host.

const BUILD = 'c0ffee'
const settled: Effect.Effect<void> = Effect.promise(() => settle())

interface Run {
  readonly name: string
  readonly bestTime: number
  readonly coins: number
}

const run = defineSave<Run>({
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

const stored = (fields: Partial<SaveEnvelope> = {}) =>
  encodeEnvelope({
    format: 1,
    version: 3,
    contentHash: BUILD,
    savedAt: 1000,
    data: { name: 'Kite', bestTime: 12, coins: 4 },
    ...fields,
  })

type Facts = { [K in 'save.written' | 'save.failed' | 'save.loaded']: [K, RuntimeFacts[K]] }[
  | 'save.written'
  | 'save.failed'
  | 'save.loaded']

/** Runs `test` with a `Save` over a fake host seeded with `saves`, collecting the save facts in order. */
function withSave<A, E>(
  saves: Record<string, string>,
  test: (save: Save<Run>, facts: Facts[]) => Effect.Effect<A, E, Hosting | FakeHostHandle | Scope.Scope>,
  def: typeof run = run,
): Promise<A> {
  return runScoped(
    Effect.gen(function* () {
      const bus = yield* makePresentationBus()
      const facts: Facts[] = []
      bus.subscribe('save.written', (fact) => facts.push(['save.written', fact]))
      bus.subscribe('save.failed', (fact) => facts.push(['save.failed', fact]))
      bus.subscribe('save.loaded', (fact) => facts.push(['save.loaded', fact]))
      const save = yield* saveService(def, { contentHash: BUILD }).pipe(
        Effect.provideService(PresentationBus, bus),
      )
      return yield* test(save, facts)
    }).pipe(Effect.provide(HostingTest({ host: { saves } })), Effect.provide(TestContext.TestContext)),
  )
}

describe('the slot list', () => {
  it('is read from the host at start: each slot key classified, every other key ignored', async () => {
    await withSave(
      {
        'run.slot.0': stored({ label: 'Floor 3' }),
        'run.slot.2': stored({ version: 4 }),
        other: 'x',
        'run.slot.7': stored(),
      },
      (save) =>
        Effect.gen(function* () {
          expect(yield* save.slots.get).toEqual([
            {
              kind: 'ready',
              slot: 0,
              meta: { version: 3, contentHash: BUILD, savedAt: 1000, label: 'Floor 3', snapshot: false },
            },
            { kind: 'empty', slot: 1 },
            { kind: 'newer', slot: 2, version: 4 },
          ])
        }),
    )
  })
})

describe('write and load', () => {
  it('writes a canonical envelope stamped by the Clock, and loads it back', async () => {
    await withSave({}, (save, facts) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* TestClock.setTime(5000)
        yield* save.write(1, { name: 'Wren', bestTime: 9, coins: 2 }, { label: 'Floor 2' })
        yield* settled
        expect(sentByGame('saves.set')).toEqual([
          expect.objectContaining({
            key: 'run.slot.1',
            value: stored({ savedAt: 5000, label: 'Floor 2', data: { name: 'Wren', bestTime: 9, coins: 2 } }),
          }),
        ])
        expect((yield* save.slots.get)[1]).toMatchObject({
          kind: 'ready',
          meta: { savedAt: 5000, label: 'Floor 2' },
        })

        const loaded = yield* save.load(1)
        expect(loaded).toEqual({
          slot: 1,
          data: { name: 'Wren', bestTime: 9, coins: 2 },
          meta: { version: 3, contentHash: BUILD, savedAt: 5000, label: 'Floor 2', snapshot: false },
        })
        expect(facts).toEqual([
          ['save.written', { key: 'run', slot: 1 }],
          ['save.loaded', { key: 'run', slot: 1 }],
        ])
      }),
    )
  })

  it('loads an empty slot as the empty value, writing nothing', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        expect(yield* save.load(0)).toEqual({
          slot: 0,
          data: { name: '', bestTime: 0, coins: 0 },
          meta: undefined,
        })
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])
      }),
    )
  })

  it('sends one saves.set for the same state written twice, even later (S-b)', async () => {
    await withSave({}, (save, facts) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        const state = { name: 'Wren', bestTime: 9, coins: 2 }
        yield* save.write(0, state)
        yield* TestClock.adjust('1 minute')
        yield* save.write(0, { ...state })
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)
        expect(facts).toHaveLength(1)

        yield* save.write(0, { ...state, coins: 3 })
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(2)
      }),
    )
  })

  it('migrates an older save on load (S-a), and the next write stores the new version', async () => {
    await withSave({ 'run.slot.0': stored({ version: 1, data: { name: 'Kite', best: 12 } }) }, (save) =>
      Effect.gen(function* () {
        const loaded = yield* save.load(0)
        expect(loaded.data).toEqual({ name: 'Kite', bestTime: 12, coins: 0 })
        yield* save.write(0, loaded.data)
        expect((yield* save.slots.get)[0]).toMatchObject({ kind: 'ready', meta: { version: 3 } })
      }),
    )
  })
})

describe('a save from a newer build (S-e)', () => {
  it('is read-only: load fails, write is refused, and nothing reaches the host', async () => {
    const newer = stored({ version: 4 })
    await withSave({ 'run.slot.0': newer }, (save) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        expect(yield* Effect.flip(save.load(0))).toMatchObject({
          _tag: 'SaveFromNewerBuild',
          slot: 0,
          version: 4,
        })
        expect(yield* Effect.flip(save.write(0, run.empty()))).toMatchObject({
          _tag: 'SaveRefused',
          slot: 0,
          reason: 'newer',
        })
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])
        expect(yield* hosting.saves.get('run.slot.0')).toBe(newer)
      }),
    )
  })
})

describe('an unreadable save (S-f)', () => {
  it('fails to load, is marked unreadable and kept; only an explicit write replaces it', async () => {
    // A version-2 save on a build whose step 2 is missing.
    const gap = defineSave<Run>({ ...run, migrations: { 1: run.migrations[1]! } })
    const kept = stored({ version: 2, data: { name: 'Kite', bestTime: 12 } })
    await withSave(
      { 'run.slot.0': kept },
      (save) =>
        Effect.gen(function* () {
          const hosting = yield* Hosting
          expect(yield* Effect.flip(save.load(0))).toMatchObject({
            _tag: 'SaveUnreadable',
            slot: 0,
            reason: 'no migration from version 2',
          })
          expect((yield* save.slots.get)[0]).toEqual({
            kind: 'unreadable',
            slot: 0,
            reason: 'no migration from version 2',
          })
          expect(yield* hosting.saves.get('run.slot.0')).toBe(kept)

          yield* save.write(0, gap.empty())
          expect((yield* save.slots.get)[0]).toMatchObject({ kind: 'ready' })
        }),
      gap,
    )
  })
})

describe('snapshots (M5-D5)', () => {
  it('returns the snapshot taken with this content, and drops one taken with other content', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        yield* save.write(0, run.empty(), { snapshot: new Uint8Array([0, 1, 254, 255]) })
        expect((yield* save.load(0)).snapshot).toEqual(new Uint8Array([0, 1, 254, 255]))
      }),
    )
    await withSave({ 'run.slot.0': stored({ contentHash: 'beef', snapshot: 'AAH+/w==' }) }, (save) =>
      Effect.gen(function* () {
        expect((yield* save.slots.get)[0]).toMatchObject({ kind: 'other-content' })
        const loaded = yield* save.load(0)
        expect(loaded.data).toEqual({ name: 'Kite', bestTime: 12, coins: 4 })
        expect(loaded.snapshot).toBeUndefined()
      }),
    )
  })
})

describe('remove', () => {
  it('empties the slot on the host and in the list', async () => {
    await withSave({ 'run.slot.1': stored() }, (save) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* save.remove(1)
        expect(yield* hosting.saves.get('run.slot.1')).toBeNull()
        expect((yield* save.slots.get)[1]).toEqual({ kind: 'empty', slot: 1 })
      }),
    )
  })
})

describe('a refused write', () => {
  it('publishes save.failed with the host code, relays the error and leaves the slot as it was', async () => {
    await withSave({}, (save, facts) =>
      Effect.gen(function* () {
        // Larger than any per-value limit Ruken could set; AF quotes no number (R-5). The SDK refuses it first.
        const tooBig = 'x'.repeat(16 * 1024 * 1024)
        const failed = yield* Effect.either(save.write(0, { name: tooBig, bestTime: 0, coins: 0 }))
        expect(Either.isLeft(failed) && failed.left).toMatchObject({
          _tag: 'HostError',
          code: 'QUOTA_EXCEEDED',
        })
        expect(facts).toEqual([['save.failed', { key: 'run', slot: 0, code: 'QUOTA_EXCEEDED' }]])
        expect((yield* save.slots.get)[0]).toEqual({ kind: 'empty', slot: 0 })
      }),
    )
  })
})

describe('the loaded slot and touch (M5 spec §4.3, §4.4)', () => {
  it('is no slot until one loads, then the slot the last successful load returned', async () => {
    await withSave({ 'run.slot.0': stored(), 'run.slot.2': stored({ version: 4 }) }, (save) =>
      Effect.gen(function* () {
        expect(yield* save.loaded.get).toBeUndefined()
        yield* save.load(1)
        expect(yield* save.loaded.get).toBe(1)
        yield* save.load(0)
        expect(yield* save.loaded.get).toBe(0)
        // A load that fails leaves the slot being played as it was.
        expect(Either.isLeft(yield* Effect.either(save.load(2)))).toBe(true)
        expect(yield* save.loaded.get).toBe(0)
      }),
    )
  })

  it('tells a subscriber each time the loaded slot changes', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const seen: (number | undefined)[] = []
        const reader = yield* Stream.runForEach(save.loaded.changes, (slot) =>
          Effect.sync(() => seen.push(slot)),
        ).pipe(Effect.fork)
        yield* settled
        yield* save.load(2)
        yield* save.load(1)
        yield* settled
        yield* Fiber.interrupt(reader)
        expect(seen).toEqual([undefined, 2, 1])
      }),
    )
  })

  it('takes a touch before any load as nothing: it does not throw, and keeps nothing', async () => {
    await withSave({}, (save) =>
      Effect.sync(() => {
        expect(() => save.touch(() => ({ name: 'Early', bestTime: 1, coins: 1 }))).not.toThrow()
      }),
    )
  })
})
