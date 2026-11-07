// The `Hosting` contract cases every adapter passes (PUB spec §7 and §12 PUB-a; shared contracts §1.1, §1.5).
// `ruken/hosting-ruken.contract.test.ts` runs them against the Ruken adapter (over the fake Ruken host) and
// `web/hosting-web.test.ts` against the web adapter (over a fake page). A case that only one adapter can pass is
// not here: it lives beside that adapter, and every intended difference has its own test named after it. Published
// as `@mcthaydt/automata-host/contract-suite` so `FakeHosting` in `@mcthaydt/automata-testing` runs the same cases
// (DIST spec §7); it needs Vitest.
import { Chunk, Context, Effect, Either, Exit, Fiber, Layer, Option, Scope, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import type { HostError } from '../../shared/host/errors'
import { Hosting } from '../../shared/host/hosting'
import { runScoped } from './page/run'

/** An adapter under test: a fresh layer per case, with `saves` granted. */
export type HostingLayer = () => Layer.Layer<Hosting, HostError>

/** Lets the fake Ruken host answer over its in-memory ports, and forked stream readers subscribe. */
export type Settle = Effect.Effect<void>

const observedOf = (hosting: Hosting) => ({
  lifecycle: hosting.lifecycle,
  input: hosting.input,
  display: hosting.display,
  audio: hosting.audio,
  entitlements: hosting.entitlements,
  savesStatus: hosting.savesStatus,
})

/**
 * Registers the `Hosting` contract's cases as a Vitest `describe` block named after `name`. `layer` builds a fresh
 * `Hosting` for each case, with `saves` granted; `settled` lets the host answer and forked stream readers subscribe
 * (for example one macrotask). Every target's adapter and `FakeHosting` pass these cases (DIST spec §7).
 */
export function describeHostingContract(name: string, layer: HostingLayer, settled: Settle): void {
  const withHosting = <A>(program: (hosting: Hosting) => Effect.Effect<A, unknown>) =>
    runScoped(Effect.flatMap(Hosting, program).pipe(Effect.provide(layer())))

  describe(`the Hosting contract: ${name}`, () => {
    it('is ready, with no handshake fallback reported', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          yield* hosting.ready
          expect(Option.isNone(hosting.handshake.fellBack)).toBe(true)
        }),
      ))

    it('names its kind and its host for the UI', () =>
      withHosting((hosting) =>
        Effect.sync(() => {
          expect(['ruken', 'standalone', 'web', 'tauri']).toContain(hosting.kind)
          expect(hosting.hostName).toMatch(/\S/)
        }),
      ))

    it('reads a player and a locale', () =>
      withHosting((hosting) =>
        Effect.sync(() => {
          expect(typeof hosting.player.id).toBe('string')
          expect(typeof hosting.player.displayName).toBe('string')
          expect(hosting.locale).toMatch(/^[a-z]{2}/)
        }),
      ))

    it('grants saves when the game may keep them', () =>
      withHosting((hosting) => Effect.sync(() => expect(hosting.granted.has('saves')).toBe(true))))

    it('keeps a save: set, get, remove, and a missing key reads null', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          expect(yield* hosting.saves.get('progress')).toBeNull()
          yield* hosting.saves.set('progress', '2')
          expect(yield* hosting.saves.get('progress')).toBe('2')
          yield* hosting.saves.remove('progress')
          expect(yield* hosting.saves.get('progress')).toBeNull()
        }),
      ))

    it('flushes saves and says where they went', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          yield* hosting.saves.set('progress', '2')
          const flushing = yield* Effect.fork(hosting.saves.flush)
          yield* settled
          expect(yield* Fiber.join(flushing)).toMatchObject({
            persisted: expect.stringMatching(/^(host-outbox|server|device)$/),
          })
        }),
      ))

    it('lists the keys it holds, sorted by code unit, and drops a removed one (M5 spec §4.1)', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          expect(yield* hosting.saves.keys).toEqual([])
          for (const key of ['b', 'B', 'a.slot.0', 'a']) yield* hosting.saves.set(key, '1')
          expect(yield* hosting.saves.keys).toEqual(['B', 'a', 'a.slot.0', 'b'])
          yield* hosting.saves.remove('a')
          expect(yield* hosting.saves.keys).toEqual(['B', 'a.slot.0', 'b'])
        }),
      ))

    it('reports saves as saved when nothing is pending', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          expect(yield* hosting.savesStatus.get).toBe('saved')
        }),
      ))

    it('starts every observed stream with the current value', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          for (const [stream, observed] of Object.entries(observedOf(hosting))) {
            const subscribable = observed as typeof hosting.lifecycle
            const first = yield* subscribable.changes.pipe(Stream.take(1), Stream.runCollect)
            expect(Chunk.toReadonlyArray(first), stream).toEqual([yield* subscribable.get])
          }
        }),
      ))

    it('never fails a round or an analytics event', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          yield* hosting.round.start
          yield* hosting.round.start
          yield* hosting.round.end('complete')
          yield* hosting.round.end()
          yield* hosting.track('anything', { level: 1 })
        }),
      ))

    it('gives one round-end item per round that ended, with its outcome, and none for a dropped end (M5.2)', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          const reader = yield* Effect.fork(Stream.runCollect(hosting.round.ended.pipe(Stream.take(2))))
          yield* settled
          yield* Effect.yieldNow()
          yield* hosting.round.end('quit') // no round open: dropped
          yield* hosting.round.start
          yield* hosting.round.start // a second start: dropped
          yield* hosting.round.end('complete')
          yield* hosting.round.end('quit') // already ended: dropped
          yield* hosting.round.start
          yield* hosting.round.end()
          expect(Chunk.toReadonlyArray(yield* Fiber.join(reader))).toEqual(['complete', undefined])
        }),
      ))

    it('fails leaderboard calls UNSUPPORTED when the host has no leaderboards, and keeps no local board (PRODUCT.1)', () =>
      withHosting((hosting) =>
        Effect.gen(function* () {
          yield* hosting.ready
          const submitted = yield* Effect.either(hosting.leaderboards.submit('high-score', 1))
          expect(Either.isLeft(submitted) && submitted.left).toMatchObject({
            _tag: 'HostError',
            code: 'UNSUPPORTED',
            operation: 'leaderboard.submit',
          })
          const read = yield* Effect.either(hosting.leaderboards.get('high-score'))
          expect(Either.isLeft(read) && read.left).toMatchObject({
            _tag: 'HostError',
            code: 'UNSUPPORTED',
            operation: 'leaderboard.get',
          })
        }),
      ))

    it('takes menu and exiting handlers for as long as a scope is open', () =>
      withHosting((hosting) =>
        Effect.scoped(
          Effect.gen(function* () {
            yield* hosting.onMenuRequest(() => true)
            yield* hosting.onExiting(Effect.void)
          }),
        ),
      ))

    it('ends every observed stream when Hosting shuts down', () =>
      runScoped(
        Effect.gen(function* () {
          const scope = yield* Scope.make()
          const hosting = Context.get(yield* Layer.buildWithScope(layer(), scope), Hosting)
          const readers = yield* Effect.forEach(Object.values(observedOf(hosting)), (observed) =>
            Effect.fork(Stream.runCollect((observed as typeof hosting.lifecycle).changes)),
          )
          yield* settled
          yield* Scope.close(scope, Exit.void)
          const collected = yield* Effect.forEach(readers, Fiber.join)
          expect(collected.map(Chunk.size)).toEqual([1, 1, 1, 1, 1, 1])
        }),
      ))

    it('ends the saves-changed and round-ended streams when Hosting shuts down, with nothing in them', () =>
      runScoped(
        Effect.gen(function* () {
          const scope = yield* Scope.make()
          const hosting = Context.get(yield* Layer.buildWithScope(layer(), scope), Hosting)
          const readers: Fiber.Fiber<Chunk.Chunk<unknown>>[] = [
            yield* Effect.fork(Stream.runCollect(hosting.saves.changed)),
            yield* Effect.fork(Stream.runCollect(hosting.round.ended)),
          ]
          yield* settled
          yield* Scope.close(scope, Exit.void)
          const collected = yield* Effect.forEach(readers, Fiber.join)
          expect(collected.map(Chunk.size)).toEqual([0, 0])
        }),
      ))

    it('fails saves and requests on a shut-down Hosting with CANCELLED instead of dropping them', () =>
      runScoped(
        Effect.gen(function* () {
          const scope = yield* Scope.make()
          const hosting = Context.get(yield* Layer.buildWithScope(layer(), scope), Hosting)
          yield* Scope.close(scope, Exit.void)
          for (const attempt of [
            hosting.saves.set('progress', '2'),
            hosting.saves.get('progress'),
            hosting.saves.remove('progress'),
            hosting.saves.flush,
            hosting.saves.keys,
            hosting.leaderboards.submit('high-score', 1),
            hosting.leaderboards.get('high-score'),
            hosting.setFullscreen(true),
            hosting.exit(),
          ] as Effect.Effect<unknown, unknown>[]) {
            const result = yield* Effect.either(attempt)
            expect(Either.isLeft(result) && result.left).toMatchObject({
              _tag: 'HostError',
              code: 'CANCELLED',
            })
          }
        }),
      ))
  })
}
