import { settle } from '@ruken/sdk-host/testing'
import { Effect, Either, Fiber, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from './hosting'
import { FakeHostHandle, HostingTest, manualClock, runScoped } from './testing'

const settled: Effect.Effect<void> = Effect.promise(() => settle())

describe('saves (shared contracts §1.5; FloorFifty hosting and settings-hosted)', () => {
  it("reads the host's snapshot and writes back through saves.set", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        expect(yield* hosting.saves.get('ff.playerName')).toBe('Kite')
        expect(yield* hosting.saves.get('missing')).toBeNull()

        yield* hosting.saves.set('ff.playerName', 'Wren')
        yield* settled
        // Only key and value are asserted: baseRevision and writeId are Ruken's to keep or drop (§1.6).
        expect(sentByGame('saves.set')).toEqual([
          expect.objectContaining({ key: 'ff.playerName', value: 'Wren' }),
        ])
        expect(yield* hosting.saves.get('ff.playerName')).toBe('Wren')

        yield* hosting.saves.remove('ff.playerName')
        yield* settled
        expect(sentByGame('saves.remove')).toEqual([expect.objectContaining({ key: 'ff.playerName' })])
        expect(yield* hosting.saves.get('ff.playerName')).toBeNull()
      }).pipe(Effect.provide(HostingTest({ host: { saves: { 'ff.playerName': 'Kite' } } }))),
    )
  })

  it('flushes every pending write to the host', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* hosting.saves.set('progress', '2')
        const flushed = yield* Effect.fork(hosting.saves.flush)
        yield* settled
        expect(yield* Fiber.join(flushed)).toMatchObject({
          persisted: expect.stringMatching(/^(host-outbox|server)$/),
        })
        expect(sentByGame('saves.flush')).toHaveLength(1)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('relays a write over the limit as QUOTA_EXCEEDED and keeps the cached value', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* hosting.saves.set('big', 'small')
        // Larger than any per-value limit Ruken could set; AF does not quote the number (§1.3).
        const tooBig = 'x'.repeat(16 * 1024 * 1024)
        const result = yield* Effect.either(hosting.saves.set('big', tooBig))
        expect(Either.isLeft(result) && result.left).toMatchObject({
          _tag: 'HostError',
          code: 'QUOTA_EXCEEDED',
          retryable: false,
          operation: 'saves.set',
        })
        expect(yield* hosting.saves.get('big')).toBe('small')
        yield* settled
        expect(sentByGame('saves.set')).toHaveLength(1)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it("relays a key the SDK refuses as Ruken's INVALID_PAYLOAD", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const result = yield* Effect.either(hosting.saves.set('not a valid key!', '1'))
        expect(Either.isLeft(result) && result.left).toMatchObject({ code: 'INVALID_PAYLOAD' })
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('reports syncing then saved, offline-queued while offline, then a conflict and its recovery', async () => {
    const clock = manualClock()
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const statuses: string[] = []
        yield* Effect.forkScoped(
          Stream.runForEach(hosting.savesStatus.changes, (status) =>
            Effect.sync(() => statuses.push(status)),
          ),
        )
        yield* settled

        // The host batches writes and syncs them after its debounce.
        yield* hosting.saves.set('progress', '2')
        yield* settled
        clock.advance(1000)
        yield* settled
        expect(statuses).toEqual(['saved', 'syncing', 'saved'])

        host.fakes.saves.offline = true
        yield* hosting.saves.set('progress', '3')
        yield* settled
        clock.advance(1000)
        yield* settled
        expect(statuses).toContain('offline-queued')

        host.fakes.saves.offline = false
        host.fakes.server.remoteWrite('progress', '9', 'Desk PC')
        yield* hosting.saves.set('progress', '4')
        yield* settled
        clock.advance(60_000)
        yield* settled
        expect(yield* hosting.savesStatus.get).toBe('conflict')

        yield* Effect.promise(() => host.bridge.resolveConflict('progress', 'theirs'))
        yield* settled
        expect(yield* hosting.savesStatus.get).toBe('recovered')
        expect(yield* hosting.saves.get('progress')).toBe('9')
      }).pipe(Effect.provide(HostingTest({ host: { clock, saves: { progress: '1' } } }))),
    )
  })

  it("without the saves grant, relays the SDK's behaviour: writes stay in memory, nothing is sent, flush is UNSUPPORTED", async () => {
    // Ruken's SDK at b30d31b keeps an ungranted write in its cache for the visit
    // (sdk/src/saves-storage.ts, `enabled`), unlike Ruken's S6 answer 3 (throw DENIED).
    // AF adds no gate of its own (shared contracts §1.3); this pins the SDK's behaviour
    // so a re-vendor that changes it shows up here. Raised with Ruken through the integration owner.
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        expect(hosting.granted.has('saves')).toBe(false)
        yield* hosting.saves.set('progress', '2')
        expect(yield* hosting.saves.get('progress')).toBe('2')
        const flushed = yield* Effect.either(hosting.saves.flush)
        expect(Either.isLeft(flushed) && flushed.left).toMatchObject({
          code: 'UNSUPPORTED',
          operation: 'saves.flush',
        })
        yield* settled
        expect(sentByGame('saves.set')).toEqual([])
      }).pipe(Effect.provide(HostingTest({ hosting: { wants: [] } }))),
    )
  })
})
