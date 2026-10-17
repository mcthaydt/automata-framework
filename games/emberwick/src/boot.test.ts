import { createFakeHost, settle } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { connect, GAME_ID } from './boot.ts'

// The base's connection to Ruken under Ruken's own fake host (`@ruken/sdk-host/testing`, in-memory ports): the
// real SDK against the real host bridge, as in games/placeholder.

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

describe('connecting to Ruken', () => {
  it('completes the handshake and resolves once the host is ready', async () => {
    const { host, env } = fakeHost(true)
    const session = await Effect.runPromise(connect({ env, onMenuRequest: () => true }))
    expect(session.hosted).toBe(true)
    expect(session.player.displayName).toBe('Ada')
    expect(host.messages.map((entry) => entry.msg.type).slice(0, 3)).toEqual([
      'hello',
      'welcome',
      'session.ready',
    ])
    session.dispose()
    host.dispose()
  })

  it('does not resolve before the host says ready, and refuses the host menu until then', async () => {
    const { host, env } = fakeHost(false)
    let resolved = false
    let menuCalls = 0
    const connecting = Effect.runPromise(
      connect({
        env,
        onMenuRequest: () => {
          menuCalls++
          return true
        },
      }),
    ).then((session) => {
      resolved = true
      return session
    })
    await settle()
    await host.connected()
    expect(host.bridge.state).toBe('welcomed')
    expect(resolved).toBe(false)
    expect(await host.bridge.openGameMenu()).toBe(false)
    expect(menuCalls).toBe(0)

    await host.bridge.markReady()
    const session = await connecting
    expect(resolved).toBe(true)
    expect(await host.bridge.openGameMenu()).toBe(true)
    expect(menuCalls).toBe(1)
    session.dispose()
    host.dispose()
  })

  it('runs standalone when opened outside Ruken', async () => {
    const { host, env } = fakeHost(true)
    const session = await Effect.runPromise(
      connect({ env: { ...env, isTopLevel: true }, onMenuRequest: () => true }),
    )
    expect(session.hosted).toBe(false)
    session.dispose()
    host.dispose()
  })
})
