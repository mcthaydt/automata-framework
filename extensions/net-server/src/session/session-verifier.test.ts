import { Duration, Effect, Either, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  anonymousVerifier,
  createFakeVerifier,
  isTestVerifier,
  type SessionVerifier,
} from './session-verifier'

// `SessionVerifier` (M7 spec §4.3, M7-D7): anonymous until R-13, and a fake that verifies test tokens.

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(TestContext.TestContext)))

const verify = (verifier: SessionVerifier, token: string) => verifier.verify(token).pipe(Effect.either)

describe('anonymousVerifier', () => {
  it('accepts any token and none, and names nobody', async () => {
    for (const token of ['', 'anything', 'fake-session-1']) {
      const result = await run(verify(anonymousVerifier, token))
      expect(result).toEqual(Either.right({ playerId: 'anonymous' }))
    }
  })

  it('is not a test verifier', () => {
    expect(isTestVerifier(anonymousVerifier)).toBe(false)
  })
})

describe('createFakeVerifier', () => {
  it('accepts a token it issued, naming its player', async () => {
    const result = await run(
      Effect.gen(function* () {
        const fake = createFakeVerifier()
        const token = fake.issue('player-a', { expiresAtMs: 60_000 })
        return yield* verify(fake, token)
      }),
    )
    expect(result).toEqual(Either.right({ playerId: 'player-a' }))
  })

  it.each([
    ['forged', 'fake-session-999'],
    ['forged', 'FAKE-FORGED-not-a-secret'],
    ['missing', ''],
  ])('refuses %s for %j', async (reason, token) => {
    const fake = createFakeVerifier()
    fake.issue('player-a', { expiresAtMs: 60_000 })
    const result = await run(verify(fake, token))
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) expect(result.left).toMatchObject({ _tag: 'SessionRejected', reason })
  })

  it('refuses a token once its expiry has passed on the clock', async () => {
    const result = await run(
      Effect.gen(function* () {
        const fake = createFakeVerifier()
        const token = fake.issue('player-a', { expiresAtMs: 1_000 })
        const before = yield* verify(fake, token)
        yield* TestClock.adjust(Duration.millis(1_000))
        const after = yield* verify(fake, token)
        return { before, after }
      }),
    )
    expect(Either.isRight(result.before)).toBe(true)
    expect(Either.isLeft(result.after)).toBe(true)
    if (Either.isLeft(result.after)) expect(result.after.left.reason).toBe('expired')
  })

  it('does not accept another fake’s tokens, and is a test verifier', async () => {
    const one = createFakeVerifier()
    const other = createFakeVerifier()
    const token = one.issue('player-a', { expiresAtMs: 60_000 })
    other.issue('player-b', { expiresAtMs: 60_000 })
    const result = await run(verify(other, token))
    expect(Either.isLeft(result)).toBe(true)
    expect(isTestVerifier(one)).toBe(true)
  })
})
