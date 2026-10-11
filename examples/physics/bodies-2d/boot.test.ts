import { bootPage, CONNECT_FAILED, DEVICE_FAILED, ROOM } from '@af-examples/base-2d'
import { HostHandshakeFailed } from '@mcthaydt/automata-host'
import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { createBodiesSim } from './bodies-sim.ts'
import { hostReady, playBodies } from './boot.ts'

// Rapier, the physics extension's lazily loaded wasm, failing to load: the demo's first sim cannot be made.
vi.mock('../../../packages/physics/src/rapier-2d.ts', () => ({
  createRapier2D: () => Promise.reject(new Error('wasm compile refused')),
}))

/** Runs a boot through base-2d's bootPage, with stand-ins for the page's elements. */
async function boot(start: Effect.Effect<void, unknown>) {
  const root = { textContent: '' as string | null }
  const html = { dataset: {} as Record<string, string | undefined> }
  const logged: unknown[] = []
  await bootPage({ root, html, start, log: (_message, error) => logged.push(error) })
  return { text: root.textContent, state: html.dataset.state, logged }
}

describe('the demo’s boot failures', () => {
  it('says this device can’t run the game when Rapier will not load', async () => {
    const result = await boot(playBodies(() => createBodiesSim(ROOM)).pipe(Effect.asVoid))
    expect(result.state).toBe('failed')
    expect(result.text).toBe(DEVICE_FAILED)
    // The log keeps the loader's own error, not just the tag.
    expect(String(result.logged[0])).toContain('wasm compile refused')
  })

  it('blames the connection only when the host handshake fails', async () => {
    const failed = Effect.fail(new HostHandshakeFailed({ reason: 'no-welcome' }))
    const result = await boot(hostReady(failed))
    expect(result.state).toBe('failed')
    expect(result.text).toBe(CONNECT_FAILED)
  })

  it('shows nothing extra when everything starts', async () => {
    const result = await boot(hostReady(Effect.void).pipe(Effect.zipRight(playBodies(async () => 'started'))))
    expect(result.state).toBe('ready')
    expect(result.text).toBe('')
  })
})
