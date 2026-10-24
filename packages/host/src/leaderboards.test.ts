import type { SdkEnv } from '@ruken/sdk'
import { Context, Effect, Either, Exit, Layer, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from './hosting'
import { FakeHostHandle, HostingTest, type HostingTestOptions, runScoped } from './testing'

// The host's leaderboard call (PRODUCT spec §2 F1, §3 "Leaderboards"): Ruken's `LeaderboardsApi` relayed
// through `Hosting`. Without the grant, standalone or offline it fails with the SDK's code; it never falls
// back to a local board.

const granted: HostingTestOptions = {
  hosting: { wants: ['leaderboards'] },
  host: { grant: ['leaderboards'] },
}

const failure = <A>(attempt: Effect.Effect<A, unknown>) =>
  Effect.map(Effect.either(attempt), (result) => (Either.isLeft(result) ? result.left : undefined))

describe('Hosting.leaderboards (Ruken LeaderboardsApi through Hosting)', () => {
  it("submits a score and reads the board through the host's leaderboards", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.ready
        expect(yield* hosting.leaderboards.submit('high-score', 42)).toEqual({
          accepted: true,
          personalBest: 42,
          rank: 1,
        })
        expect(host.fakes.leaderboards.submits).toEqual([{ board: 'high-score', score: 42 }])
        expect(yield* hosting.leaderboards.get('high-score', { scope: 'top', limit: 10 })).toEqual({
          entries: [{ rank: 1, displayName: 'You', score: 42, isMe: true }],
        })
      }).pipe(Effect.provide(HostingTest(granted))),
    )
  })

  it('fails UNSUPPORTED when the host did not grant leaderboards, and sends the host nothing', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.ready
        expect(yield* failure(hosting.leaderboards.submit('high-score', 1))).toMatchObject({
          _tag: 'HostError',
          code: 'UNSUPPORTED',
          operation: 'leaderboard.submit',
        })
        expect(yield* failure(hosting.leaderboards.get('high-score'))).toMatchObject({
          _tag: 'HostError',
          code: 'UNSUPPORTED',
          operation: 'leaderboard.get',
        })
        expect(host.fakes.leaderboards.submits).toEqual([])
      }).pipe(Effect.provide(HostingTest({ hosting: { wants: ['leaderboards'] }, host: { grant: [] } }))),
    )
  })

  it('fails UNSUPPORTED standalone and keeps no local board', async () => {
    const topLevel = (env: SdkEnv): SdkEnv => ({ ...env, isTopLevel: true })
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.ready
        expect(hosting.kind).toBe('standalone')
        expect(yield* failure(hosting.leaderboards.submit('high-score', 7))).toMatchObject({
          code: 'UNSUPPORTED',
        })
        expect(yield* failure(hosting.leaderboards.get('high-score'))).toMatchObject({ code: 'UNSUPPORTED' })
      }).pipe(Effect.provide(HostingTest({ ...granted, env: topLevel }))),
    )
  })

  it("relays the host's error code when the board is offline", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.ready
        host.fakes.leaderboards.offline = true
        expect(yield* failure(hosting.leaderboards.submit('high-score', 3))).toMatchObject({
          _tag: 'HostError',
          code: 'OFFLINE',
        })
      }).pipe(Effect.provide(HostingTest(granted))),
    )
  })

  it('fails CANCELLED once Hosting has shut down', async () => {
    await runScoped(
      Effect.gen(function* () {
        const scope = yield* Scope.make()
        const context = yield* Layer.buildWithScope(HostingTest(granted), scope)
        const hosting = Context.get(context, Hosting)
        yield* Scope.close(scope, Exit.void)
        expect(yield* failure(hosting.leaderboards.submit('high-score', 1))).toMatchObject({
          code: 'CANCELLED',
        })
        expect(yield* failure(hosting.leaderboards.get('high-score'))).toMatchObject({ code: 'CANCELLED' })
      }),
    )
  })
})
