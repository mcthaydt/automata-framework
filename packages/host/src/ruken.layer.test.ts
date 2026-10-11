import type { SdkEnv } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { Effect, Either, Fiber } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from './hosting.service'
import { FakeHostHandle, FakeRukenHosting, manualClock, runScoped } from './testing'

describe('the Ruken adapter: handshake and readiness', () => {
  it('is hosted inside a fake Ruken host, with what the host granted', async () => {
    const hosting = await runScoped(
      Effect.gen(function* () {
        return yield* Hosting
      }).pipe(Effect.provide(FakeRukenHosting({ hosting: { wants: ['saves', 'links'] } }))),
    )
    expect(hosting.kind).toBe('ruken')
    expect(hosting.hosted).toBe(true)
    expect([...hosting.granted]).toEqual(expect.arrayContaining(['saves', 'links']))
  })

  it('is not ready until the host says session.ready (R-04)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const waiting = yield* Effect.fork(hosting.ready)
        yield* Effect.promise(() => settle())
        expect(yield* Fiber.poll(waiting)).toEqual(expect.objectContaining({ _tag: 'None' }))

        yield* Effect.promise(() => host.bridge.markReady())
        yield* Effect.promise(() => settle())
        yield* Fiber.join(waiting)
      }).pipe(Effect.provide(FakeRukenHosting({ host: { autoReady: false } }))),
    )
  })

  it('fails with HostHandshakeFailed, never falling back to the web, when the frame never welcomes the game', async () => {
    const clock = manualClock()
    // Every message from the host appears to come from some other window, so the SDK drops each welcome.
    const forgeSource = (env: SdkEnv): SdkEnv => ({
      ...env,
      onWindowMessage: (fn) => env.onWindowMessage((event) => fn({ ...event, source: {} })),
    })
    const result = await runScoped(
      Effect.gen(function* () {
        const attempt = yield* Effect.fork(
          Effect.either(Hosting.pipe(Effect.provide(FakeRukenHosting({ host: { clock }, env: forgeSource })))),
        )
        // The SDK says hello every 250 ms and gives up after 10 s.
        for (let elapsed = 0; elapsed <= 10_000; elapsed += 250) {
          yield* Effect.promise(() => settle(2))
          clock.advance(250)
        }
        return yield* Fiber.join(attempt)
      }),
    )
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) expect(result.left._tag).toBe('HostHandshakeFailed')
  })

  it('ignores a welcome sent from the game window itself (forged self-welcome)', async () => {
    const clock = manualClock()
    // The welcome arrives with the game's own window as its source: only `event.source === parent` stops it.
    const fromSelf = (env: SdkEnv): SdkEnv => ({
      ...env,
      onWindowMessage: (fn) => env.onWindowMessage((event) => fn({ ...event, source: env })),
    })
    const result = await runScoped(
      Effect.gen(function* () {
        const attempt = yield* Effect.fork(
          Effect.either(Hosting.pipe(Effect.provide(FakeRukenHosting({ host: { clock }, env: fromSelf })))),
        )
        for (let elapsed = 0; elapsed <= 10_000; elapsed += 250) {
          yield* Effect.promise(() => settle(2))
          clock.advance(250)
        }
        return yield* Fiber.join(attempt)
      }),
    )
    expect(Either.isLeft(result)).toBe(true)
  })

  it('accepts only the first welcome', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        expect(host.messages.filter((entry) => entry.msg.type === 'welcome')).toHaveLength(1)
        expect(hosting.hosted).toBe(true)
      }).pipe(Effect.provide(FakeRukenHosting())),
    )
  })
})
