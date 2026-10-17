import { realClock, TEST_GAME_ORIGIN } from '@mcthaydt/automata-host/testing'
import { BootDefect, type RuntimeHandle } from '@mcthaydt/automata-runtime'
import { fakeFetch, manualFrames } from '@mcthaydt/automata-runtime/testing'
import { defineComponent, definePlugin } from '@mcthaydt/automata-sim'
import { createFakeHost, type FakeHost, settle } from '@ruken/sdk-host/testing'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { defineGame, type GameSpec } from './define-game.ts'
import { startGame } from './start-game.ts'

// startGame composes defineGame's defaults with the runtime boot (DX spec §3.1). jsdom has no WebGL, so the
// Pixi renderer cannot start: a boot that reaches it under Ruken's fake host and fails with
// RendererUnavailable on the boot failure panel has run the layers, hosting and the content hash in order.
const Body = defineComponent('body', { x: 'f32' })
const plugin = definePlugin({ name: 'boot-test', defs: [Body] })

describe('startGame', () => {
  let handle: RuntimeHandle | undefined
  let host: FakeHost | undefined
  const roots: HTMLElement[] = []

  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    host = undefined
    for (const root of roots.splice(0)) root.remove()
    document.documentElement.removeAttribute('data-state')
  })

  function spec(root?: HTMLElement): GameSpec {
    const frames = manualFrames()
    return {
      id: 'start-test',
      size: { width: 320, height: 180 },
      sim: { plugins: [plugin] },
      ...(root === undefined ? {} : { root }),
      seams: {
        frames,
        fetch: fakeFetch({}).fetch,
        fonts: { load: () => Promise.resolve([]) },
        sdkEnv: () => {
          host = createFakeHost({ gameOrigin: TEST_GAME_ORIGIN, gameId: 'start-test', clock: realClock })
          if (host.gameEnv === undefined || host.gameEnv === null)
            throw new Error('the fake host has no game environment')
          return host.gameEnv
        },
      },
    }
  }

  async function bootFails(root: HTMLElement, frames: { advance(ms: number): void; pending: boolean }) {
    for (let tries = 0; tries < 400; tries++) {
      if (frames.pending) frames.advance(16)
      await settle(2)
      flushSync()
      if (root.querySelector('[data-testid="boot-failure"]') !== null) return
    }
    throw new Error('timed out waiting for the boot failure panel')
  }

  it('throws BootDefect when there is no root and no #game', () => {
    expect(() => startGame(spec())).toThrow(BootDefect)
  })

  it.each([
    ['a spec', (given: GameSpec) => startGame(given)],
    ['a defined game', (given: GameSpec) => startGame(defineGame(given))],
  ])('boots %s through the fake host to the renderer, which jsdom cannot start', async (_name, start) => {
    const root = document.body.appendChild(document.createElement('main'))
    roots.push(root)
    const given = spec(root)
    handle = start(given)
    await bootFails(root, given.seams?.frames as ReturnType<typeof manualFrames>)
    expect(host?.messages.some((entry) => entry.dir === 'in' && entry.msg.type === 'hello')).toBe(true)
    expect(root.querySelector('[data-layer="stage"]')).not.toBeNull()
    expect(document.documentElement.getAttribute('data-state')).toBe('failed')
    // `unsupported` is RendererUnavailable's state: hosting and the content hash passed before it.
    expect(root.querySelector('[data-testid="boot-failure"]')?.getAttribute('data-code')).toBe('unsupported')
  })

  it('finds #game when the spec names no root', async () => {
    const root = document.body.appendChild(document.createElement('main'))
    root.id = 'game'
    roots.push(root)
    const given = spec()
    handle = startGame(given)
    await bootFails(root, given.seams?.frames as ReturnType<typeof manualFrames>)
    expect(root.querySelector('[data-testid="boot-failure"]')?.getAttribute('data-code')).toBe('unsupported')
  })
})
