import { render3dExtension } from '@automata/3d'
import type { DefinedGame } from '@automata/framework'
import { type RendererFactory, type RuntimeHandle, runGame } from '@automata/framework'
import {
  type FakeHostingOptions,
  fakeFetch,
  fakeHosting,
  type ManualFrames,
  manualFrames,
} from '@automata/framework/testing'
import type { StepResult } from '@automata/sim'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { base3d, input } from '../main.ts'
import { Progress } from '../resources.ts'
import { base3dSim } from '../state/index.ts'
import { newGame } from '../state/save.ts'
import { compileArea } from '../systems/index.ts'
import { liveCopy } from './copy.svelte.ts'
import { BASE3D_COPY } from './copy.ts'
import { hudInPlay } from './hud.ts'
import { base3dSaves } from './saves.ts'
import { base3dScreens, SPLASH_MS } from './screens.ts'
import type { Base3dSettings } from './settings.ts'

// base-3d's flow on the real runtime (M3.7b part 4) in jsdom: AF's fake host (DIST spec §7), manual frames, and a
// renderer that keeps each step (Pixi 3D needs WebGL2, which jsdom lacks). The props' models are not fetched here:
// the recording renderer draws nothing, so the game runs with no preload.

const STEP_MS = 1000 / 60

describe("base-3d's flow", () => {
  let root: HTMLElement
  let frames: ManualFrames
  let results: StepResult[]
  let host: ReturnType<typeof fakeHosting>
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
  /** The rounds the host received, as `{ kind, outcome? }`. */
  const rounds = () =>
    host.control.rounds.map((round) =>
      'start' in round
        ? { kind: 'start' }
        : round.end === undefined
          ? { kind: 'end' }
          : { kind: 'end', outcome: round.end },
    )
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

  /** Waits for the host to hold what the game wrote (the save service writes on its own schedule). */
  async function synced(check: () => boolean, what: string): Promise<void> {
    for (let tries = 0; tries < 150 && !check(); tries++)
      await new Promise((resolve) => setTimeout(resolve, 20))
    if (!check()) throw new Error(`timed out waiting for ${what}: ${JSON.stringify([...host.control.saved])}`)
  }

  /** Steps with `code` held until `done`, at most `limit` ticks, then releases it. */
  async function hold(code: string, done: () => boolean, limit = 400): Promise<void> {
    key('keydown', code)
    for (let ticks = 0; ticks < limit && !done(); ticks++) step()
    key('keyup', code)
    expect(done()).toBe(true)
  }

  const recording: RendererFactory = async () => ({
    ok: true,
    value: { apply: (result) => results.push(result), draw: () => {}, reset: () => {}, dispose: () => {} },
  })

  /** A slot as the runtime stores it (its envelope), for the fake host to hold before boot. */
  const stored = (fields: { version?: number; data?: unknown } = {}) =>
    JSON.stringify({ format: 1, version: 1, contentHash: 'any', savedAt: 1000, data: newGame(), ...fields })
  const byTestId = (id: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)

  /** Replaces the host with one built from `options` (a seeded slot, or no saves granted). */
  function hostWith(options: FakeHostingOptions): void {
    host = fakeHosting(options)
  }

  async function boot(screens?: DefinedGame<Base3dSettings>['screens']): Promise<void> {
    const game: DefinedGame<Base3dSettings> = base3d
    handle = runGame({
      ...game,
      ...(screens === undefined ? {} : { screens }),
      root,
      renderer: recording,
      preload: [],
      seams: { frames, fetch: fakeFetch({}).fetch, hosting: host.make },
    })
    await until(() => frames.pending, 'the first frame')
    step()
    await until(() => screen() === 'splash', 'the splash')
  }

  async function toRoom(screens?: DefinedGame<Base3dSettings>['screens']): Promise<void> {
    await boot(screens)
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
   * The host closes the game: the game hands the host everything it holds, so a check that
   * nothing was written comes after it.
   */
  async function closeGame(): Promise<void> {
    await host.control.close()
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
    host = fakeHosting()
  })
  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    root.remove()
    resize(size.width, size.height)
    Reflect.deleteProperty(window, 'matchMedia')
    document.documentElement.removeAttribute('data-state')
  })

  it('shows the splash once ready, then the menu on any key, with New game focused', async () => {
    await boot()
    expect(document.documentElement.dataset.state).toBe('ready')
    expect(root.querySelector('[data-game-screen="splash"]')?.textContent).toContain('Ember Hall')
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
    button('Back to menu')?.click()
    await until(() => button('Keep playing') !== undefined, 'the quit question')
    button('Leave')?.click()
    await until(() => screen() === 'title', 'the menu')
    expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'quit' }])
    results.length = 0
    await until(() => byTestId('save-slots-load') !== null, 'Continue')
    byTestId('save-slots-load')?.click()
    await until(() => screen() === 'play', 'the room')
    step()
    expect(results[0]?.tick).toBe(1)
  })

  it('on touch, the stick walks Wick, the camera drag surface is there and the Roll button is on the play screen', async () => {
    await toRoom()
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))
    await until(() => root.querySelector('[data-touch-stick]') !== null, 'the touch stick')
    expect(root.querySelector('[data-testid="camera-drag"]')).not.toBeNull()
    const labels = [...root.querySelectorAll('[data-touch-overlay] [data-action]')].map((b) =>
      b.textContent?.trim(),
    )
    expect(labels).toEqual(['Roll'])
    step(2)
    const fromZ = wick()?.z ?? 0
    const stick = root.querySelector('[data-touch-stick]') as HTMLElement
    const pointer = (type: string, clientY: number) =>
      stick.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 5,
          pointerType: 'touch',
          clientX: 40,
          clientY,
          bubbles: true,
          cancelable: true,
        }),
      )
    pointer('pointerdown', 80)
    pointer('pointermove', 0)
    step(30)
    expect(wick()?.z ?? 0).toBeGreaterThan(fromZ)
    pointer('pointerup', 0)
    step(2)
    const stopped = wick()?.z ?? 0
    step(10)
    expect(wick()?.z).toBe(stopped)
  })

  it('the goal ember completes the round: the end screen shows the time, and Menu keeps the embers in the slot', async () => {
    // A room with its goal one metre ahead of the spawn, so the keyboard reaches it in a few ticks.
    const near = compileArea({
      id: 'near',
      spawn: { x: 0, z: 0 },
      views: [{ id: 'open', yawDeg: 0 }],
      rooms: [{ view: 'open', min: [-5, -5], max: [5, 5] }],
      walls: [],
      pits: [],
      embers: [{ x: 0, z: 1 }],
      goal: { x: 0, z: 2.5 },
    })
    await toRoom(
      base3dScreens({
        title: base3d.title,
        sim: base3dSim(near),
        input,
        extensions: [render3dExtension],
        saves: base3dSaves() as never,
      }),
    )
    key('keydown', 'KeyW')
    step(70)
    key('keyup', 'KeyW')
    await until(() => screen() === 'end', 'the end screen')
    // The time is the tick the goal was taken on, in seconds: under the 70 ticks the key was held.
    const time = Number.parseFloat(root.querySelector('[data-slot="time"]')?.textContent ?? '')
    expect(time).toBeGreaterThan(0)
    expect(time).toBeLessThan(70 / 60)
    expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'complete' }])
    expect(document.activeElement).toBe(button('Menu'))
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
    const slotValue = () => host.control.saved.get(base3d.saves?.key ?? '')

    it('offers New game, and no Continue, while the slot is empty', async () => {
      await toMenu()
      expect(byTestId('save-slots-new')).not.toBeNull()
      expect(byTestId('save-slots-load')).toBeNull()
    })

    it('offers Continue on a ready slot and no New game over it: a new game there is Delete…, asked first', async () => {
      hostWith({ saves: { 'base-3d-free': stored({ data: { ...newGame(), taken: [0] } }) } })
      await toMenu()
      expect(byTestId('save-slots-load')).not.toBeNull()
      expect(byTestId('save-slots-new')).toBeNull()
      byTestId('save-slots-delete')?.click()
      await until(() => byTestId('save-slots-confirm') !== null, 'the delete question')
      expect(slotValue()).toBeDefined()
      byTestId('save-slots-confirm')?.click()
      await until(() => byTestId('save-slots-new') !== null, 'New game on the emptied slot')
    })

    it('Continue plays the slot: what it holds is kept by the next write', async () => {
      hostWith({ saves: { 'base-3d-free': stored({ data: { ...newGame(), taken: [0], note: 'kept' } }) } })
      await toMenu()
      byTestId('save-slots-load')?.click()
      await until(() => screen() === 'play', 'the room')
      expect(results.at(-1)?.tick ?? 0).toBe(0)
      step(3)
      key('keydown', 'Escape')
      await until(() => screen() === 'paused', 'paused')
      // The seed's play time is 0: a write with time on it is this session's, over the seed's other fields.
      const saved = () =>
        (JSON.parse(slotValue() ?? '{}') as { data?: { taken: number[]; note: string; playTicks: number } })
          .data
      await synced(() => (saved()?.playTicks ?? 0) > 0, 'the write from play')
      expect(saved()).toMatchObject({ taken: [0], note: 'kept', playTicks: 3 })
    })

    it('a slot a newer build saved cannot be continued, says why, and is never written (G3-F3)', async () => {
      const newer = stored({ version: 2 })
      hostWith({ saves: { 'base-3d-free': newer } })
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
      hostWith({ saves: { 'base-3d-free': 'not a save' } })
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
        // Every capability a page can observe, without saves (storage blocked).
        hostWith({ granted: ['lifecycle', 'input', 'display', 'audio'] })
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

  describe('the HUD', () => {
    const hud = () => root.querySelector<HTMLElement>('[data-testid="hud"]')
    const running = () => {
      if (hudInPlay.sim === undefined) throw new Error('no running sim')
      return hudInPlay.sim
    }
    /** The HUD reads the sim on the next animation frame. */
    const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve))

    it('shows the ember count on play, inside the frame, follows the sim, and is gone on paused', async () => {
      await toRoom()
      await until(() => hud() !== null, 'the HUD')
      expect(root.querySelector('[data-testid="play-screen"]')?.contains(hud())).toBe(true)
      expect(root.querySelector('[data-testid="hud-embers"]')?.textContent?.trim()).toBe('0')
      expect(root.querySelector('[data-testid="hud-embers"]')?.getAttribute('aria-label')).toBe(
        'Embers 0 of 6',
      )
      running().resource(Progress).taken = [0, 1]
      await nextFrame()
      expect(root.querySelector('[data-testid="hud-embers"]')?.textContent?.trim()).toBe('2')
      key('keydown', 'Escape')
      await until(() => screen() === 'paused', 'paused')
      expect(hud()).toBeNull()
    })
  })
})
