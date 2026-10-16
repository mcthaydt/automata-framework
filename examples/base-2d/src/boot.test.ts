import { createFakeHost, settle } from '@ruken/sdk-host/testing'
import { Effect, Exit, Scope } from 'effect'
import { describe, expect, it } from 'vitest'
import { type ConnectOptions, connect, GAME_ID } from './boot.ts'

// The base's connection to its host under Ruken's own fake host (`@ruken/sdk-host/testing`, in-memory ports):
// `Hosting`'s Ruken adapter over the real SDK against the real host bridge, as in examples/placeholder. An itch
// build gets the web adapter from the same `connect` (e2e/itch.itch.e2e.ts).

/** Connects in a scope the test closes, as the page's scope would close when it unloads. */
async function connected(options: ConnectOptions) {
  const scope = Effect.runSync(Scope.make())
  const hosting = await Effect.runPromise(Scope.extend(connect(options), scope))
  return { hosting, close: () => Effect.runPromise(Scope.close(scope, Exit.void)) }
}

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
    const { hosting, close } = await connected({ seams: { env }, onMenuRequest: () => true })
    expect(hosting.kind).toBe('ruken')
    expect(hosting.player.displayName).toBe('Ada')
    expect(host.messages.map((entry) => entry.msg.type).slice(0, 3)).toEqual([
      'hello',
      'welcome',
      'session.ready',
    ])
    await close()
    host.dispose()
  })

  it('does not resolve before the host says ready, and refuses the host menu until then', async () => {
    const { host, env } = fakeHost(false)
    let resolved = false
    let menuCalls = 0
    const connecting = connected({
      seams: { env },
      onMenuRequest: () => {
        menuCalls++
        return true
      },
    }).then((result) => {
      resolved = true
      return result
    })
    await settle()
    await host.connected()
    expect(host.bridge.state).toBe('welcomed')
    expect(resolved).toBe(false)
    expect(await host.bridge.openGameMenu()).toBe(false)
    expect(menuCalls).toBe(0)

    await host.bridge.markReady()
    const { close } = await connecting
    expect(resolved).toBe(true)
    expect(await host.bridge.openGameMenu()).toBe(true)
    expect(menuCalls).toBe(1)
    await close()
    host.dispose()
  })

  it('runs standalone when opened outside Ruken', async () => {
    const { host, env } = fakeHost(true)
    const { hosting, close } = await connected({
      seams: { env: { ...env, isTopLevel: true } },
      onMenuRequest: () => true,
    })
    expect(hosting.kind).toBe('standalone')
    await close()
    host.dispose()
  })
})
