import { settle } from '@ruken/sdk-host/testing'
import { Effect, Fiber } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from '#src/contract/hosting.ts'
import { HostingTest, manualClock, runScoped } from '#src/testing/index.ts'

/** The address a phone test serves Ruken from (FloorFifty tests/client/ruken/test-host-origin.test.ts). */
const TEST_HOST = 'https://ruken-host.e2e.test'

/**
 * A phone test's host and game: Ruken on its own https address and the game on
 * another, so neither is local and the SDK's localhost rule does not apply.
 */
const hostingFrom = (
  hostOrigin: string,
  testHostOrigins: readonly string[] | undefined,
): Promise<Hosting> => {
  const clock = manualClock()
  return runScoped(
    Effect.gen(function* () {
      const building = yield* Effect.fork(
        Hosting.pipe(
          Effect.provide(
            HostingTest({
              hosting: testHostOrigins === undefined ? {} : { testHostOrigins },
              host: { clock, hostOrigin, saves: { 'ff.playerName': 'Kite' } },
              gameOrigin: 'https://g-floorfifty.e2e.test',
            }),
          ),
        ),
      )
      for (let elapsed = 0; elapsed <= 10_000; elapsed += 250) {
        yield* Effect.promise(() => settle(2))
        clock.advance(250)
      }
      return yield* Fiber.join(building)
    }),
  )
}

describe('a welcome from a test host (testHostOrigins, test builds only)', () => {
  it('is accepted from the listed origin, and the game is hosted', async () => {
    const hosting = await hostingFrom(TEST_HOST, [TEST_HOST])
    expect(hosting.kind).toBe('ruken')
  })

  it('is dropped from that origin when the build lists none', async () => {
    const hosting = await hostingFrom(TEST_HOST, undefined)
    expect(hosting.kind).toBe('standalone')
  })

  it('is dropped from any origin other than the listed one', async () => {
    const hosting = await hostingFrom('https://ruken-host.other.test', [TEST_HOST])
    expect(hosting.kind).toBe('standalone')
  })
})

// AF trusts the hosts the SDK trusts and keeps no list of its own. Ruken's SDK at d0fa2fe also trusts its private
// beta's two netlify.app sites (`BETA_HOST_ORIGINS` in sdk/src/allowlist.ts), as exact strings: netlify.app is
// anyone's. This pins that, so a re-vendor that changes which hosts the SDK trusts shows up here.
describe("a welcome from Ruken's private beta sites (the SDK's allowlist)", () => {
  it.each(['https://ruken-beta.netlify.app', 'https://ruken-beta-admin.netlify.app'])(
    'is accepted from %s with no test origins listed',
    async (origin) => {
      const hosting = await hostingFrom(origin, undefined)
      expect(hosting.kind).toBe('ruken')
    },
  )

  it('is dropped from any other netlify.app site', async () => {
    const hosting = await hostingFrom('https://ruken-beta-copy.netlify.app', undefined)
    expect(hosting.kind).toBe('standalone')
  })
})
