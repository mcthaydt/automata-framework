import type { SdkEnv } from '@ruken/sdk'
import { describe, expect, it } from 'vitest'
import type { HostResult } from '#src/shared/host/plain-errors.ts'
import { type HostingTestOptions, openHostingTest, withHostingTest } from '#src/testing/host/page/index.ts'
import { unwrap } from '#src/testing/unwrap.ts'

// The host's leaderboard call (PRODUCT spec §2 F1, §3 "Leaderboards"): Ruken's `LeaderboardsApi` relayed
// through `Hosting`. Without the grant, standalone or offline it is refused with the SDK's code; it never falls
// back to a local board.

const granted: HostingTestOptions = {
  hosting: { wants: ['leaderboards'] },
  host: { grant: ['leaderboards'] },
}

describe('Hosting.leaderboards (Ruken LeaderboardsApi through Hosting)', () => {
  it("submits a score and reads the board through the host's leaderboards", () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      unwrap(await hosting.ready)
      expect(unwrap(await hosting.leaderboards.submit('high-score', 42))).toEqual({
        accepted: true,
        personalBest: 42,
        rank: 1,
      })
      expect(host.fakes.leaderboards.submits).toEqual([{ board: 'high-score', score: 42 }])
      expect(unwrap(await hosting.leaderboards.get('high-score', { scope: 'top', limit: 10 }))).toEqual({
        entries: [{ rank: 1, displayName: 'You', score: 42, isMe: true }],
      })
    }, granted))

  it('refuses UNSUPPORTED when the host did not grant leaderboards, and sends the host nothing', () =>
    withHostingTest(
      async ({ hosting, handle: { host } }) => {
        unwrap(await hosting.ready)
        expect(await hosting.leaderboards.submit('high-score', 1)).toMatchObject({
          ok: false,
          reason: { code: 'UNSUPPORTED', operation: 'leaderboard.submit' },
        })
        expect(await hosting.leaderboards.get('high-score')).toMatchObject({
          ok: false,
          reason: { code: 'UNSUPPORTED', operation: 'leaderboard.get' },
        })
        expect(host.fakes.leaderboards.submits).toEqual([])
      },
      { hosting: { wants: ['leaderboards'] }, host: { grant: [] } },
    ))

  it('refuses UNSUPPORTED standalone and keeps no local board', () => {
    const topLevel = (env: SdkEnv): SdkEnv => ({ ...env, isTopLevel: true })
    return withHostingTest(
      async ({ hosting }) => {
        unwrap(await hosting.ready)
        expect(hosting.kind).toBe('standalone')
        expect(await hosting.leaderboards.submit('high-score', 7)).toMatchObject({
          ok: false,
          reason: { code: 'UNSUPPORTED' },
        })
        expect(await hosting.leaderboards.get('high-score')).toMatchObject({
          ok: false,
          reason: { code: 'UNSUPPORTED' },
        })
      },
      { ...granted, env: topLevel },
    )
  })

  it("relays the host's error code when the board is offline", () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      unwrap(await hosting.ready)
      host.fakes.leaderboards.offline = true
      expect(await hosting.leaderboards.submit('high-score', 3)).toMatchObject({
        ok: false,
        reason: { code: 'OFFLINE' },
      })
    }, granted))

  it('refuses CANCELLED once Hosting has been disposed', async () => {
    const opened = await openHostingTest(granted)
    if (!opened.ok) throw new Error('refused')
    const { hosting, dispose } = opened.value
    dispose()
    expect(await hosting.leaderboards.submit('high-score', 1)).toMatchObject({
      ok: false,
      reason: { code: 'CANCELLED' },
    })
    expect(await hosting.leaderboards.get('high-score')).toMatchObject({
      ok: false,
      reason: { code: 'CANCELLED' },
    })
  })
})
