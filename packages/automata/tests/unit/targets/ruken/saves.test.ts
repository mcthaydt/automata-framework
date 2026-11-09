import type { SdkEnv, StorageLike } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import type { HostResult } from '#src/shared/host/errors.ts'
import { manualClock, withHostingTest } from '#src/testing/host/page/index.ts'
import { unwrap } from '#src/testing/unwrap.ts'

describe('saves (shared contracts §1.5)', () => {
  it("reads the host's snapshot and writes back through saves.set", () =>
    withHostingTest(
      async ({ hosting, handle: { sentByGame } }) => {
        expect(unwrap(await hosting.saves.get('ff.playerName'))).toBe('Kite')
        expect(unwrap(await hosting.saves.get('missing'))).toBeNull()

        unwrap(await hosting.saves.set('ff.playerName', 'Wren'))
        await settle()
        // Only key and value are asserted: baseRevision and writeId are Ruken's to keep or drop (§1.6).
        expect(sentByGame('saves.set')).toEqual([
          expect.objectContaining({ key: 'ff.playerName', value: 'Wren' }),
        ])
        expect(unwrap(await hosting.saves.get('ff.playerName'))).toBe('Wren')

        unwrap(await hosting.saves.remove('ff.playerName'))
        await settle()
        expect(sentByGame('saves.remove')).toEqual([expect.objectContaining({ key: 'ff.playerName' })])
        expect(unwrap(await hosting.saves.get('ff.playerName'))).toBeNull()
      },
      { host: { saves: { 'ff.playerName': 'Kite' } } },
    ))

  it('flushes every pending write to the host', () =>
    withHostingTest(async ({ hosting, handle: { sentByGame } }) => {
      unwrap(await hosting.saves.set('progress', '2'))
      const flushed = hosting.saves.flush()
      await settle()
      expect(unwrap(await flushed)).toMatchObject({
        persisted: expect.stringMatching(/^(host-outbox|server)$/),
      })
      expect(sentByGame('saves.flush')).toHaveLength(1)
    }))

  it('relays a write over the limit as QUOTA_EXCEEDED and keeps the cached value', () =>
    withHostingTest(async ({ hosting, handle: { sentByGame } }) => {
      unwrap(await hosting.saves.set('big', 'small'))
      // Larger than any per-value limit Ruken could set; AF does not quote the number (§1.3).
      const tooBig = 'x'.repeat(16 * 1024 * 1024)
      expect(await hosting.saves.set('big', tooBig)).toMatchObject({
        ok: false,
        reason: { code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.set' },
      })
      expect(unwrap(await hosting.saves.get('big'))).toBe('small')
      await settle()
      expect(sentByGame('saves.set')).toHaveLength(1)
    }))

  it("relays a key the SDK refuses as Ruken's INVALID_PAYLOAD", () =>
    withHostingTest(async ({ hosting }) => {
      expect(await hosting.saves.set('not a valid key!', '1')).toMatchObject({
        ok: false,
        reason: { code: 'INVALID_PAYLOAD' },
      })
    }))

  it('reports syncing then saved, offline-queued while offline, then a conflict and its recovery', async () => {
    const clock = manualClock()
    await withHostingTest(
      async ({ hosting, handle: { host } }) => {
        const statuses: string[] = []
        hosting.savesStatus.subscribe((status) => statuses.push(status))
        await settle()

        // The host batches writes and syncs them after its debounce.
        unwrap(await hosting.saves.set('progress', '2'))
        await settle()
        clock.advance(1000)
        await settle()
        expect(statuses).toEqual(['saved', 'syncing', 'saved'])

        host.fakes.saves.offline = true
        unwrap(await hosting.saves.set('progress', '3'))
        await settle()
        clock.advance(1000)
        await settle()
        expect(statuses).toContain('offline-queued')

        host.fakes.saves.offline = false
        host.fakes.server.remoteWrite('progress', '9', 'Desk PC')
        unwrap(await hosting.saves.set('progress', '4'))
        await settle()
        clock.advance(60_000)
        await settle()
        expect(hosting.savesStatus.get()).toBe('conflict')

        await host.bridge.resolveConflict('progress', 'theirs')
        await settle()
        expect(hosting.savesStatus.get()).toBe('recovered')
        expect(unwrap(await hosting.saves.get('progress'))).toBe('9')
      },
      { host: { clock, saves: { progress: '1' } } },
    )
  })

  it('lists every key the session holds, sorted by code unit, including one written this visit (M5 spec §4.1)', () =>
    withHostingTest(
      async ({ hosting }) => {
        expect(unwrap(await hosting.saves.keys())).toEqual(['a', 'a.slot.0', 'b'])
        unwrap(await hosting.saves.set('B', '4'))
        expect(unwrap(await hosting.saves.keys())).toEqual(['B', 'a', 'a.slot.0', 'b'])
        unwrap(await hosting.saves.remove('a'))
        expect(unwrap(await hosting.saves.keys())).toEqual(['B', 'a.slot.0', 'b'])
      },
      { host: { saves: { b: '1', a: '2', 'a.slot.0': '3' } } },
    ))

  it("tells listeners about another device's write once the host's conflict choice reaches this session (M5 spec §4.1)", async () => {
    const clock = manualClock()
    await withHostingTest(
      async ({ hosting, handle: { host } }) => {
        unwrap(await hosting.ready)
        const changes: { key: string; value: string | null; revision?: number }[] = []
        hosting.saves.changed.subscribe((change) => changes.push(change))
        await settle()

        host.fakes.server.remoteWrite('progress', '9', 'Desk PC')
        unwrap(await hosting.saves.set('progress', '4'))
        await settle()
        clock.advance(60_000)
        await settle()
        await host.bridge.resolveConflict('progress', 'theirs')
        await settle()

        expect(changes).toHaveLength(1)
        expect(changes[0]).toMatchObject({ key: 'progress', value: '9' })
        expect(typeof changes[0]?.revision).toBe('number')
      },
      { host: { clock, saves: { progress: '1' } } },
    )
  })

  it("without the saves grant, relays the SDK's behaviour: writes stay in memory, nothing is sent, flush is UNSUPPORTED", () =>
    // Ruken's SDK at d0fa2fe (as at b30d31b) keeps an ungranted write in its cache for the visit
    // (sdk/src/saves-storage.ts, `enabled`), unlike Ruken's S6 answer 3 (throw DENIED).
    // AF adds no gate of its own (shared contracts §1.3); this pins the SDK's behaviour
    // so a re-vendor that changes it shows up here. Raised with Ruken through the integration owner.
    withHostingTest(
      async ({ hosting, handle: { sentByGame } }) => {
        expect(hosting.granted.has('saves')).toBe(false)
        unwrap(await hosting.saves.set('progress', '2'))
        expect(unwrap(await hosting.saves.get('progress'))).toBe('2')
        expect(await hosting.saves.flush()).toMatchObject({
          ok: false,
          reason: { code: 'UNSUPPORTED', operation: 'saves.flush' },
        })
        await settle()
        expect(sentByGame('saves.set')).toEqual([])
      },
      { hosting: { wants: [] } },
    ))

  // AGENTS.md, host authority: a denied or unavailable hosted capability must not silently switch to device
  // storage. The page's own storage is handed to the SDK as a spy, and a Ruken frame must never write to it.
  describe("the page's own storage", () => {
    const pageStorage = () => {
      const writes: string[] = []
      const values = new Map<string, string>()
      const storage: StorageLike = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
          writes.push(key)
          values.set(key, value)
        },
        removeItem: (key) => void values.delete(key),
        key: (index) => [...values.keys()][index] ?? null,
        get length() {
          return values.size
        },
      }
      return { storage, writes }
    }
    const withStorage =
      (storage: StorageLike, isTopLevel = false) =>
      (env: SdkEnv): SdkEnv => ({ ...env, isTopLevel, storage })

    it('is where a top-level page keeps its saves, which is what the cases below must not see in a frame', async () => {
      const { storage, writes } = pageStorage()
      await withHostingTest(
        async ({ hosting }) => {
          unwrap(await hosting.saves.set('progress', '2'))
        },
        { env: withStorage(storage, true) },
      )
      expect(writes.length).toBeGreaterThan(0)
    })

    it('is never written without the saves grant', async () => {
      const { storage, writes } = pageStorage()
      await withHostingTest(
        async ({ hosting }) => {
          expect(hosting.granted.has('saves')).toBe(false)
          unwrap(await hosting.saves.set('progress', '2'))
          await settle()
        },
        { hosting: { wants: [] }, env: withStorage(storage) },
      )
      expect(writes).toEqual([])
    })

    it('is never written while the saves server is out of reach: the write queues on the host session', async () => {
      const { storage, writes } = pageStorage()
      const clock = manualClock()
      await withHostingTest(
        async ({ hosting, handle: { host } }) => {
          host.fakes.saves.offline = true
          unwrap(await hosting.saves.set('progress', '3'))
          await settle()
          clock.advance(1000)
          await settle()
          expect(hosting.savesStatus.get()).toBe('offline-queued')
        },
        { host: { clock, saves: { progress: '1' } }, env: withStorage(storage) },
      )
      expect(writes).toEqual([])
    })
  })
})
