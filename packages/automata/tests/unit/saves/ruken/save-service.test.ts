import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { type OpenSave, type SaveServiceOptions, saveService } from '#src/features/saves/save.manager.ts'
import { defineSave, encodeEnvelope, type SaveEnvelope } from '#src/features/saves/save.schema.ts'
import type { SavesChangedPayload } from '#src/shared/host/index.ts'
import type { Hosting } from '#src/shared/host/plain-hosting.ts'
import type { Result } from '#src/shared/lib/result.ts'
import { emitter } from '#src/shared/lib/subscribable.ts'
import {
  createPresentationBus,
  type PresentationBus,
  type RuntimeFacts,
} from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { type FakeClock, fakeClock } from '#src/testing/fake-clock.ts'
import { fakeHosting } from '../../../../src/testing/host/fake-hosting.ts'
import { manualClock } from '../../../../src/testing/host/page/clocks.ts'
import {
  type FakeHostHandle,
  type HostingTestOptions,
  withHostingTest,
} from '../../../../src/testing/host/page/ruken/hosting-test.ts'

// The `Save` service over `Hosting.saves` (M5 spec §4.3, §5 "Load a slot", §6), under the fake Ruken host. A
// `fakeClock` runs the interval timer and stamps `savedAt`, starting at 0.

const BUILD = 'c0ffee'

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

/** The value of an answer that must not be a refusal. */
async function must<A>(answer: Promise<Result<A, unknown>>): Promise<A> {
  const result = await answer
  if (!result.ok) throw new Error(`expected an answer, got a refusal: ${String(result.reason)}`)
  return result.value
}

/** The refusal of an answer that must be one. */
async function failureOf<R>(answer: Promise<Result<unknown, R>>): Promise<R> {
  const result = await answer
  if (result.ok) throw new Error('expected a refusal, got an answer')
  return result.reason
}

/** Opens the service; a refused start throws, so a test fails loudly. */
async function open(def: typeof run, options: SaveServiceOptions): Promise<OpenSave<Run>> {
  return must(saveService(def, options))
}

/** What a test gets: the open save, its facts in order, the bus, the host and the clock. */
interface SaveTest {
  readonly save: OpenSave<Run>
  readonly facts: Facts[]
  readonly bus: PresentationBus
  readonly hosting: Hosting
  readonly handle: FakeHostHandle
  readonly clock: FakeClock
}

function collect(bus: PresentationBus): Facts[] {
  const facts: Facts[] = []
  bus.subscribe('save.written', (fact) => facts.push(['save.written', fact]))
  bus.subscribe('save.failed', (fact) => facts.push(['save.failed', fact]))
  bus.subscribe('save.loaded', (fact) => facts.push(['save.loaded', fact]))
  bus.subscribe('save.changedElsewhere', (fact) => facts.push(['save.changedElsewhere', fact]))
  return facts
}

/**
 * Runs `test` with a `Save` over the fake Ruken host seeded with `saves` (or over `hosting`, a change of the real
 * one), collecting the save facts in order. The save is disposed, then the host.
 */
function withSave<A>(
  saves: Record<string, string>,
  test: (t: SaveTest) => Promise<A> | A,
  def: typeof run = run,
  setup: { readonly host?: HostingTestOptions['host']; readonly hosting?: (real: Hosting) => Hosting } = {},
): Promise<A> {
  return withHostingTest(
    async ({ hosting: real, handle }) => {
      const hosting = setup.hosting?.(real) ?? real
      const bus = createPresentationBus()
      const facts = collect(bus)
      const clock = fakeClock()
      const save = await open(def, { contentHash: BUILD, hosting, bus, clock, now: clock.now })
      try {
        return await test({ save, facts, bus, hosting: real, handle, clock })
      } finally {
        await save.dispose()
        bus.dispose()
      }
    },
    { host: { saves, ...setup.host } },
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
      async ({ save }) => {
        expect(save.slots.get()).toEqual([
          {
            kind: 'ready',
            slot: 0,
            meta: { version: 3, contentHash: BUILD, savedAt: 1000, label: 'Floor 3', snapshot: false },
          },
          { kind: 'empty', slot: 1 },
          { kind: 'newer', slot: 2, version: 4 },
        ])
      },
    )
  })
})

describe('a target that does not grant saves (DIST spec §8 flow 5)', () => {
  /** A web page with storage blocked: what a page observes, and no saves. */
  const blocked = () => {
    const host = fakeHosting({ target: 'web', granted: ['lifecycle', 'input', 'display', 'audio'] })
    const hosting = host.create({ gameId: 'blank-game', wants: ['saves'], pauseBehavior: 'pause' })
    return { control: host.control, hosting }
  }

  it('opens with every slot empty and asks the host for nothing, so the game runs on', async () => {
    const { hosting } = blocked()
    const bus = createPresentationBus()
    const save = await open(run, { contentHash: BUILD, hosting, bus })
    expect(save.slots.get()).toEqual([
      { kind: 'empty', slot: 0 },
      { kind: 'empty', slot: 1 },
      { kind: 'empty', slot: 2 },
    ])
    await save.dispose()
    hosting.dispose()
  })

  it('loads the empty value and writes nothing, failing nothing: the game plays on, and the host and the device hold nothing', async () => {
    const { control, hosting } = blocked()
    const bus = createPresentationBus()
    const failed: unknown[] = []
    bus.subscribe('save.failed', (fact) => failed.push(fact))
    const save = await open(run, { contentHash: BUILD, hosting, bus })
    // New game: the empty slot loads as the empty value, then the starting data is written.
    await must(save.load(0))
    await must(save.write(0, { name: 'Kite', bestTime: 1, coins: 2 }))
    await save.dispose()
    hosting.dispose()
    expect([...control.saved.keys()]).toEqual([])
    expect(failed).toEqual([])
  })
})

describe('write and load', () => {
  it('writes a canonical envelope stamped by the Clock, and loads it back', async () => {
    await withSave({}, async ({ save, facts, handle, clock }) => {
      const { sentByGame } = handle
      clock.advance(5000)
      await must(save.write(1, { name: 'Wren', bestTime: 9, coins: 2 }, { label: 'Floor 2' }))
      await settle()
      expect(sentByGame('saves.set')).toEqual([
        expect.objectContaining({
          key: 'run.slot.1',
          value: stored({ savedAt: 5000, label: 'Floor 2', data: { name: 'Wren', bestTime: 9, coins: 2 } }),
        }),
      ])
      expect(save.slots.get()[1]).toMatchObject({
        kind: 'ready',
        meta: { savedAt: 5000, label: 'Floor 2' },
      })

      const loaded = await must(save.load(1))
      expect(loaded).toEqual({
        slot: 1,
        data: { name: 'Wren', bestTime: 9, coins: 2 },
        meta: { version: 3, contentHash: BUILD, savedAt: 5000, label: 'Floor 2', snapshot: false },
      })
      expect(facts).toEqual([
        ['save.written', { key: 'run', slot: 1 }],
        ['save.loaded', { key: 'run', slot: 1 }],
      ])
    })
  })

  it('loads an empty slot as the empty value, writing nothing', async () => {
    await withSave({}, async ({ save, handle }) => {
      const { sentByGame } = handle
      expect(await must(save.load(0))).toEqual({
        slot: 0,
        data: { name: '', bestTime: 0, coins: 0 },
        meta: undefined,
      })
      await settle()
      expect(sentByGame('saves.set')).toEqual([])
    })
  })

  it('sends one saves.set for the same state written twice, even later (S-b)', async () => {
    await withSave({}, async ({ save, facts, handle, clock }) => {
      const { sentByGame } = handle
      const state = { name: 'Wren', bestTime: 9, coins: 2 }
      await must(save.write(0, state))
      clock.advance(60000)
      await must(save.write(0, { ...state }))
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(1)
      expect(facts).toHaveLength(1)

      await must(save.write(0, { ...state, coins: 3 }))
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(2)
    })
  })

  it('migrates an older save on load (S-a), and the next write stores the new version', async () => {
    await withSave(
      { 'run.slot.0': stored({ version: 1, data: { name: 'Kite', best: 12 } }) },
      async ({ save }) => {
        const loaded = await must(save.load(0))
        expect(loaded.data).toEqual({ name: 'Kite', bestTime: 12, coins: 0 })
        await must(save.write(0, loaded.data))
        expect(save.slots.get()[0]).toMatchObject({ kind: 'ready', meta: { version: 3 } })
      },
    )
  })
})

describe('a save from a newer build (S-e)', () => {
  it('is read-only: load fails, write is refused, and nothing reaches the host', async () => {
    const newer = stored({ version: 4 })
    await withSave({ 'run.slot.0': newer }, async ({ save, hosting, handle }) => {
      const { sentByGame } = handle
      expect(await failureOf(save.load(0))).toMatchObject({
        _tag: 'SaveFromNewerBuild',
        slot: 0,
        version: 4,
      })
      expect(await failureOf(save.write(0, run.empty()))).toMatchObject({
        _tag: 'SaveRefused',
        slot: 0,
        reason: 'newer',
      })
      await settle()
      expect(sentByGame('saves.set')).toEqual([])
      expect(await must(hosting.saves.get('run.slot.0'))).toBe(newer)
    })
  })
})

describe('an unreadable save (S-f)', () => {
  it('fails to load, is marked unreadable and kept; only an explicit write replaces it', async () => {
    // A version-2 save on a build whose step 2 is missing.
    const gap = defineSave<Run>({ ...run, migrations: { 1: run.migrations[1]! } })
    const kept = stored({ version: 2, data: { name: 'Kite', bestTime: 12 } })
    await withSave(
      { 'run.slot.0': kept },
      async ({ save, hosting }) => {
        expect(await failureOf(save.load(0))).toMatchObject({
          _tag: 'SaveUnreadable',
          slot: 0,
          reason: 'no migration from version 2',
        })
        expect(save.slots.get()[0]).toEqual({
          kind: 'unreadable',
          slot: 0,
          reason: 'no migration from version 2',
        })
        expect(await must(hosting.saves.get('run.slot.0'))).toBe(kept)

        await must(save.write(0, gap.empty()))
        expect(save.slots.get()[0]).toMatchObject({ kind: 'ready' })
      },
      gap,
    )
  })
})

describe('snapshots (M5-D5)', () => {
  it('returns the snapshot taken with this content, and drops one taken with other content', async () => {
    await withSave({}, async ({ save }) => {
      await must(save.write(0, run.empty(), { snapshot: new Uint8Array([0, 1, 254, 255]) }))
      expect((await must(save.load(0))).snapshot).toEqual(new Uint8Array([0, 1, 254, 255]))
    })
    await withSave(
      { 'run.slot.0': stored({ contentHash: 'beef', snapshot: 'AAH+/w==' }) },
      async ({ save }) => {
        expect(save.slots.get()[0]).toMatchObject({ kind: 'other-content' })
        const loaded = await must(save.load(0))
        expect(loaded.data).toEqual({ name: 'Kite', bestTime: 12, coins: 4 })
        expect(loaded.snapshot).toBeUndefined()
      },
    )
  })
})

describe('remove', () => {
  it('empties the slot on the host and in the list', async () => {
    await withSave({ 'run.slot.1': stored() }, async ({ save, hosting }) => {
      await must(save.remove(1))
      expect(await must(hosting.saves.get('run.slot.1'))).toBeNull()
      expect(save.slots.get()[1]).toEqual({ kind: 'empty', slot: 1 })
    })
  })
})

describe('a refused write', () => {
  it('publishes save.failed with the host code, relays the error and leaves the slot as it was', async () => {
    await withSave({}, async ({ save, facts }) => {
      // Larger than any per-value limit Ruken could set; AF quotes no number (R-5). The SDK refuses it first.
      const tooBig = 'x'.repeat(16 * 1024 * 1024)
      const failed = await failureOf(save.write(0, { name: tooBig, bestTime: 0, coins: 0 }))
      expect(failed).toMatchObject({ code: 'QUOTA_EXCEEDED', operation: 'saves.set' })
      expect(facts).toEqual([['save.failed', { key: 'run', slot: 0, code: 'QUOTA_EXCEEDED' }]])
      expect(save.slots.get()[0]).toEqual({ kind: 'empty', slot: 0 })
    })
  })
})

describe('the loaded slot and touch (M5 spec §4.3, §4.4)', () => {
  it('is no slot until one loads, then the slot the last successful load returned', async () => {
    await withSave({ 'run.slot.0': stored(), 'run.slot.2': stored({ version: 4 }) }, async ({ save }) => {
      expect(save.loaded.get()).toBeUndefined()
      await must(save.load(1))
      expect(save.loaded.get()).toBe(1)
      await must(save.load(0))
      expect(save.loaded.get()).toBe(0)
      // A load that fails leaves the slot being played as it was.
      expect((await save.load(2)).ok).toBe(false)
      expect(save.loaded.get()).toBe(0)
    })
  })

  it('tells a subscriber each time the loaded slot changes', async () => {
    await withSave({}, async ({ save }) => {
      const seen: (number | undefined)[] = []
      const stop = save.loaded.subscribe((slot) => seen.push(slot))
      await must(save.load(2))
      await must(save.load(1))
      await settle()
      stop()
      expect(seen).toEqual([undefined, 2, 1])
    })
  })

  it('takes a touch before any load as nothing: it does not throw, and keeps nothing', async () => {
    await withSave({}, ({ save }) => {
      expect(() => save.touch(() => ({ name: 'Early', bestTime: 1, coins: 1 }))).not.toThrow()
    })
  })
})

describe('flushPending and serialized writes (M5 spec §4.4)', () => {
  const kite = { name: 'Kite', bestTime: 12, coins: 4 }

  /** Like `withSave`, but every `saves.set` waits for `gate.open()`, so a test can hold a write in flight. */
  function withGatedSave<A>(
    test: (t: SaveTest & { readonly gate: { open(): void } }) => Promise<A>,
  ): Promise<A> {
    let open: () => void = () => undefined
    const opened = new Promise<void>((resolve) => (open = resolve))
    return withSave({}, (t) => test({ ...t, gate: { open } }), run, {
      hosting: (real) => ({
        ...real,
        saves: { ...real.saves, set: (key, value) => opened.then(() => real.saves.set(key, value)) },
      }),
    })
  }

  it('writes the touched progress of the loaded slot once, however many flushes follow', async () => {
    await withSave({}, async ({ save, facts, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      save.touch(() => kite)
      await save.flushPending()
      await save.flushPending()
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toEqual([
        expect.objectContaining({ key: 'run.slot.1', value: stored({ savedAt: 0, data: kite }) }),
      ])
      expect(facts.filter(([name]) => name === 'save.written')).toHaveLength(1)
    })
  })

  it('keeps nothing from a touch made before a slot loaded', async () => {
    await withSave({}, async ({ save, handle }) => {
      const { sentByGame } = handle
      save.touch(() => kite)
      await must(save.load(1))
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toEqual([])
    })
  })

  it('sends nothing when the same progress is touched and flushed again, later (S-b)', async () => {
    await withSave({}, async ({ save, handle, clock }) => {
      const { sentByGame } = handle
      await must(save.load(0))
      save.touch(() => kite)
      await save.flushPending()
      clock.advance(60000)
      save.touch(() => ({ ...kite }))
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(1)

      save.touch(() => ({ ...kite, coins: 5 }))
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(2)
    })
  })

  it('keeps the slot label across an autosave, which does not know it', async () => {
    await withSave({ 'run.slot.0': stored({ label: 'Floor 3' }) }, async ({ save }) => {
      await must(save.load(0))
      save.touch(() => ({ ...kite, coins: 9 }))
      await save.flushPending()
      expect(save.slots.get()[0]).toMatchObject({ kind: 'ready', meta: { label: 'Floor 3' } })
      expect((await must(save.load(0))).data.coins).toBe(9)
    })
  })

  it('collapses triggers during one slow write into one more write carrying the latest data', async () => {
    await withGatedSave(async ({ save, gate, handle }) => {
      const { sentByGame } = handle
      await must(save.load(0))
      save.touch(() => ({ ...kite, coins: 1 }))
      const first = save.flushPending()
      await settle() // the first write is now waiting on the host
      save.touch(() => ({ ...kite, coins: 2 }))
      const more = [1, 2, 3].map(() => save.flushPending())
      save.touch(() => ({ ...kite, coins: 3 }))
      await settle()
      expect(sentByGame('saves.set')).toEqual([])

      gate.open()
      await first
      await Promise.all(more)
      await settle()
      const written = sentByGame('saves.set').map((message) =>
        JSON.parse((message as { value: string }).value),
      )
      expect(written.map((envelope) => envelope.data.coins)).toEqual([1, 3])
    })
  })

  it('never writes a slot loaded with other content, leaves its bytes, and writes once an explicit write clears it (S-e)', async () => {
    const foreign = stored({ snapshot: 'AAAA', contentHash: 'deadbeef' })
    await withSave({ 'run.slot.0': foreign }, async ({ save, hosting, handle }) => {
      const { sentByGame } = handle
      await must(save.load(0))
      expect(save.slots.get()[0]).toMatchObject({ kind: 'other-content' })
      save.touch(() => ({ ...kite, coins: 7 }))
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toEqual([])
      expect(await must(hosting.saves.get('run.slot.0'))).toBe(foreign)

      // The player writes explicitly: the slot is theirs again, and the touched progress was kept.
      await must(save.write(0, { ...kite, coins: 6 }))
      expect(save.slots.get()[0]).toMatchObject({ kind: 'ready' })
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(2)
    })
  })

  it('publishes save.failed for a refused write, still succeeds, and tries again at the next flush', async () => {
    await withSave({}, async ({ save, facts, handle }) => {
      const { sentByGame } = handle
      await must(save.load(0))
      save.touch(() => ({ name: 'x'.repeat(16 * 1024 * 1024), bestTime: 0, coins: 0 }))
      await save.flushPending()
      await save.flushPending()
      expect(facts.filter(([name]) => name === 'save.failed')).toEqual([
        ['save.failed', { key: 'run', slot: 0, code: 'QUOTA_EXCEEDED' }],
        ['save.failed', { key: 'run', slot: 0, code: 'QUOTA_EXCEEDED' }],
      ])

      save.touch(() => kite)
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(1)
    })
  })

  it('succeeds, writing nothing, when the progress it was handed throws', async () => {
    await withSave({}, async ({ save, handle }) => {
      const { sentByGame } = handle
      await must(save.load(0))
      save.touch(() => {
        throw new Error('the sim is gone')
      })
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toEqual([])
    })
  })
})

describe('the autosave triggers (M5 spec §4.4, S-d)', () => {
  const kite = { name: 'Kite', bestTime: 12, coins: 4 }
  const only = (...on: ('screen-exit' | 'round-end' | 'background' | 'interval')[]): typeof run => ({
    ...run,
    autosave: { on },
  })
  /** Hides the host page the way a player switching tabs does, and lets the SDK report it. */
  const hidePage = async ({ host }: FakeHostHandle) => {
    host.frame?.hostDocument.setVisibility('hidden')
    await settle()
  }
  const sentTypes = (host: FakeHostHandle['host']) =>
    host.messages
      .filter((entry) => entry.dir === 'in')
      .map((entry) => entry.msg.type)
      .filter((type) => ['saves.set', 'saves.flush', 'session.exitReady'].includes(type))

  it('writes on a trigger the policy lists, and does nothing for one it does not', async () => {
    await withSave(
      {},
      async ({ save, handle }) => {
        const { sentByGame } = handle
        await must(save.load(0))
        save.touch(() => kite)
        await save.autosave('screen-exit')
        await settle()
        expect(sentByGame('saves.set')).toEqual([])
        await save.autosave('round-end')
        await settle()
        expect(sentByGame('saves.set')).toHaveLength(1)
      },
      only('round-end'),
    )
  })

  it('writes when the player moves to another screen, and not for the first screen', async () => {
    await withSave({}, async ({ save, bus, handle }) => {
      const { sentByGame } = handle
      await must(save.load(0))
      save.touch(() => kite)
      bus.publish('screen.entered', { screen: 'title', from: undefined })
      await settle()
      expect(sentByGame('saves.set')).toEqual([])
      bus.publish('screen.entered', { screen: 'play', from: 'title' })
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(1)
    })
  })

  it('writes when a round ends', async () => {
    await withSave({}, async ({ save, hosting, handle }) => {
      const { sentByGame } = handle
      await must(save.load(0))
      await settle()
      save.touch(() => kite)
      hosting.round.start()
      hosting.round.end('complete')
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(1)
    })
  })

  it('writes in the background and then asks the host to flush, once (S-d)', async () => {
    await withSave({}, async ({ save, handle }) => {
      const { host, sentByGame } = handle
      await must(save.load(0))
      await settle()
      save.touch(() => kite)
      await hidePage(handle)
      expect(sentTypes(host)).toEqual(['saves.set', 'saves.flush'])
      expect(sentByGame('saves.flush')).toHaveLength(1)
    })
  })

  it('does neither when the policy leaves `background` out', async () => {
    await withSave(
      {},
      async ({ save, handle }) => {
        const { host } = handle
        await must(save.load(0))
        await settle()
        save.touch(() => kite)
        await hidePage(handle)
        expect(sentTypes(host)).toEqual([])
      },
      only('round-end'),
    )
  })

  it('writes on a timer: nothing before intervalSeconds, one write at it, none while the progress is unchanged', async () => {
    await withSave(
      {},
      async ({ save, handle, clock }) => {
        const { sentByGame } = handle
        await must(save.load(0))
        await settle()
        save.touch(() => kite)
        clock.advance(29000)
        await settle()
        expect(sentByGame('saves.set')).toEqual([])
        clock.advance(1000)
        await settle()
        expect(sentByGame('saves.set')).toHaveLength(1)

        save.touch(() => ({ ...kite }))
        clock.advance(30000)
        await settle()
        expect(sentByGame('saves.set')).toHaveLength(1)
        save.touch(() => ({ ...kite, coins: 5 }))
        clock.advance(30000)
        await settle()
        expect(sentByGame('saves.set')).toHaveLength(2)
      },
      { ...run, autosave: { on: ['interval'], intervalSeconds: 30 } },
    )
  })

  it('writes every 60 s when the policy gives no interval', async () => {
    await withSave(
      {},
      async ({ save, handle, clock }) => {
        const { sentByGame } = handle
        await must(save.load(0))
        await settle()
        save.touch(() => kite)
        clock.advance(59000)
        await settle()
        expect(sentByGame('saves.set')).toEqual([])
        clock.advance(1000)
        await settle()
        expect(sentByGame('saves.set')).toHaveLength(1)
      },
      only('interval'),
    )
  })

  it('refuses a save whose timer cannot run, at start', async () => {
    const broken = { ...run, autosave: { on: ['interval' as const], intervalSeconds: 0 } }
    await expect(withSave({}, () => undefined, broken)).rejects.toThrow(/intervalSeconds/)
  })

  it('writes once more when it is disposed, then stops listening and stops the timer', async () => {
    await withSave(
      {},
      async ({ save, bus, hosting, handle, clock }) => {
        const { sentByGame } = handle
        await must(save.load(0))
        save.touch(() => kite)
        await save.dispose()
        await settle()
        expect(sentByGame('saves.set')).toHaveLength(1)

        save.touch(() => ({ ...kite, coins: 6 }))
        bus.publish('screen.entered', { screen: 'play', from: 'title' })
        clock.advance(120_000)
        await settle()
        expect(sentByGame('saves.set')).toHaveLength(1)
        expect(await must(hosting.saves.get('run.slot.0'))).not.toBeNull()
      },
      only('screen-exit', 'interval'),
    )
  })

  it('has its progress written, then flushed, before the host is told the game may close', async () => {
    await withSave({}, async ({ save, hosting, handle }) => {
      const { host } = handle
      await must(save.load(0))
      save.touch(() => kite)
      await host.bridge.exit()
      expect(sentTypes(host)).toEqual(['saves.set', 'saves.flush', 'session.exitReady'])
    })
  })
})

describe('a change on another device while a slot is loaded (M5 spec §5, M5-D6)', () => {
  const kite = { name: 'Kite', bestTime: 12, coins: 4 }
  const theirs = stored({ savedAt: 2000, label: 'Desk PC', data: { name: 'Kite', bestTime: 20, coins: 99 } })

  /**
   * Like `withSave`, but `saves.changed` is an emitter the test drives with `elsewhere`, which also puts `raw` where
   * the host holds the key (null removes it) so the service's re-read finds it. The fake host pushes a change only
   * when a conflict is resolved (R-7), so the one test below that uses the real path says so.
   */
  function withRemote<A>(
    saves: Record<string, string>,
    test: (t: SaveTest & { elsewhere(key: string, raw: string | null): Promise<void> }) => Promise<A>,
  ): Promise<A> {
    const changes = emitter<SavesChangedPayload>()
    return withSave(
      saves,
      async (t) => {
        const elsewhere = async (key: string, raw: string | null) => {
          await (raw === null ? t.hosting.saves.remove(key) : t.hosting.saves.set(key, raw))
          changes.emit({ key, value: raw, revision: 1 })
          await settle()
        }
        await settle()
        return test({ ...t, elsewhere })
      },
      run,
      { hosting: (real) => ({ ...real, saves: { ...real.saves, changed: changes.events } }) },
    )
  }

  it('holds: the flag is up, a fact is published, the list shows the other device, the loaded data is not touched', async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, facts, elsewhere }) => {
      const loaded = await must(save.load(1))
      expect(save.changedElsewhere.get()).toBe(false)
      await elsewhere('run.slot.1', theirs)
      expect(save.changedElsewhere.get()).toBe(true)
      expect(facts).toEqual([
        ['save.loaded', { key: 'run', slot: 1 }],
        ['save.changedElsewhere', { key: 'run', slot: 1 }],
      ])
      expect(save.slots.get()[1]).toMatchObject({
        kind: 'ready',
        meta: { savedAt: 2000, label: 'Desk PC' },
      })
      expect(save.loaded.get()).toBe(1)
      expect(loaded.data).toEqual(kite)
    })
  })

  it('Keep playing lowers the flag and leaves autosave on: the next write overwrites the other device', async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, elsewhere, hosting, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      await elsewhere('run.slot.1', theirs)
      save.keepPlaying()
      expect(save.changedElsewhere.get()).toBe(false)

      save.touch(() => ({ ...kite, coins: 5 }))
      await save.flushPending()
      await settle()
      const last = sentByGame('saves.set').at(-1) as { value: string }
      expect(JSON.parse(last.value).data.coins).toBe(5)
      expect(await must(hosting.saves.get('run.slot.1'))).toBe(last.value)
    })
  })

  it("holds the progress while the choice is open: a pause or an exit writes nothing over the other device's", async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, elsewhere, hosting, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      await elsewhere('run.slot.1', theirs)
      save.touch(() => ({ ...kite, coins: 5 }))
      const before = sentByGame('saves.set').length // includes the `elsewhere` write above

      // The pause screen opening is the `screen-exit` trigger; closing the game is `flushPending`.
      await save.autosave('screen-exit')
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(before)
      expect(await must(hosting.saves.get('run.slot.1'))).toBe(theirs)
      expect(save.changedElsewhere.get()).toBe(true)
    })
  })

  it('Keep playing releases the progress held back: the next trigger writes it', async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, elsewhere, hosting, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      await elsewhere('run.slot.1', theirs)
      save.touch(() => ({ ...kite, coins: 5 }))
      await save.autosave('screen-exit')
      await settle()

      save.keepPlaying()
      await save.autosave('screen-exit')
      await settle()
      const last = sentByGame('saves.set').at(-1) as { value: string }
      expect(JSON.parse(last.value).data.coins).toBe(5)
      expect(await must(hosting.saves.get('run.slot.1'))).toBe(last.value)
    })
  })

  it('loading another slot drops the progress held back for the slot that changed', async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, elsewhere, hosting, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      save.touch(() => ({ ...kite, coins: 5 }))
      await elsewhere('run.slot.1', theirs)
      const before = sentByGame('saves.set').length

      // Continue on another slot starts another game: the old one's progress is not this one's to write.
      await must(save.load(0))
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(before)
      expect(await must(hosting.saves.get('run.slot.1'))).toBe(theirs)
    })
  })

  it("Load newer returns the other device's data, lowers the flag and sends nothing", async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, facts, elsewhere, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      await elsewhere('run.slot.1', theirs)
      const before = sentByGame('saves.set').length
      const loaded = await must(save.loadNewer())
      expect(loaded).toMatchObject({
        slot: 1,
        data: { bestTime: 20, coins: 99 },
        meta: { label: 'Desk PC' },
      })
      expect(save.changedElsewhere.get()).toBe(false)
      expect(facts.filter(([name]) => name === 'save.loaded')).toHaveLength(2)
      expect(sentByGame('saves.set')).toHaveLength(before)
    })
  })

  it("Load newer drops the progress the old game had touched, so no flush writes it over the other device's", async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, elsewhere, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      save.touch(() => kite)
      await elsewhere('run.slot.1', theirs)
      const before = sentByGame('saves.set').length
      await must(save.loadNewer())
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(before)
    })
  })

  it('only refreshes the list for a slot that is not the one being played, or for a key that is not a slot', async () => {
    await withRemote({ 'run.slot.0': stored() }, async ({ save, facts, elsewhere }) => {
      await must(save.load(0))
      await elsewhere('run.slot.2', theirs)
      await elsewhere('other', theirs)
      expect(save.slots.get()[2]).toMatchObject({ kind: 'ready', meta: { label: 'Desk PC' } })
      expect(save.changedElsewhere.get()).toBe(false)
      expect(facts.filter(([name]) => name === 'save.changedElsewhere')).toEqual([])
    })
  })

  it("does not take the echo of the game's own write for another device", async () => {
    await withRemote({}, async ({ save, facts, elsewhere, hosting }) => {
      await must(save.load(0))
      save.touch(() => kite)
      await save.flushPending()
      await elsewhere('run.slot.0', await must(hosting.saves.get('run.slot.0')))
      expect(save.changedElsewhere.get()).toBe(false)
      expect(facts.filter(([name]) => name === 'save.changedElsewhere')).toEqual([])
    })
  })

  it('takes a removal on another device as a change: the slot is empty and Load newer loads it empty', async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, elsewhere }) => {
      await must(save.load(1))
      await elsewhere('run.slot.1', null)
      expect(save.changedElsewhere.get()).toBe(true)
      expect(save.slots.get()[1]).toEqual({ kind: 'empty', slot: 1 })
      expect(await must(save.loadNewer())).toEqual({
        slot: 1,
        data: { name: '', bestTime: 0, coins: 0 },
        meta: undefined,
      })
    })
  })

  it('leaves a save from a newer build or a damaged one as it is, whatever autosave has kept (S-e)', async () => {
    await withRemote({ 'run.slot.1': stored() }, async ({ save, elsewhere, hosting, handle }) => {
      const { sentByGame } = handle
      await must(save.load(1))
      save.touch(() => ({ ...kite, coins: 8 }))

      const newer = stored({ version: 4 })
      await elsewhere('run.slot.1', newer)
      expect(save.slots.get()[1]).toMatchObject({ kind: 'newer', version: 4 })
      const before = sentByGame('saves.set').length // includes the `elsewhere` write above
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(before)
      expect(await must(hosting.saves.get('run.slot.1'))).toBe(newer)
      expect(await failureOf(save.loadNewer())).toMatchObject({ _tag: 'SaveFromNewerBuild', version: 4 })

      await elsewhere('run.slot.1', 'not json')
      expect(save.slots.get()[1]).toMatchObject({ kind: 'unreadable' })
      // `elsewhere` puts the other device's value in the fake host with one `saves.set` of its own.
      const beforeDamaged = sentByGame('saves.set').length
      await save.flushPending()
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(beforeDamaged)
      expect(await must(hosting.saves.get('run.slot.1'))).toBe('not json')
    })
  })

  it("arrives from the host's own conflict answer, 'theirs' (the fake host's only way to push, R-7)", async () => {
    const clock = manualClock()
    await withSave(
      { 'run.slot.0': stored() },
      async ({ save, handle }) => {
        const { host } = handle
        await must(save.load(0))
        host.fakes.server.remoteWrite('run.slot.0', theirs, 'Desk PC')
        save.touch(() => ({ ...kite, coins: 5 }))
        await save.flushPending()
        await settle()
        clock.advance(60_000)
        await settle()
        await host.bridge.resolveConflict('run.slot.0', 'theirs')
        await settle()
        expect(save.changedElsewhere.get()).toBe(true)
        expect(save.slots.get()[0]).toMatchObject({ kind: 'ready', meta: { label: 'Desk PC' } })
      },
      run,
      { host: { clock } },
    )
  })
})
