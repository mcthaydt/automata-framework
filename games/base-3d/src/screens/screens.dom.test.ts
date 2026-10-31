import type { DefinedGame } from '@mcthaydt/automata-game'
import {
  type GameRenderer,
  type RendererFactory,
  type RuntimeHandle,
  runGame,
} from '@mcthaydt/automata-runtime'
import { fakeFetch, type ManualFrames, manualFrames } from '@mcthaydt/automata-runtime/testing'
import type { StepResult } from '@mcthaydt/automata-sim'
import { createFakeHost, type FakeHost } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { metres } from '../constants.ts'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { base3d } from '../main.ts'
import { SPLASH_MS } from './screens.ts'

// base-3d's flow on the real runtime (M3.7b part 4) in jsdom: the in-memory fake Ruken host, manual frames, and a
// renderer that keeps each step (Pixi 3D needs WebGL2, which jsdom lacks). The props' models are not fetched here:
// the recording renderer draws nothing, so the game runs with no preload.

const STEP_MS = 1000 / 60

describe("base-3d's flow", () => {
  let root: HTMLElement
  let frames: ManualFrames
  let results: StepResult[]
  let host: FakeHost
  let handle: RuntimeHandle | undefined
  const size = { width: window.innerWidth, height: window.innerHeight }

  /** The screen the flow shows: the runtime marks each screen's layer with its id. */
  const screen = () => {
    const shown = [...root.querySelectorAll<HTMLElement>('[data-screen]')].map(
      (layer) => layer.dataset.screen,
    )
    return shown.length === 1 ? shown[0] : undefined
  }
  const button = (name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
    )
  const key = (type: 'keydown' | 'keyup', code: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }))
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) frames.advance(STEP_MS)
  }
  const rounds = () =>
    host.messages
      .filter((entry) => entry.dir === 'in' && entry.msg.type === 'telemetry.round')
      .map((entry) => entry.msg.payload)
  /** Wick's place from the last render row that carried him. */
  const wick = () => {
    const rows = results.flatMap((result) => [...result.render.added, ...result.render.changed])
    return rows.findLast((row) => row.components.hero !== undefined)?.components.hero as {
      x: number
      z: number
    }
  }
  const resize = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
    window.dispatchEvent(new Event('resize'))
  }

  async function until(check: () => boolean, what: string): Promise<void> {
    for (let tries = 0; tries < 400; tries++) {
      if (check()) return
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    throw new Error(
      `timed out waiting for ${what}: ${[...root.querySelectorAll<HTMLElement>('[data-screen]')].map((l) => l.dataset.screen)} ${root.textContent?.slice(0, 300)}`,
    )
  }

  /** Steps with `code` held until `done`, at most `limit` ticks, then releases it. */
  async function hold(code: string, done: () => boolean, limit = 400): Promise<void> {
    key('keydown', code)
    for (let ticks = 0; ticks < limit && !done(); ticks++) step()
    key('keyup', code)
    expect(done()).toBe(true)
  }

  const recording: RendererFactory = () =>
    Effect.succeed<GameRenderer>({ apply: (result) => results.push(result), draw: () => {}, reset: () => {} })

  async function boot(): Promise<void> {
    const game: DefinedGame = base3d
    handle = runGame({
      ...game,
      root,
      renderer: recording,
      preload: [],
      seams: { frames, fetch: fakeFetch({}).fetch, sdkEnv: () => host.gameEnv as never },
    })
    await until(() => frames.pending, 'the first frame')
    step()
    await until(() => screen() === 'splash', 'the splash')
  }

  async function toRoom(): Promise<void> {
    await boot()
    key('keydown', 'KeyX')
    await until(() => screen() === 'title', 'the menu')
    button('Play')?.click()
    await until(() => screen() === 'play', 'the room')
  }

  beforeEach(() => {
    root = document.body.appendChild(document.createElement('main'))
    root.id = 'game'
    frames = manualFrames()
    results = []
    resize(844, 390)
    host = createFakeHost({
      gameOrigin: window.location.origin,
      gameId: base3d.id,
      clock: {
        epochMs: () => Date.now(),
        setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
        clearTimeout: (timer: unknown) => clearTimeout(timer as number),
      },
    })
  })
  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    host.dispose()
    root.remove()
    resize(size.width, size.height)
    Reflect.deleteProperty(window, 'matchMedia')
    document.documentElement.removeAttribute('data-state')
  })

  it('shows the splash once ready, then the menu on any key, with Play focused', async () => {
    await boot()
    expect(document.documentElement.dataset.state).toBe('ready')
    expect(root.querySelector('[data-game-screen="splash"]')?.textContent).toContain('The Cold Kiln')
    key('keydown', 'KeyX')
    await until(() => screen() === 'title', 'the menu')
    expect(document.activeElement).toBe(button('Play'))
  })

  it('moves on from the splash by itself', async () => {
    await boot()
    await new Promise((resolve) => setTimeout(resolve, SPLASH_MS + 100))
    await until(() => screen() === 'title', 'the menu')
  })

  it('Play starts a round on a fresh sim; Escape and the pause button pause it, and Resume goes on', async () => {
    await toRoom()
    expect(rounds()).toEqual([{ kind: 'start' }])
    step(3)
    expect(results.at(-1)?.tick).toBe(3)
    key('keydown', 'Escape')
    await until(() => screen() === 'paused', 'paused')
    const applied = results.length
    step(5)
    expect(results.length).toBe(applied)
    button('Resume')?.click()
    await until(() => screen() === 'play', 'the room again')
    step()
    expect(results.at(-1)?.tick).toBe(4)
    button('Pause')?.click()
    await until(() => screen() === 'paused', 'paused by the button')
  })

  it('Quit ends the round and goes to the menu, whose Play starts again at tick 0', async () => {
    await toRoom()
    step(3)
    key('keydown', 'Escape')
    await until(() => screen() === 'paused', 'paused')
    // Quit asks first (the default paused screen): the run is lost.
    button('Quit to title')?.click()
    await until(() => button('Cancel') !== undefined, 'the quit question')
    const quits = [...root.querySelectorAll<HTMLButtonElement>('button')].filter(
      (candidate) => candidate.textContent?.trim() === 'Quit to title',
    )
    quits.at(-1)?.click()
    await until(() => screen() === 'title', 'the menu')
    expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'quit' }])
    results.length = 0
    button('Play')?.click()
    await until(() => screen() === 'play', 'the room')
    step()
    expect(results[0]?.tick).toBe(1)
  })

  it('Wick picks up the ember in the kiln: the round completes and the end screen shows the time, then Menu', async () => {
    await toRoom()
    const { x, z } = FIRST_SLICE.ember
    // North through the doorway into the kiln, to the ember's row; then, on the kiln's heading (the camera looks
    // +x), the stick down walks him −x to it.
    await hold('KeyW', () => (wick()?.z ?? 0) >= metres(z))
    await hold('KeyS', () => (wick()?.x ?? 0) <= metres(x))
    expect(screen()).toBe('play')
    key('keydown', 'KeyF')
    step()
    key('keyup', 'KeyF')
    await until(() => screen() === 'end', 'the end screen')
    const tick = results.at(-1)?.tick ?? 0
    expect(root.querySelector('[data-slot="time"]')?.textContent).toBe(`${(tick / 60).toFixed(2)} s`)
    expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'complete' }])
    expect(document.activeElement).toBe(button('Menu'))
    button('Menu')?.click()
    await until(() => screen() === 'title', 'the menu')
    results.length = 0
    button('Play')?.click()
    await until(() => screen() === 'play', 'the room')
    step()
    expect(results[0]?.tick).toBe(1)
  })

  it('held in portrait on a phone, covers the game with the rotate hint until turned back', async () => {
    resize(390, 844)
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (media: string) => ({
        matches: media.includes('pointer: coarse'),
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
    await boot()
    await until(() => root.querySelector('[data-testid="rotate-hint"]') !== null, 'the rotate hint')
    resize(844, 390)
    await until(() => root.querySelector('[data-testid="rotate-hint"]') === null, 'the hint gone')
  })
})
