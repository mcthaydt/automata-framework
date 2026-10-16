// The `Hosting` contract cases every adapter passes (PUB spec §7 and §12 PUB-a; shared contracts §1.1, §1.5).
// `hosting-web.test.ts` runs them against the Ruken adapter (over the fake Ruken host) and the web adapter (over
// a fake page). A case that only one adapter can pass is not here: it lives beside that adapter, and every
// intended difference has its own test named after it. Internal to the host package's tests.
import { Chunk, Context, Effect, Either, Exit, Fiber, Layer, Option, Scope, Stream } from 'effect'
import { describe, expect, it } from 'vitest'
import { changes } from '../changes'
import type { HostError } from '../errors'
import { Hosting } from '../hosting'
import type { Observed } from '../observed'
import { runScoped } from './run'

/** An adapter under test: a fresh layer per case, with `saves` granted. */
export type HostingLayer = () => Layer.Layer<Hosting, HostError>

/** Lets the fake Ruken host answer over its in-memory ports; the web adapter needs nothing. */
export type Settle = Effect.Effect<void>

const observedOf = (hosting: Hosting) => ({
  lifecycle: hosting.lifecycle,
  input: hosting.input,
  display: hosting.display,
  audio: hosting.audio,
  entitlements: hosting.entitlements,
  savesStatus: hosting.savesStatus,
})

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
          expect(['ruken', 'standalone', 'web']).toContain(hosting.kind)
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
            persisted: expect.stringMatching(/^(host-outbox|server)$/),
          })
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
            const value = observed as Observed<unknown>
            const first = yield* changes(value).pipe(Stream.take(1), Stream.runCollect)
            expect(Chunk.toReadonlyArray(first), stream).toEqual([yield* value.get])
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
            Effect.fork(Stream.runCollect(changes(observed as Observed<unknown>))),
          )
          yield* settled
          yield* Scope.close(scope, Exit.void)
          const collected = yield* Effect.forEach(readers, Fiber.join)
          expect(collected.map(Chunk.size)).toEqual([1, 1, 1, 1, 1, 1])
        }),
      ))

    it('ends every plain subscription once when Hosting shuts down, and a later one at once', () =>
      runScoped(
        Effect.gen(function* () {
          const scope = yield* Scope.make()
          const hosting = Context.get(yield* Layer.buildWithScope(layer(), scope), Hosting)
          const observed = Object.values(observedOf(hosting)) as Observed<unknown>[]
          const ended: string[] = []
          for (const [index, value] of observed.entries()) {
            value.subscribe(
              () => undefined,
              () => ended.push(`open ${index}`),
            )
          }
          yield* settled
          expect(ended).toEqual([])
          yield* Scope.close(scope, Exit.void)
          for (const [index, value] of observed.entries()) {
            value.subscribe(
              () => undefined,
              () => ended.push(`late ${index}`),
            )
          }
          expect(ended).toEqual([
            ...observed.map((_, index) => `open ${index}`),
            ...observed.map((_, index) => `late ${index}`),
          ])
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
