import { createFakeHost, settle } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { boot, GAME_ID } from './boot.ts'

// The placeholder under Ruken's own fake host (`@ruken/sdk-host/testing`, in-memory ports): the real SDK
// against the real host bridge, so this is Ruken's handshake, not a copy of it.

const clock = {
  epochMs: () => Date.parse('2026-10-11T12:00:00Z'),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

function fakeHost(autoReady: boolean) {
  const host = createFakeHost({
    gameOrigin: 'http://localhost:4400',
    gameId: GAME_ID,
    clock,
    autoReady,
    player: { id: 'p-1', displayName: 'Ada' },
  })
  if (host.gameEnv === null) throw new Error('in-memory mode exposes gameEnv')
  return { host, env: host.gameEnv }
}

describe('placeholder boot', () => {
  it('completes the Ruken handshake and says hello once the host is ready', async () => {
    const { host, env } = fakeHost(true)
    const root = { textContent: '' }
    const session = await Effect.runPromise(boot({ root, env }))
    expect(session.hosted).toBe(true)
    expect(root.textContent).toBe('Ready. Hello, Ada.')
    expect(host.messages.map((entry) => entry.msg.type)).toEqual(['hello', 'welcome', 'session.ready'])
    session.dispose()
    host.dispose()
  })

  it('renders nothing before the host says ready', async () => {
    const { host, env } = fakeHost(false)
    const root = { textContent: '' }
    const booting = Effect.runPromise(boot({ root, env }))
    await settle()
    await host.connected()
    expect(host.bridge.state).toBe('welcomed')
    expect(root.textContent).toBe('')

    await host.bridge.markReady()
    await settle()
    const session = await booting
    expect(root.textContent).toBe('Ready. Hello, Ada.')
    session.dispose()
    host.dispose()
  })
})
