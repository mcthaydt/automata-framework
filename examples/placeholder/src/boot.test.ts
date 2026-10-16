import type { Hosting } from '@mcthaydt/automata-host'
import { createFakeHost, type FakeHostOptions, settle } from '@ruken/sdk-host/testing'
import { Effect, Exit, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { BLOCKED_STORAGE_NOTICE, boot, GAME_ID } from './boot.ts'

// The placeholder under Ruken's own fake host (`@ruken/sdk-host/testing`, in-memory ports): `Hosting`'s Ruken
// adapter over the real SDK against the real host bridge, so this is Ruken's handshake, not a copy of it.
// The web adapter (an itch build) is the same `Hosting`; its own tests are in packages/host, and the browser
// journeys in e2e/itch.itch.e2e.ts run this boot on it.

const clock = {
  epochMs: () => Date.parse('2026-10-11T12:00:00Z'),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

function fakeHost(options: Partial<Omit<FakeHostOptions, 'gameOrigin' | 'gameId' | 'clock'>> = {}) {
  const host = createFakeHost({
    gameOrigin: 'http://localhost:4400',
    gameId: GAME_ID,
    clock,
    player: { id: 'p-1', displayName: 'Ada' },
    ...options,
  })
  if (host.gameEnv === null) throw new Error('in-memory mode exposes gameEnv')
  return { host, env: host.gameEnv }
}

function page() {
  return { root: { textContent: '' }, saves: { textContent: '' } }
}

/** Boots in a scope the test closes, as the page's scope closes when it unloads. */
async function booted(parts: Parameters<typeof boot>[0]) {
  const scope = Effect.runSync(Scope.make())
  const hosting: Hosting = await Effect.runPromise(Scope.extend(boot(parts), scope))
  return { hosting, close: () => Effect.runPromise(Scope.close(scope, Exit.void)) }
}

describe('placeholder boot', () => {
  it('completes the Ruken handshake and says hello once the host is ready', async () => {
    const { host, env } = fakeHost()
    const parts = page()
    const { hosting, close } = await booted({ ...parts, seams: { env } })
    expect(hosting.kind).toBe('ruken')
    expect(parts.root.textContent).toBe('Ready. Hello, Ada.')
    expect(host.messages.map((entry) => entry.msg.type).slice(0, 3)).toEqual([
      'hello',
      'welcome',
      'session.ready',
    ])
    await close()
    host.dispose()
  })

  it('says hello without a name when opened outside Ruken (standalone has no player name)', async () => {
    const { host, env } = fakeHost()
    const parts = page()
    const { hosting, close } = await booted({ ...parts, seams: { env: { ...env, isTopLevel: true } } })
    expect(hosting.kind).toBe('standalone')
    expect(parts.root.textContent).toBe('Ready. Hello.')
    await close()
    host.dispose()
  })

  it('renders nothing before the host says ready', async () => {
    const { host, env } = fakeHost({ autoReady: false })
    const parts = page()
    const booting = booted({ ...parts, seams: { env } })
    await settle()
    await host.connected()
    expect(host.bridge.state).toBe('welcomed')
    expect(parts.root.textContent).toBe('')
    expect(parts.saves.textContent).toBe('')

    await host.bridge.markReady()
    await settle()
    const { close } = await booting
    expect(parts.root.textContent).toBe('Ready. Hello, Ada.')
    await close()
    host.dispose()
  })

  it('counts visits in the player’s saves: the first visit, then one more than the save says', async () => {
    const first = fakeHost()
    const firstParts = page()
    const firstBoot = await booted({ ...firstParts, seams: { env: first.env } })
    expect(firstParts.saves.textContent).toBe('Visit 1.')
    expect(await Effect.runPromise(firstBoot.hosting.saves.get('visits'))).toBe('1')
    await firstBoot.close()
    first.host.dispose()

    const again = fakeHost({ saves: { visits: '1' } })
    const againParts = page()
    const againBoot = await booted({ ...againParts, seams: { env: again.env } })
    expect(againParts.saves.textContent).toBe('Visit 2.')
    await againBoot.close()
    again.host.dispose()
  })

  it('tells the player when saves are denied, and still boots (no silent fallback)', async () => {
    const { host, env } = fakeHost({ grant: [] })
    const parts = page()
    const { hosting, close } = await booted({ ...parts, seams: { env } })
    expect(hosting.granted.has('saves')).toBe(false)
    expect(parts.root.textContent).toBe('Ready. Hello, Ada.')
    expect(parts.saves.textContent).toBe(BLOCKED_STORAGE_NOTICE)
    expect(BLOCKED_STORAGE_NOTICE).toBe('Progress won’t be saved in this browser.')
    await close()
    host.dispose()
  })
})
