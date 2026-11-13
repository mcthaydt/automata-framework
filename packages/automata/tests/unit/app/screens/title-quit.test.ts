import { defineComponent, definePlugin } from '@automata/sim'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { RuntimeHandle } from '#src/app/boot/game-definition.ts'
import { runGame } from '#src/app/boot/run-game.ts'
import { defineGame } from '#src/app/define-game.ts'
import { SEEN_KEY } from '#src/app/opening/seen-flags.ts'
import { defineSave } from '#src/features/saves/save.schema.ts'
import { ok } from '#src/shared/lib/result.ts'
import type { RendererFactory } from '#src/shared/runtime/render/renderer.ts'
import type { DeviceStorage } from '#src/shared/runtime/settings/device-storage.ts'
import { type FakeHostingOptions, fakeHosting } from '#src/testing/host/fake-hosting.ts'
import type { FakeTarget } from '#src/testing/host/target-grants.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { type ManualFrames, manualFrames } from '#src/testing/runtime/manual-frames.ts'

// The title's Quit: on the desktop leaving the game is quitting the app, and the player should not have to find the
// window's close box to do it. Elsewhere the browser or Ruken owns leaving, so the title offers nothing.
const Body = defineComponent('body', { x: 'f32' })
const square = definePlugin({ name: 'square', defs: [Body] })

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  flushSync()
}
async function until(check: () => boolean, what: string): Promise<void> {
  for (let tries = 0; tries < 400; tries++) {
    if (check()) return
    await tick()
  }
  throw new Error(`timed out waiting for ${what}`)
}

/** Pixi needs WebGL, which jsdom lacks: a renderer that draws nothing. */
const nullRenderer: RendererFactory = async () =>
  ok({ apply: () => {}, draw: () => {}, reset: () => {}, dispose: () => {} })

/** Device storage that says the first-run screens were shown, and holds nothing else. */
const firstRunSeen: DeviceStorage = {
  get: (key) => (key === SEEN_KEY ? '{"language":true,"photosensitivity":true}' : null),
  set: () => {},
  remove: () => {},
}

describe("the title's Quit", () => {
  let root: HTMLElement
  let frames: ManualFrames
  let handle: RuntimeHandle | undefined
  let host: ReturnType<typeof fakeHosting>

  const button = (testId: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)

  async function boot(target: FakeTarget, granted?: FakeHostingOptions['granted']): Promise<void> {
    host = fakeHosting({ target, ...(granted === undefined ? {} : { granted }) })
    const game = defineGame({
      id: 'quit-test',
      title: 'Square',
      size: { width: 320, height: 180 },
      sim: { plugins: [square], seed: 1 },
      root,
      seams: { frames, fetch: fakeFetch({}).fetch, deviceStorage: firstRunSeen, hosting: host.make },
    })
    handle = runGame({ ...game, root, renderer: nullRenderer })
    await until(() => frames.pending, 'the first frame')
    frames.advance(1000 / 60)
    await until(() => root.querySelector('[data-testid="title-screen"]') !== null, 'the title screen')
  }

  beforeEach(() => {
    root = document.createElement('div')
    document.body.append(root)
    frames = manualFrames()
  })

  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    root.remove()
  })

  it.each(['web', 'itch', 'ruken'] as const)(
    'is not on the title on %s, where the host owns leaving',
    async (target) => {
      await boot(target)
      expect(button('play')).not.toBeNull()
      expect(button('quit-app')).toBeNull()
    },
  )

  it('is on the desktop title beside Play, sized as a primary, and quits the app through the host', async () => {
    await boot('tauri')
    const quit = button('quit-app')
    expect(quit?.textContent).toBe('Quit')
    // The same row as Play, after it: Tab and the pad's focus steps reach it from Play.
    const row = [...(button('play')?.parentElement?.querySelectorAll('button') ?? [])]
    expect(row.map((each) => each.dataset.testid)).toEqual(['play', 'quit-app'])
    expect(host.control.exits).toEqual([])
    quit?.click()
    await until(() => host.control.exits.length > 0, 'the exit')
    expect(host.control.exits).toEqual(['player'])
  })

  it('is not on the desktop title when the host has not granted exit', async () => {
    await boot('tauri', ['lifecycle', 'input', 'display', 'audio', 'saves', 'links'])
    expect(button('quit-app')).toBeNull()
  })

  it('takes focus, and Enter on it is left to the button: the title does not start the game instead', async () => {
    await boot('tauri')
    const quit = button('quit-app')
    quit?.focus()
    expect(document.activeElement).toBe(quit)
    quit?.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true, cancelable: true }),
    )
    for (let index = 0; index < 5; index++) await tick()
    expect(root.querySelector('[data-testid="play-screen"]')).toBeNull()
    expect(root.querySelector('[data-testid="title-screen"]')).not.toBeNull()
  })

  it("is there with a save too, where the slots take Play's place", async () => {
    host = fakeHosting({ target: 'tauri' })
    const game = defineGame({
      id: 'quit-saves-test',
      title: 'Square',
      size: { width: 320, height: 180 },
      sim: { plugins: [square], seed: 1 },
      saves: {
        def: defineSave({
          key: 'run',
          version: 1,
          schema: z.object({}),
          empty: () => ({}),
          migrations: {},
          slots: { count: 1 },
        }),
        capture: () => ({}),
        apply: () => {},
        label: () => 'Run',
      },
      root,
      seams: { frames, fetch: fakeFetch({}).fetch, deviceStorage: firstRunSeen, hosting: host.make },
    })
    handle = runGame({ ...game, root, renderer: nullRenderer })
    await until(() => frames.pending, 'the first frame')
    frames.advance(1000 / 60)
    await until(() => root.querySelector('[data-testid="title-screen"]') !== null, 'the title screen')
    expect(button('play')).toBeNull()
    expect(button('quit-app')).not.toBeNull()
  })
})
