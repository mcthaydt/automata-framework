import type { SdkEnv } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Hosting } from '#src/shared/host/plain-hosting.ts'
import {
  type HostingTestOptions,
  type ManualClock,
  manualClock,
  openHostingTest,
  withHostingTest,
} from '#src/testing/host/page/index.ts'

/** Steps the SDK's clock past its 10 s give-up, 250 ms (one hello) at a time. */
async function passHandshakeTimeout(clock: ManualClock): Promise<void> {
  for (let elapsed = 0; elapsed <= 10_000; elapsed += 250) {
    await settle(2)
    clock.advance(250)
  }
}

/** Builds `Hosting` while the clock runs out the handshake, collecting warnings. */
async function hostingAfterTimeout(
  options: Omit<HostingTestOptions, 'host'> & { host?: HostingTestOptions['host'] } = {},
): Promise<{ hosting: Hosting; warnings: unknown[]; dispose(): void }> {
  const clock = manualClock()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const opening = openHostingTest({ ...options, host: { clock, ...options.host } })
  await passHandshakeTimeout(clock)
  const opened = await opening
  if (!opened.ok) throw new Error('the handshake was refused')
  const warnings = warn.mock.calls.flat()
  warn.mockRestore()
  return { hosting: opened.value.hosting, warnings, dispose: opened.value.dispose }
}

/** An env whose welcome never counts: every message appears to come from some other window. */
const dropsEveryWelcome = (env: SdkEnv): SdkEnv => ({
  ...env,
  onWindowMessage: (fn) => env.onWindowMessage((event) => fn({ ...event, source: {} })),
})

afterEach(() => vi.restoreAllMocks())

describe('the handshake (shared contracts §1.4; S6)', () => {
  it('succeeds inside a fake Ruken host, with what the host granted', () =>
    withHostingTest(
      ({ hosting }) => {
        expect(hosting.kind).toBe('ruken')
        expect(hosting.hostName).toBe('Ruken')
        expect(hosting.handshake.fellBack).toBeNull()
        expect([...hosting.granted]).toEqual(expect.arrayContaining(['saves', 'lifecycle', 'display']))
      },
      { hosting: { wants: ['saves'] } },
    ))

  it('is standalone on a top-level page, with no fallback reported', () =>
    withHostingTest(
      ({ hosting }) => {
        expect(hosting.kind).toBe('standalone')
        // A Ruken build names Ruken even standalone; the UI hides "Back to …" there because exit is not granted.
        expect(hosting.hostName).toBe('Ruken')
        expect(hosting.handshake.fellBack).toBeNull()
        expect(hosting.granted.size).toBe(0)
      },
      { env: (env) => ({ ...env, isTopLevel: true }) },
    ))

  it('reads the locale and player from the session', () =>
    withHostingTest(
      ({ hosting }) => {
        expect(hosting.player).toEqual({ id: 'p-1', displayName: 'Kite' })
        expect(hosting.locale).toMatch(/^[a-z]{2}/)
      },
      { host: { player: { id: 'p-1', displayName: 'Kite' } } },
    ))

  it('falls back to standalone after 10 s with no welcome, and says so', async () => {
    // Every message appears to come from some other window, so the SDK drops each welcome.
    const { hosting, warnings, dispose } = await hostingAfterTimeout({ env: dropsEveryWelcome })
    expect(hosting.kind).toBe('standalone')
    expect(hosting.handshake.fellBack).toEqual({ reason: 'no-welcome' })
    expect(warnings.map(String).join(' ')).toContain('Ruken handshake failed')
    dispose()
  })

  it('ignores a welcome sent from the game window itself (forged self-welcome, S6 question 1)', async () => {
    const { hosting, dispose } = await hostingAfterTimeout({
      env: (env) => ({
        ...env,
        onWindowMessage: (fn) => env.onWindowMessage((event) => fn({ ...event, source: env })),
      }),
    })
    expect(hosting.kind).toBe('standalone')
    dispose()
  })

  it('ignores a welcome from an origin outside the allowlist', async () => {
    const { hosting, dispose } = await hostingAfterTimeout({ host: { hostOrigin: 'https://evil.example' } })
    expect(hosting.kind).toBe('standalone')
    dispose()
  })

  it('takes only one welcome', () =>
    withHostingTest(({ handle: { host } }) => {
      expect(host.messages.filter((entry) => entry.msg.type === 'welcome')).toHaveLength(1)
    }))
})

describe('readiness (R-04)', () => {
  it('waits for session.ready', () =>
    withHostingTest(
      async ({ hosting, handle: { host } }) => {
        let answered = false
        void hosting.ready.then(() => {
          answered = true
        })
        await settle()
        expect(answered).toBe(false)

        await host.bridge.markReady()
        await settle()
        expect(answered).toBe(true)
        expect(await hosting.ready).toEqual({ ok: true, value: undefined })
      },
      { host: { autoReady: false } },
    ))

  it('is ready at once after the host marked it ready', () =>
    withHostingTest(async ({ hosting }) => {
      expect(await hosting.ready).toEqual({ ok: true, value: undefined })
    }))
})
