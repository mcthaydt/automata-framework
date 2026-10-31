import { Hosting, type HostingSaves } from '@mcthaydt/automata-host'
import { FakeHostHandle, HostingTest, manualClock, runScoped } from '@mcthaydt/automata-host/testing'
import { FakeHostControl, FakeHosting } from '@mcthaydt/automata-testing/host'
import { settle } from '@ruken/sdk-host/testing'
import { Deferred, Effect, Either, Exit, Fiber, PubSub, Scope, Stream, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  makePresentationBus,
  PresentationBus,
  type RuntimeFacts,
} from '../../presentation/presentation-bus.manager.js'
import { type Save, saveService } from '../save.manager.js'
import { defineSave, encodeEnvelope, type SaveEnvelope } from '../save.schema.js'

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

type Facts = {
  [K in 'save.written' | 'save.failed' | 'save.loaded' | 'save.changedElsewhere']: [K, RuntimeFacts[K]]
}['save.written' | 'save.failed' | 'save.loaded' | 'save.changedElsewhere']

/** Runs `test` with a `Save` over a fake host seeded with `saves`, collecting the save facts in order. */
function withSave<A, E>(
  saves: Record<string, string>,
  test: (
    save: Save<Run>,
    facts: Facts[],
    bus: PresentationBus,
  ) => Effect.Effect<A, E, Hosting | FakeHostHandle | Scope.Scope>,
  def: typeof run = run,
): Promise<A> {
  return runScoped(
    Effect.gen(function* () {
      const bus = yield* makePresentationBus()
      const facts: Facts[] = []
      bus.subscribe('save.written', (fact) => facts.push(['save.written', fact]))
      bus.subscribe('save.failed', (fact) => facts.push(['save.failed', fact]))
      bus.subscribe('save.loaded', (fact) => facts.push(['save.loaded', fact]))
      bus.subscribe('save.changedElsewhere', (fact) => facts.push(['save.changedElsewhere', fact]))
      const save = yield* saveService(def, { contentHash: BUILD }).pipe(
        Effect.provideService(PresentationBus, bus),
      )
      return yield* test(save, facts, bus)
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

describe('a target that does not grant saves (DIST spec §8 flow 5)', () => {
  it('opens with every slot empty and asks the host for nothing, so the game runs on', async () => {
    const slots = await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const save = yield* saveService(run, { contentHash: BUILD }).pipe(
          Effect.provideService(PresentationBus, bus),
        )
        return yield* save.slots.get
      }).pipe(
        // A web page with storage blocked: what a page observes, and no saves.
        Effect.provide(FakeHosting({ target: 'web', granted: ['lifecycle', 'input', 'display', 'audio'] })),
        Effect.provide(TestContext.TestContext),
      ),
    )
    expect(slots).toEqual([
      { kind: 'empty', slot: 0 },
      { kind: 'empty', slot: 1 },
      { kind: 'empty', slot: 2 },
    ])
  })

  it('loads the empty value and writes nothing, failing nothing: the game plays on, and the host and the device hold nothing', async () => {
    const { held, failed } = await runScoped(
      Effect.gen(function* () {
        const bus = yield* makePresentationBus()
        const failures: unknown[] = []
        bus.subscribe('save.failed', (fact) => failures.push(fact))
        const save = yield* saveService(run, { contentHash: BUILD }).pipe(
          Effect.provideService(PresentationBus, bus),
        )
        // New game: the empty slot loads as the empty value, then the starting data is written.
        yield* save.load(0)
        yield* save.write(0, { name: 'Kite', bestTime: 1, coins: 2 })
        return { held: [...(yield* FakeHostControl).saved.keys()], failed: failures }
      }).pipe(
        Effect.provide(FakeHosting({ target: 'web', granted: ['lifecycle', 'input', 'display', 'audio'] })),
        Effect.provide(TestContext.TestContext),
      ),
    )
    expect(held).toEqual([])
    expect(failed).toEqual([])
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

describe('flushPending and serialized writes (M5 spec §4.4)', () => {
  const kite = { name: 'Kite', bestTime: 12, coins: 4 }

  /** Like `withSave`, but every `saves.set` waits for `open`, so a test can hold a write in flight. */
  function withGatedSave<A, E>(
    test: (
      save: Save<Run>,
      gate: Deferred.Deferred<void>,
    ) => Effect.Effect<A, E, Hosting | FakeHostHandle | Scope.Scope>,
  ): Promise<A> {
    return runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const gate = yield* Deferred.make<void>()
        const gated: Hosting = {
          ...hosting,
          saves: {
            ...hosting.saves,
            set: (key, value) => Deferred.await(gate).pipe(Effect.zipRight(hosting.saves.set(key, value))),
          },
        }
        const bus = yield* makePresentationBus()
        const save = yield* saveService(run, { contentHash: BUILD }).pipe(
          Effect.provideService(Hosting, gated),
          Effect.provideService(PresentationBus, bus),
        )
        return yield* test(save, gate)
      }).pipe(Effect.provide(HostingTest()), Effect.provide(TestContext.TestContext)),
    )
  }

  it('writes the touched progress of the loaded slot once, however many flushes follow', async () => {
    await withSave({}, (save, facts) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        save.touch(() => kite)
        yield* save.flushPending
        yield* save.flushPending
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toEqual([
          expect.objectContaining({ key: 'run.slot.1', value: stored({ savedAt: 0, data: kite }) }),
        ])
        expect(facts.filter(([name]) => name === 'save.written')).toHaveLength(1)
      }),
    )
  })

  it('keeps nothing from a touch made before a slot loaded', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        save.touch(() => kite)
        yield* save.load(1)
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])
      }),
    )
  })

  it('sends nothing when the same progress is touched and flushed again, later (S-b)', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        save.touch(() => kite)
        yield* save.flushPending
        yield* TestClock.adjust('1 minute')
        save.touch(() => ({ ...kite }))
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)

        save.touch(() => ({ ...kite, coins: 5 }))
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(2)
      }),
    )
  })

  it('keeps the slot label across an autosave, which does not know it', async () => {
    await withSave({ 'run.slot.0': stored({ label: 'Floor 3' }) }, (save) =>
      Effect.gen(function* () {
        yield* save.load(0)
        save.touch(() => ({ ...kite, coins: 9 }))
        yield* save.flushPending
        expect((yield* save.slots.get)[0]).toMatchObject({ kind: 'ready', meta: { label: 'Floor 3' } })
        expect((yield* save.load(0)).data.coins).toBe(9)
      }),
    )
  })

  it('collapses triggers during one slow write into one more write carrying the latest data', async () => {
    await withGatedSave((save, gate) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        save.touch(() => ({ ...kite, coins: 1 }))
        const first = yield* Effect.fork(save.flushPending)
        yield* settled // the first write is now waiting on the host
        save.touch(() => ({ ...kite, coins: 2 }))
        const more = yield* Effect.forEach([1, 2, 3], () => Effect.fork(save.flushPending))
        save.touch(() => ({ ...kite, coins: 3 }))
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])

        yield* Deferred.succeed(gate, undefined)
        yield* Fiber.join(first)
        yield* Effect.forEach(more, Fiber.join)
        yield* settled
        const written = sentByGame('saves.set').map((message) =>
          JSON.parse((message as { value: string }).value),
        )
        expect(written.map((envelope) => envelope.data.coins)).toEqual([1, 3])
      }),
    )
  })

  it('never writes a slot loaded with other content, leaves its bytes, and writes once an explicit write clears it (S-e)', async () => {
    const foreign = stored({ snapshot: 'AAAA', contentHash: 'deadbeef' })
    await withSave({ 'run.slot.0': foreign }, (save) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        expect((yield* save.slots.get)[0]).toMatchObject({ kind: 'other-content' })
        save.touch(() => ({ ...kite, coins: 7 }))
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])
        expect(yield* hosting.saves.get('run.slot.0')).toBe(foreign)

        // The player writes explicitly: the slot is theirs again, and the touched progress was kept.
        yield* save.write(0, { ...kite, coins: 6 })
        expect((yield* save.slots.get)[0]).toMatchObject({ kind: 'ready' })
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(2)
      }),
    )
  })

  it('publishes save.failed for a refused write, still succeeds, and tries again at the next flush', async () => {
    await withSave({}, (save, facts) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        save.touch(() => ({ name: 'x'.repeat(16 * 1024 * 1024), bestTime: 0, coins: 0 }))
        yield* save.flushPending
        yield* save.flushPending
        expect(facts.filter(([name]) => name === 'save.failed')).toEqual([
          ['save.failed', { key: 'run', slot: 0, code: 'QUOTA_EXCEEDED' }],
          ['save.failed', { key: 'run', slot: 0, code: 'QUOTA_EXCEEDED' }],
        ])

        save.touch(() => kite)
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)
      }),
    )
  })

  it('succeeds, writing nothing, when the progress it was handed throws', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        save.touch(() => {
          throw new Error('the sim is gone')
        })
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])
      }),
    )
  })
})

describe('the autosave triggers (M5 spec §4.4, S-d)', () => {
  const kite = { name: 'Kite', bestTime: 12, coins: 4 }
  const only = (...on: ('screen-exit' | 'round-end' | 'background' | 'interval')[]): typeof run => ({
    ...run,
    autosave: { on },
  })
  /** Hides the host page the way a player switching tabs does, and lets the SDK report it. */
  const hidePage = Effect.gen(function* () {
    const { host } = yield* FakeHostHandle
    host.frame?.hostDocument.setVisibility('hidden')
    yield* settled
  })
  const sentTypes = (host: FakeHostHandle['host']) =>
    host.messages
      .filter((entry) => entry.dir === 'in')
      .map((entry) => entry.msg.type)
      .filter((type) => ['saves.set', 'saves.flush', 'session.exitReady'].includes(type))

  it('writes on a trigger the policy lists, and does nothing for one it does not', async () => {
    await withSave(
      {},
      (save) =>
        Effect.gen(function* () {
          const { sentByGame } = yield* FakeHostHandle
          yield* save.load(0)
          save.touch(() => kite)
          yield* save.autosave('screen-exit')
          yield* settled
          expect(sentByGame('saves.set')).toEqual([])
          yield* save.autosave('round-end')
          yield* settled
          expect(sentByGame('saves.set')).toHaveLength(1)
        }),
      only('round-end'),
    )
  })

  it('writes when the player moves to another screen, and not for the first screen', async () => {
    await withSave({}, (save, _facts, bus) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        save.touch(() => kite)
        bus.publish('screen.entered', { screen: 'title', from: undefined })
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])
        bus.publish('screen.entered', { screen: 'play', from: 'title' })
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)
      }),
    )
  })

  it('writes when a round ends', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        yield* settled
        save.touch(() => kite)
        yield* hosting.round.start
        yield* hosting.round.end('complete')
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)
      }),
    )
  })

  it('writes in the background and then asks the host to flush, once (S-d)', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const { host, sentByGame } = yield* FakeHostHandle
        yield* save.load(0)
        yield* settled
        save.touch(() => kite)
        yield* hidePage
        expect(sentTypes(host)).toEqual(['saves.set', 'saves.flush'])
        expect(sentByGame('saves.flush')).toHaveLength(1)
      }),
    )
  })

  it('does neither when the policy leaves `background` out', async () => {
    await withSave(
      {},
      (save) =>
        Effect.gen(function* () {
          const { host } = yield* FakeHostHandle
          yield* save.load(0)
          yield* settled
          save.touch(() => kite)
          yield* hidePage
          expect(sentTypes(host)).toEqual([])
        }),
      only('round-end'),
    )
  })

  it('writes on a timer: nothing before intervalSeconds, one write at it, none while the progress is unchanged', async () => {
    await withSave(
      {},
      (save) =>
        Effect.gen(function* () {
          const { sentByGame } = yield* FakeHostHandle
          yield* save.load(0)
          yield* settled
          save.touch(() => kite)
          yield* TestClock.adjust('29 seconds')
          yield* settled
          expect(sentByGame('saves.set')).toEqual([])
          yield* TestClock.adjust('1 second')
          yield* settled
          expect(sentByGame('saves.set')).toHaveLength(1)

          save.touch(() => ({ ...kite }))
          yield* TestClock.adjust('30 seconds')
          yield* settled
          expect(sentByGame('saves.set')).toHaveLength(1)
          save.touch(() => ({ ...kite, coins: 5 }))
          yield* TestClock.adjust('30 seconds')
          yield* settled
          expect(sentByGame('saves.set')).toHaveLength(2)
        }),
      { ...run, autosave: { on: ['interval'], intervalSeconds: 30 } },
    )
  })

  it('writes every 60 s when the policy gives no interval', async () => {
    await withSave(
      {},
      (save) =>
        Effect.gen(function* () {
          const { sentByGame } = yield* FakeHostHandle
          yield* save.load(0)
          yield* settled
          save.touch(() => kite)
          yield* TestClock.adjust('59 seconds')
          yield* settled
          expect(sentByGame('saves.set')).toEqual([])
          yield* TestClock.adjust('1 second')
          yield* settled
          expect(sentByGame('saves.set')).toHaveLength(1)
        }),
      only('interval'),
    )
  })

  it('refuses a save whose timer cannot run, at start', async () => {
    const broken = { ...run, autosave: { on: ['interval' as const], intervalSeconds: 0 } }
    await expect(withSave({}, () => Effect.void, broken)).rejects.toThrow(/intervalSeconds/)
  })

  it('writes once more when its scope closes, then stops listening and stops the timer', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        const bus = yield* makePresentationBus()
        const inner = yield* Scope.make()
        const save = yield* saveService(only('screen-exit', 'interval'), { contentHash: BUILD }).pipe(
          Effect.provideService(PresentationBus, bus),
          Scope.extend(inner),
        )
        yield* save.load(0)
        save.touch(() => kite)
        yield* Scope.close(inner, Exit.void)
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)

        save.touch(() => ({ ...kite, coins: 6 }))
        bus.publish('screen.entered', { screen: 'play', from: 'title' })
        yield* TestClock.adjust('2 minutes')
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)
        expect(yield* hosting.saves.get('run.slot.0')).not.toBeNull()
      }).pipe(Effect.provide(HostingTest()), Effect.provide(TestContext.TestContext)),
    )
  })

  it('has its progress written, then flushed, before the host is told the game may close', async () => {
    await withSave({}, (save) =>
      Effect.gen(function* () {
        const { host } = yield* FakeHostHandle
        yield* save.load(0)
        save.touch(() => kite)
        yield* Effect.promise(() => host.bridge.exit())
        expect(sentTypes(host)).toEqual(['saves.set', 'saves.flush', 'session.exitReady'])
      }),
    )
  })
})

describe('a change on another device while a slot is loaded (M5 spec §5, M5-D6)', () => {
  const kite = { name: 'Kite', bestTime: 12, coins: 4 }
  const theirs = stored({ savedAt: 2000, label: 'Desk PC', data: { name: 'Kite', bestTime: 20, coins: 99 } })
  type Change = Stream.Stream.Success<HostingSaves['changed']>

  /**
   * Like `withSave`, but `saves.changed` is a stream the test drives with `elsewhere`, which also puts `raw` where
   * the host holds the key (null removes it) so the service's re-read finds it. The fake host pushes a change only
   * when a conflict is resolved (R-7), so the one test below that uses the real path says so.
   */
  function withRemote<A, E>(
    saves: Record<string, string>,
    test: (
      save: Save<Run>,
      facts: Facts[],
      elsewhere: (key: string, raw: string | null) => Effect.Effect<void>,
    ) => Effect.Effect<A, E, Hosting | FakeHostHandle | Scope.Scope>,
  ): Promise<A> {
    return runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const changes = yield* PubSub.unbounded<Change>()
        const remote: Hosting = {
          ...hosting,
          saves: { ...hosting.saves, changed: Stream.fromPubSub(changes) },
        }
        const elsewhere = (key: string, raw: string | null) =>
          Effect.gen(function* () {
            if (raw === null) yield* Effect.ignore(hosting.saves.remove(key))
            else yield* Effect.ignore(hosting.saves.set(key, raw))
            yield* PubSub.publish(changes, { key, value: raw, revision: 1 })
            yield* settled
          })
        const bus = yield* makePresentationBus()
        const facts: Facts[] = []
        bus.subscribe('save.loaded', (fact) => facts.push(['save.loaded', fact]))
        bus.subscribe('save.changedElsewhere', (fact) => facts.push(['save.changedElsewhere', fact]))
        const save = yield* saveService(run, { contentHash: BUILD }).pipe(
          Effect.provideService(Hosting, remote),
          Effect.provideService(PresentationBus, bus),
        )
        yield* settled
        return yield* test(save, facts, elsewhere)
      }).pipe(Effect.provide(HostingTest({ host: { saves } })), Effect.provide(TestContext.TestContext)),
    )
  }

  it('holds: the flag is up, a fact is published, the list shows the other device, the loaded data is not touched', async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, facts, elsewhere) =>
      Effect.gen(function* () {
        const loaded = yield* save.load(1)
        expect(yield* save.changedElsewhere.get).toBe(false)
        yield* elsewhere('run.slot.1', theirs)
        expect(yield* save.changedElsewhere.get).toBe(true)
        expect(facts).toEqual([
          ['save.loaded', { key: 'run', slot: 1 }],
          ['save.changedElsewhere', { key: 'run', slot: 1 }],
        ])
        expect((yield* save.slots.get)[1]).toMatchObject({
          kind: 'ready',
          meta: { savedAt: 2000, label: 'Desk PC' },
        })
        expect(yield* save.loaded.get).toBe(1)
        expect(loaded.data).toEqual(kite)
      }),
    )
  })

  it('Keep playing lowers the flag and leaves autosave on: the next write overwrites the other device', async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, _facts, elsewhere) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        yield* elsewhere('run.slot.1', theirs)
        save.keepPlaying()
        expect(yield* save.changedElsewhere.get).toBe(false)

        save.touch(() => ({ ...kite, coins: 5 }))
        yield* save.flushPending
        yield* settled
        const last = sentByGame('saves.set').at(-1) as { value: string }
        expect(JSON.parse(last.value).data.coins).toBe(5)
        expect(yield* hosting.saves.get('run.slot.1')).toBe(last.value)
      }),
    )
  })

  it("holds the progress while the choice is open: a pause or an exit writes nothing over the other device's", async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, _facts, elsewhere) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        yield* elsewhere('run.slot.1', theirs)
        save.touch(() => ({ ...kite, coins: 5 }))
        const before = sentByGame('saves.set').length // includes the `elsewhere` write above

        // The pause screen opening is the `screen-exit` trigger; closing the game is `flushPending`.
        yield* save.autosave('screen-exit')
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(before)
        expect(yield* hosting.saves.get('run.slot.1')).toBe(theirs)
        expect(yield* save.changedElsewhere.get).toBe(true)
      }),
    )
  })

  it('Keep playing releases the progress held back: the next trigger writes it', async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, _facts, elsewhere) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        yield* elsewhere('run.slot.1', theirs)
        save.touch(() => ({ ...kite, coins: 5 }))
        yield* save.autosave('screen-exit')
        yield* settled

        save.keepPlaying()
        yield* save.autosave('screen-exit')
        yield* settled
        const last = sentByGame('saves.set').at(-1) as { value: string }
        expect(JSON.parse(last.value).data.coins).toBe(5)
        expect(yield* hosting.saves.get('run.slot.1')).toBe(last.value)
      }),
    )
  })

  it('loading another slot drops the progress held back for the slot that changed', async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, _facts, elsewhere) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        save.touch(() => ({ ...kite, coins: 5 }))
        yield* elsewhere('run.slot.1', theirs)
        const before = sentByGame('saves.set').length

        // Continue on another slot starts another game: the old one's progress is not this one's to write.
        yield* save.load(0)
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(before)
        expect(yield* hosting.saves.get('run.slot.1')).toBe(theirs)
      }),
    )
  })

  it("Load newer returns the other device's data, lowers the flag and sends nothing", async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, facts, elsewhere) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        yield* elsewhere('run.slot.1', theirs)
        const before = sentByGame('saves.set').length
        const loaded = yield* save.loadNewer()
        expect(loaded).toMatchObject({
          slot: 1,
          data: { bestTime: 20, coins: 99 },
          meta: { label: 'Desk PC' },
        })
        expect(yield* save.changedElsewhere.get).toBe(false)
        expect(facts.filter(([name]) => name === 'save.loaded')).toHaveLength(2)
        expect(sentByGame('saves.set')).toHaveLength(before)
      }),
    )
  })

  it("Load newer drops the progress the old game had touched, so no flush writes it over the other device's", async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, _facts, elsewhere) =>
      Effect.gen(function* () {
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        save.touch(() => kite)
        yield* elsewhere('run.slot.1', theirs)
        const before = sentByGame('saves.set').length
        yield* save.loadNewer()
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(before)
      }),
    )
  })

  it('only refreshes the list for a slot that is not the one being played, or for a key that is not a slot', async () => {
    await withRemote({ 'run.slot.0': stored() }, (save, facts, elsewhere) =>
      Effect.gen(function* () {
        yield* save.load(0)
        yield* elsewhere('run.slot.2', theirs)
        yield* elsewhere('other', theirs)
        expect((yield* save.slots.get)[2]).toMatchObject({ kind: 'ready', meta: { label: 'Desk PC' } })
        expect(yield* save.changedElsewhere.get).toBe(false)
        expect(facts.filter(([name]) => name === 'save.changedElsewhere')).toEqual([])
      }),
    )
  })

  it("does not take the echo of the game's own write for another device", async () => {
    await withRemote({}, (save, facts, elsewhere) =>
      Effect.gen(function* () {
        yield* save.load(0)
        save.touch(() => kite)
        yield* save.flushPending
        const hosting = yield* Hosting
        yield* elsewhere('run.slot.0', yield* hosting.saves.get('run.slot.0'))
        expect(yield* save.changedElsewhere.get).toBe(false)
        expect(facts.filter(([name]) => name === 'save.changedElsewhere')).toEqual([])
      }),
    )
  })

  it('takes a removal on another device as a change: the slot is empty and Load newer loads it empty', async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, _facts, elsewhere) =>
      Effect.gen(function* () {
        yield* save.load(1)
        yield* elsewhere('run.slot.1', null)
        expect(yield* save.changedElsewhere.get).toBe(true)
        expect((yield* save.slots.get)[1]).toEqual({ kind: 'empty', slot: 1 })
        expect(yield* save.loadNewer()).toEqual({
          slot: 1,
          data: { name: '', bestTime: 0, coins: 0 },
          meta: undefined,
        })
      }),
    )
  })

  it('leaves a save from a newer build or a damaged one as it is, whatever autosave has kept (S-e)', async () => {
    await withRemote({ 'run.slot.1': stored() }, (save, _facts, elsewhere) =>
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* save.load(1)
        save.touch(() => ({ ...kite, coins: 8 }))

        const newer = stored({ version: 4 })
        yield* elsewhere('run.slot.1', newer)
        expect((yield* save.slots.get)[1]).toMatchObject({ kind: 'newer', version: 4 })
        const before = sentByGame('saves.set').length // includes the `elsewhere` write above
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(before)
        expect(yield* hosting.saves.get('run.slot.1')).toBe(newer)
        expect(yield* Effect.flip(save.loadNewer())).toMatchObject({ _tag: 'SaveFromNewerBuild', version: 4 })

        yield* elsewhere('run.slot.1', 'not json')
        expect((yield* save.slots.get)[1]).toMatchObject({ kind: 'unreadable' })
        // `elsewhere` puts the other device's value in the fake host with one `saves.set` of its own.
        const beforeDamaged = sentByGame('saves.set').length
        yield* save.flushPending
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(beforeDamaged)
        expect(yield* hosting.saves.get('run.slot.1')).toBe('not json')
      }),
    )
  })

  it("arrives from the host's own conflict answer, 'theirs' (the fake host's only way to push, R-7)", async () => {
    const clock = manualClock()
    await runScoped(
      Effect.gen(function* () {
        const { host } = yield* FakeHostHandle
        const bus = yield* makePresentationBus()
        const save = yield* saveService(run, { contentHash: BUILD }).pipe(
          Effect.provideService(PresentationBus, bus),
        )
        yield* save.load(0)
        host.fakes.server.remoteWrite('run.slot.0', theirs, 'Desk PC')
        save.touch(() => ({ ...kite, coins: 5 }))
        yield* save.flushPending
        yield* settled
        clock.advance(60_000)
        yield* settled
        yield* Effect.promise(() => host.bridge.resolveConflict('run.slot.0', 'theirs'))
        yield* settled
        expect(yield* save.changedElsewhere.get).toBe(true)
        expect((yield* save.slots.get)[0]).toMatchObject({ kind: 'ready', meta: { label: 'Desk PC' } })
      }).pipe(
        Effect.provide(HostingTest({ host: { clock, saves: { 'run.slot.0': stored() } } })),
        Effect.provide(TestContext.TestContext),
      ),
    )
  })
})
