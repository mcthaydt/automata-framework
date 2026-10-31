import type { DefinedGame } from '@mcthaydt/automata-game'
import {
  type GameRenderer,
  type RendererFactory,
  type RuntimeHandle,
  runGame,
} from '@mcthaydt/automata-runtime'
import { fakeFetch, type ManualFrames, manualFrames } from '@mcthaydt/automata-runtime/testing'
import type { StepResult } from '@mcthaydt/automata-sim'
import { createFakeHost, type FakeHost, type FakeHostOptions } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { metres } from '../constants.ts'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { base3d } from '../main.ts'
import { newGame } from '../state/save.ts'
import { SPLASH_MS } from './screens.ts'

// base-3d's flow on the real runtime (M3.7b part 4) in jsdom: the in-memory fake Ruken host, manual frames, and a
// renderer that keeps each step (Pixi 3D needs WebGL2, which jsdom lacks). The props' models are not fetched here:
// the recording renderer draws nothing, so the game runs with no preload.

const STEP_MS = 1000 / 60

const hostOptions = (): FakeHostOptions => ({
  gameOrigin: window.location.origin,
  gameId: base3d.id,
  clock: {
    epochMs: () => Date.now(),
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (timer: unknown) => clearTimeout(timer as number),
  },
})

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

  /** The fake host sends a write to its server a second after the last (Ruken's sync debounce): waits for it. */
  async function synced(check: () => boolean, what: string): Promise<void> {
    for (let tries = 0; tries < 150 && !check(); tries++)
      await new Promise((resolve) => setTimeout(resolve, 20))
    if (!check())
      throw new Error(`timed out waiting for ${what}: ${JSON.stringify([...host.fakes.server.slots])}`)
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

  /** A slot as the runtime stores it (its envelope), for the fake host to hold before boot. */
  const stored = (fields: { version?: number; data?: unknown } = {}) =>
    JSON.stringify({ format: 1, version: 1, contentHash: 'any', savedAt: 1000, data: newGame(), ...fields })
  const byTestId = (id: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)

  /** Replaces the host with one built from `options` (a seeded slot, or no saves granted). */
  function hostWith(options: Partial<FakeHostOptions>): void {
    host.dispose()
    host = createFakeHost({ ...hostOptions(), ...options })
  }

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
    await until(() => byTestId('save-slots-new') !== null, 'New game')
    byTestId('save-slots-new')?.click()
    await until(() => screen() === 'play', 'the room')
  }

  async function toMenu(): Promise<void> {
    await boot()
    key('keydown', 'KeyX')
    await until(() => screen() === 'title', 'the menu')
    await until(
      () => root.querySelector('[data-save-slots]')?.getAttribute('data-state') === 'slots',
      'the slots',
    )
  }

  /**
   * The host closes the game (Ruken's `session.exiting`): the game hands the host everything it holds, so a check that
   * nothing was written comes after it.
   */
  async function closeGame(): Promise<void> {
    await host.bridge.exit()
    await handle?.shutdown()
    handle = undefined
    for (let turn = 0; turn < 20; turn++) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    root = document.body.appendChild(document.createElement('main'))
    root.id = 'game'
    frames = manualFrames()
    results = []
    resize(844, 390)
    host = createFakeHost(hostOptions())
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

  it('shows the splash once ready, then the menu on any key, with New game focused', async () => {
    await boot()
    expect(document.documentElement.dataset.state).toBe('ready')
    expect(root.querySelector('[data-game-screen="splash"]')?.textContent).toContain('The Cold Kiln')
    key('keydown', 'KeyX')
    await until(() => screen() === 'title', 'the menu')
    await until(() => byTestId('save-slots-new') !== null, 'New game')
    expect(button('Play')).toBeUndefined()
    expect(document.activeElement).toBe(byTestId('save-slots-new'))
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

  it('Quit ends the round and goes to the menu, whose Continue starts again at tick 0', async () => {
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
    await until(() => byTestId('save-slots-load') !== null, 'Continue')
    byTestId('save-slots-load')?.click()
    await until(() => screen() === 'play', 'the room')
    step()
    expect(results[0]?.tick).toBe(1)
  })

  it('Wick picks up the ember in the kiln: the round completes, the end screen shows the time, and Menu keeps the ember in the slot', async () => {
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
    // The ember is kept: leaving play wrote the slot, and Continue plays it.
    const kept = () =>
      (JSON.parse(host.fakes.server.slots.get('base-3d')?.value ?? '{}') as { data?: { embers: number } })
        .data
    await synced(() => kept()?.embers === 1, 'the slot holding the ember')
    results.length = 0
    await until(() => byTestId('save-slots-load') !== null, 'Continue')
    byTestId('save-slots-load')?.click()
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

  describe('the save (DESIGN.md §12.1, G3-F3, G3-F4)', () => {
    /** The slot as the fake host's server holds it. */
    const slotValue = () => host.fakes.server.slots.get(base3d.saves?.key ?? '')?.value

    it('offers New game, and no Continue, while the slot is empty', async () => {
      await toMenu()
      expect(byTestId('save-slots-new')).not.toBeNull()
      expect(byTestId('save-slots-load')).toBeNull()
    })

    it('offers Continue on a ready slot and no New game over it: a new game there is Delete…, asked first', async () => {
      hostWith({ saves: { 'base-3d': stored({ data: { ...newGame(), embers: 1 } }) } })
      await toMenu()
      expect(byTestId('save-slots-load')).not.toBeNull()
      expect(byTestId('save-slots-new')).toBeNull()
      byTestId('save-slots-delete')?.click()
      await until(() => byTestId('save-slots-confirm') !== null, 'the delete question')
      expect(slotValue()).toBeDefined()
      byTestId('save-slots-confirm')?.click()
      await until(() => byTestId('save-slots-new') !== null, 'New game on the emptied slot')
    })

    it('Continue plays the slot: the embers it holds are kept by the next write', async () => {
      hostWith({ saves: { 'base-3d': stored({ data: { ...newGame(), embers: 1, flags: ['door-1'] } }) } })
      await toMenu()
      byTestId('save-slots-load')?.click()
      await until(() => screen() === 'play', 'the room')
      expect(results.at(-1)?.tick ?? 0).toBe(0)
      step(3)
      key('keydown', 'Escape')
      await until(() => screen() === 'paused', 'paused')
      // The seed's play time is 0: a write with time on it is this session's, over the seed's other fields.
      const saved = () =>
        (JSON.parse(slotValue() ?? '{}') as { data?: { embers: number; flags: string[]; playTicks: number } })
          .data
      await synced(() => (saved()?.playTicks ?? 0) > 0, 'the write from play')
      expect(saved()).toMatchObject({ embers: 1, flags: ['door-1'], playTicks: 3 })
    })

    it('a slot a newer build saved cannot be continued, says why, and is never written (G3-F3)', async () => {
      const newer = stored({ version: 2 })
      hostWith({ saves: { 'base-3d': newer } })
      await toMenu()
      expect(root.querySelector('[data-save-slots]')?.textContent).toContain(
        'Saved by a newer version of the game',
      )
      expect(byTestId('save-slots-load')).toBeNull()
      expect(byTestId('save-slots-new')).toBeNull()
      await closeGame()
      expect(slotValue()).toBe(newer)
    })

    it('an unreadable slot is kept as it is: the only action is Delete…, which asks first (G3-F3)', async () => {
      hostWith({ saves: { 'base-3d': 'not a save' } })
      await toMenu()
      expect(root.querySelector('[data-save-slots]')?.textContent).toContain("This save can't be opened")
      expect(byTestId('save-slots-load')).toBeNull()
      expect(byTestId('save-slots-new')).toBeNull()
      byTestId('save-slots-delete')?.click()
      await until(() => byTestId('save-slots-cancel') !== null, 'the delete question')
      byTestId('save-slots-cancel')?.click()
      await closeGame()
      expect(slotValue()).toBe('not a save')
    })

    it("under a host that refuses saves, paused says once that progress won't be kept, and nothing is stored on the device (G3-F4)", async () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      // jsdom has no indexedDB; where there is one, nothing opens it.
      const open = globalThis.indexedDB === undefined ? undefined : vi.spyOn(globalThis.indexedDB, 'open')
      try {
        hostWith({ grant: [] })
        await toRoom()
        step(3)
        key('keydown', 'Escape')
        await until(() => screen() === 'paused', 'paused')
        await until(
          () => root.querySelector<HTMLElement>('[data-save-status]')?.dataset.state === 'no-grant',
          'the no-grant line',
        )
        expect(root.querySelectorAll('[data-save-status]')).toHaveLength(1)
        expect(root.querySelector('[data-save-status]')?.textContent).toContain("Progress won't be kept")
        await closeGame()
        expect(setItem).not.toHaveBeenCalled()
        if (open !== undefined) expect(open).not.toHaveBeenCalled()
      } finally {
        setItem.mockRestore()
        open?.mockRestore()
      }
    })
  })
})
