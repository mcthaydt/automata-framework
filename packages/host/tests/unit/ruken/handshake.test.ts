import type { SdkEnv } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { Effect, Fiber, Logger, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from '#src/contract/hosting.ts'
import { FakeHostHandle, HostingTest, type ManualClock, manualClock, runScoped } from '#src/testing/index.ts'

/** Steps the SDK's clock past its 10 s give-up, 250 ms (one hello) at a time. */
const passHandshakeTimeout = (clock: ManualClock): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (let elapsed = 0; elapsed <= 10_000; elapsed += 250) {
      yield* Effect.promise(() => settle(2))
      clock.advance(250)
    }
  })

/** Builds `Hosting` in the background while the clock runs out the handshake, collecting warnings. */
const hostingAfterTimeout = async (
  env: (env: SdkEnv) => SdkEnv,
): Promise<{ hosting: Hosting; warnings: unknown[] }> => {
  const clock = manualClock()
  const warnings: unknown[] = []
  const collect = Logger.make(({ logLevel, message }) => {
    if (logLevel._tag === 'Warning') warnings.push(message)
  })
  const hosting = await runScoped(
    Effect.gen(function* () {
      const building = yield* Effect.fork(Hosting.pipe(Effect.provide(HostingTest({ host: { clock }, env }))))
      yield* passHandshakeTimeout(clock)
      return yield* Fiber.join(building)
    }).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, collect))),
  )
  return { hosting, warnings }
}

describe('the handshake (shared contracts §1.4; S6)', () => {
  it('succeeds inside a fake Ruken host, with what the host granted', async () => {
    const hosting = await runScoped(
      Hosting.pipe(Effect.provide(HostingTest({ hosting: { wants: ['saves'] } }))),
    )
    expect(hosting.kind).toBe('ruken')
    expect(hosting.hostName).toBe('Ruken')
    expect(Option.isNone(hosting.handshake.fellBack)).toBe(true)
    expect([...hosting.granted]).toEqual(expect.arrayContaining(['saves', 'lifecycle', 'display']))
  })

  it('is standalone on a top-level page, with no fallback reported', async () => {
    const hosting = await runScoped(
      Hosting.pipe(Effect.provide(HostingTest({ env: (env) => ({ ...env, isTopLevel: true }) }))),
    )
    expect(hosting.kind).toBe('standalone')
    // A Ruken build names Ruken even standalone; the UI hides "Back to …" there because exit is not granted.
    expect(hosting.hostName).toBe('Ruken')
    expect(Option.isNone(hosting.handshake.fellBack)).toBe(true)
    expect(hosting.granted.size).toBe(0)
  })

  it('reads the locale and player from the session', async () => {
    const hosting = await runScoped(
      Hosting.pipe(Effect.provide(HostingTest({ host: { player: { id: 'p-1', displayName: 'Kite' } } }))),
    )
    expect(hosting.player).toEqual({ id: 'p-1', displayName: 'Kite' })
    expect(hosting.locale).toMatch(/^[a-z]{2}/)
  })

  it('falls back to standalone after 10 s with no welcome, and says so', async () => {
    // Every message appears to come from some other window, so the SDK drops each welcome.
    const { hosting, warnings } = await hostingAfterTimeout((env) => ({
      ...env,
      onWindowMessage: (fn) => env.onWindowMessage((event) => fn({ ...event, source: {} })),
    }))
    expect(hosting.kind).toBe('standalone')
    expect(Option.getOrThrow(hosting.handshake.fellBack)).toMatchObject({
      _tag: 'HostHandshakeFailed',
      reason: 'no-welcome',
    })
    expect(warnings).toHaveLength(1)
  })

  it('ignores a welcome sent from the game window itself (forged self-welcome, S6 question 1)', async () => {
    const { hosting } = await hostingAfterTimeout((env) => ({
      ...env,
      onWindowMessage: (fn) => env.onWindowMessage((event) => fn({ ...event, source: env })),
    }))
    expect(hosting.kind).toBe('standalone')
  })

  it('ignores a welcome from an origin outside the allowlist', async () => {
    const clock = manualClock()
    const hosting = await runScoped(
      Effect.gen(function* () {
        const building = yield* Effect.fork(
          Hosting.pipe(Effect.provide(HostingTest({ host: { clock, hostOrigin: 'https://evil.example' } }))),
        )
        yield* passHandshakeTimeout(clock)
        return yield* Fiber.join(building)
      }),
    )
    expect(hosting.kind).toBe('standalone')
  })

  it('takes only one welcome', async () => {
    await runScoped(
      Effect.gen(function* () {
        yield* Hosting
        const { host } = yield* FakeHostHandle
        expect(host.messages.filter((entry) => entry.msg.type === 'welcome')).toHaveLength(1)
      }).pipe(Effect.provide(HostingTest())),
    )
  })
})

describe('readiness (R-04)', () => {
  it('waits for session.ready', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const waiting = yield* Effect.fork(hosting.ready)
        yield* Effect.promise(() => settle())
        expect(Option.isNone(yield* Fiber.poll(waiting))).toBe(true)

        yield* Effect.promise(() => host.bridge.markReady())
        yield* Effect.promise(() => settle())
        yield* Fiber.join(waiting)
      }).pipe(Effect.provide(HostingTest({ host: { autoReady: false } }))),
    )
  })

  it('is ready at once after the host marked it ready', async () => {
    await runScoped(Effect.flatMap(Hosting, (hosting) => hosting.ready).pipe(Effect.provide(HostingTest())))
  })
})
