import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import type { Hosting } from '#src/shared/host/hosting.ts'
import { manualClock, openHostingTest } from '#src/testing/host/page/index.ts'

/** The address a phone test serves Ruken from. */
const TEST_HOST = 'https://ruken-host.e2e.test'

/**
 * A phone test's host and game: Ruken on its own https address and the game on
 * another, so neither is local and the SDK's localhost rule does not apply.
 */
async function hostingFrom(
  hostOrigin: string,
  testHostOrigins: readonly string[] | undefined,
): Promise<{ hosting: Hosting; dispose(): void }> {
  const clock = manualClock()
  const opening = openHostingTest({
    hosting: testHostOrigins === undefined ? {} : { testHostOrigins },
    host: { clock, hostOrigin, saves: { 'ff.playerName': 'Kite' } },
    gameOrigin: 'https://g-arcade.e2e.test',
  })
  for (let elapsed = 0; elapsed <= 10_000; elapsed += 250) {
    await settle(2)
    clock.advance(250)
  }
  const opened = await opening
  if (!opened.ok) throw new Error('refused')
  return opened.value
}

/** Builds `Hosting` from a welcome at `hostOrigin`, reads its kind, and disposes it. */
async function kindFrom(hostOrigin: string, testHostOrigins: readonly string[] | undefined): Promise<string> {
  const { hosting, dispose } = await hostingFrom(hostOrigin, testHostOrigins)
  const { kind } = hosting
  dispose()
  return kind
}

describe('a welcome from a test host (testHostOrigins, test builds only)', () => {
  it('is accepted from the listed origin, and the game is hosted', async () => {
    expect(await kindFrom(TEST_HOST, [TEST_HOST])).toBe('ruken')
  })

  it('is dropped from that origin when the build lists none', async () => {
    expect(await kindFrom(TEST_HOST, undefined)).toBe('standalone')
  })

  it('is dropped from any origin other than the listed one', async () => {
    expect(await kindFrom('https://ruken-host.other.test', [TEST_HOST])).toBe('standalone')
  })
})

// AF trusts the hosts the SDK trusts and keeps no list of its own. Ruken's SDK at d0fa2fe also trusts its private
// beta's two netlify.app sites (`BETA_HOST_ORIGINS` in sdk/src/allowlist.ts), as exact strings: netlify.app is
// anyone's. This pins that, so a re-vendor that changes which hosts the SDK trusts shows up here.
describe("a welcome from Ruken's private beta sites (the SDK's allowlist)", () => {
  it.each(['https://ruken-beta.netlify.app', 'https://ruken-beta-admin.netlify.app'])(
    'is accepted from %s with no test origins listed',
    async (origin) => {
      expect(await kindFrom(origin, undefined)).toBe('ruken')
    },
  )

  it('is dropped from any other netlify.app site', async () => {
    expect(await kindFrom('https://ruken-beta-copy.netlify.app', undefined)).toBe('standalone')
  })
})
