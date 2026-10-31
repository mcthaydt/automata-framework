import type { DefinedGame } from '@mcthaydt/automata-game'
import { render3dExtension } from '@mcthaydt/automata-render-pixi3d'
import {
  type GameRenderer,
  type RendererFactory,
  type RuntimeHandle,
  runGame,
} from '@mcthaydt/automata-runtime'
import { fakeFetch, type ManualFrames, manualFrames } from '@mcthaydt/automata-runtime/testing'
import type { StepResult } from '@mcthaydt/automata-sim'
import { definePlugin, defineSystem } from '@mcthaydt/automata-sim'
import { createFakeHost, type FakeHost, type FakeHostOptions } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Enemy, Fighter, Hero } from '../components.ts'
import { ENEMIES } from '../constants/enemies.ts'
import { AREA_FADE_TICKS, metres } from '../constants/index.ts'
import { ItemCode } from '../constants/items.ts'
import { FIRST_SLICE } from '../content/first-slice.ts'
import { HeroDefeated } from '../events.ts'
import { base3d, input } from '../main.ts'
import { Inventory } from '../resources.ts'
import { base3dSim } from '../state/index.ts'
import { newGame } from '../state/save.ts'
import { compileWorld } from '../systems/index.ts'
import { hudInPlay } from './hud.ts'
import { base3dSaves } from './saves.ts'
import { base3dScreens, SPLASH_MS } from './screens.ts'
import type { Base3dSettings } from './settings.ts'

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
  const spawnZOf = () => metres(FIRST_SLICE.spawn.z)
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

  async function boot(screens?: DefinedGame<Base3dSettings>['screens']): Promise<void> {
    const game: DefinedGame<Base3dSettings> = base3d
    handle = runGame({
      ...game,
      ...(screens === undefined ? {} : { screens }),
      root,
      renderer: recording,
      preload: [],
      seams: { frames, fetch: fakeFetch({}).fetch, sdkEnv: () => host.gameEnv as never },
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

  describe('game over (DESIGN.md §7.8, §13)', () => {
    // Health is GAME-3D.1c's: until it lands, a test plugin raises the sim's `hero.defeated` once Wick is a metre
    // north of the spawn, on the game's own screens over that sim.
    const spawnZ = metres(FIRST_SLICE.spawn.z)
    const defeatNorth = definePlugin({
      name: 'test-defeat',
      dependsOn: ['base-3d'],
      defs: [
        defineSystem({
          name: 'test.defeat',
          phase: 'postPhysics',
          run(ctx) {
            for (const entity of ctx.query(Hero))
              if (entity.get(Hero).z >= spawnZ + metres(1)) ctx.emit(HeroDefeated, {})
          },
        }),
      ],
    })
    const defeatable = () => {
      const sim = base3dSim(compileWorld([FIRST_SLICE]))
      return base3dScreens({
        title: base3d.title,
        sim: { ...sim, plugins: [...sim.plugins, defeatNorth] },
        input,
        extensions: [render3dExtension],
        saves: base3dSaves() as never,
      })
    }

    async function toGameOver(): Promise<void> {
      await toRoom(defeatable())
      await hold('KeyW', () => (wick()?.z ?? spawnZ) >= spawnZ + metres(1))
      // The step's events reach the screens with the next frame.
      step()
      await until(() => screen() === 'game-over', 'the game over')
    }

    it('shows Continue, focused, and Quit when Wick is defeated, and ends the round as failed', async () => {
      await toGameOver()
      expect(button('Continue')).toBeDefined()
      expect(button('Quit')).toBeDefined()
      expect(document.activeElement).toBe(button('Continue'))
      expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'fail' }])
    })

    it('Continue plays on from the area entrance in a new round', async () => {
      await toGameOver()
      results.length = 0
      button('Continue')?.click()
      await until(() => screen() === 'play', 'the room')
      step()
      expect(wick()).toMatchObject({ x: metres(FIRST_SLICE.spawn.x), z: spawnZ })
      // With 3 hearts (DESIGN.md §7.8), whatever the entrance held.
      const rows = results.flatMap((result) => [...result.render.added, ...result.render.changed])
      expect(rows.findLast((row) => row.components.hero !== undefined)?.components.fighter).toMatchObject({
        health: 6,
      })
      expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'fail' }, { kind: 'start' }])
    })

    it('Quit goes to the menu', async () => {
      await toGameOver()
      button('Quit')?.click()
      await until(() => screen() === 'title', 'the menu')
      expect(rounds()).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'fail' }])
    })
  })

  describe('the Lock mode setting (DESIGN.md §12.2)', () => {
    const lockMode = (mode: 'toggle' | 'hold') =>
      root.querySelector<HTMLInputElement>(
        `[data-testid="lock-mode-${mode}"] input, input[data-testid="lock-mode-${mode}"]`,
      )

    async function toSettings(): Promise<void> {
      await toRoom()
      key('keydown', 'Escape')
      await until(() => screen() === 'paused', 'paused')
      button('Settings')?.click()
      await until(() => screen() === 'settings', 'Settings')
    }

    it('offers Toggle and Hold in its own section, Toggle by default', async () => {
      await toSettings()
      const section = root.querySelector('[data-settings-section="lock-mode"]')
      expect(section?.textContent).toContain('Lock mode')
      expect(lockMode('toggle')?.checked).toBe(true)
      expect(lockMode('hold')?.checked).toBe(false)
    })

    /** Wick's lock target from the last render row that carried him; 0 when none. */
    const locked = () => {
      const rows = results.flatMap((result) => [...result.render.added, ...result.render.changed])
      return Number(
        rows.findLast((row) => row.components.hero !== undefined)?.components.hero?.lockTarget ?? 0,
      )
    }
    /** Shift pressed for a tick and let go, then a few ticks more. */
    const tapLock = () => {
      key('keydown', 'ShiftLeft')
      step(2)
      key('keyup', 'ShiftLeft')
      step(3)
    }
    /** Walks Wick a few metres up the hall, toward the target in the kiln. */
    async function walkIn(): Promise<void> {
      const fromZ = wick()?.z ?? spawnZOf()
      await hold('KeyW', () => (wick()?.z ?? fromZ) >= fromZ + metres(4))
    }

    it('play locks in Toggle by default: the lock stays after Shift is let go, and the next press lets go', async () => {
      await toRoom()
      await walkIn()
      tapLock()
      expect(locked()).not.toBe(0)
      tapLock()
      expect(locked()).toBe(0)
    })

    it('play takes Hold from Settings: the lock lets go with Shift', async () => {
      await toSettings()
      lockMode('hold')?.click()
      button('Back')?.click()
      await until(() => screen() === 'paused', 'paused')
      button('Resume')?.click()
      await until(() => screen() === 'play', 'the room')
      await walkIn()
      key('keydown', 'ShiftLeft')
      step(3)
      expect(locked()).not.toBe(0)
      key('keyup', 'ShiftLeft')
      step(3)
      expect(locked()).toBe(0)
    })

    it("keeps Hold in the game's settings record on the player's account", async () => {
      await toSettings()
      lockMode('hold')?.click()
      expect(lockMode('hold')?.checked).toBe(true)
      await synced(
        () => (host.fakes.server.slots.get('settings')?.value ?? '').includes('"lockMode":"hold"'),
        'the settings record holding Hold',
      )
    })
  })

  describe('the area change (DESIGN.md §13)', () => {
    // Two first-slice areas, the first's exit across the hall a metre north of the spawn (GAME-3D.1i brings the hub
    // and the kiln).
    const twoAreas = () => {
      const first = {
        ...FIRST_SLICE,
        id: 'first',
        exits: [
          {
            min: [-4, -1] as [number, number],
            max: [4, -0.5] as [number, number],
            to: 'second',
            entry: { x: 0, z: 8 },
          },
        ],
      }
      return base3dScreens({
        title: base3d.title,
        sim: base3dSim(compileWorld([first, { ...FIRST_SLICE, id: 'second' }])),
        input,
        extensions: [render3dExtension],
        saves: base3dSaves() as never,
      })
    }
    const fade = () => root.querySelector<HTMLElement>('[data-testid="area-fade"]')

    it('fades out on the exit and back in once the sim has swapped the area', async () => {
      await toRoom(twoAreas())
      expect(fade()?.dataset.state).toBe('in')
      await hold('KeyW', () => (wick()?.z ?? spawnZOf()) >= metres(-1))
      step()
      await until(() => fade()?.dataset.state === 'out', 'the fade out')
      step(AREA_FADE_TICKS)
      await until(() => fade()?.dataset.state === 'in', 'the fade back in')
      expect(wick()?.z).toBeGreaterThanOrEqual(metres(8))
    })
  })
  describe('the HUD (DESIGN.md §9.5, GAME-3D.1e part 5a)', () => {
    const hud = () => root.querySelector<HTMLElement>('[data-testid="hud"]')
    const hearts = () =>
      [...root.querySelectorAll<SVGElement>('[data-testid="hud-hearts"] svg')].map(
        (heart) => heart.dataset.fill,
      )
    const running = () => {
      if (hudInPlay.sim === undefined) throw new Error('no running sim')
      return hudInPlay.sim
    }
    /** The HUD reads the sim on the next animation frame. */
    const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve))

    it('shows Wick’s 4 hearts and the embers on play, inside the frame, and is gone on paused', async () => {
      await toRoom()
      await until(() => hud() !== null, 'the HUD')
      expect(root.querySelector('[data-testid="play-screen"]')?.contains(hud())).toBe(true)
      expect(hearts()).toEqual(['full', 'full', 'full', 'full'])
      expect(root.querySelector('[data-testid="hud-hearts"]')?.getAttribute('aria-label')).toBe(
        'Hearts 4 of 4',
      )
      expect(root.querySelector('[data-testid="hud-embers"]')?.textContent?.trim()).toBe('0')
      expect(root.querySelector('[data-testid="hud-item"]')).toBeNull()
      expect(root.querySelector('[data-testid="hud-boss"]')).toBeNull()
      key('keydown', 'Escape')
      await until(() => screen() === 'paused', 'paused')
      expect(hud()).toBeNull()
    })

    it('loses half-hearts as Wick is hurt, flashing the hearts', async () => {
      await toRoom()
      await until(() => hud() !== null, 'the HUD')
      const [wick] = running().query(Hero, Fighter)
      wick?.set(Fighter, { health: 5 })
      await until(() => hearts().join() === 'full,full,half,empty', 'the hearts after the hurt')
      expect(root.querySelector('.b3-hud__hearts--flash')).not.toBeNull()
      await new Promise((resolve) => setTimeout(resolve, 450))
      await nextFrame()
      expect(root.querySelector('.b3-hud__hearts--flash')).toBeNull()
    })

    it('shows the equipped item and its ammo, and the boss bar while a Warden lives', async () => {
      await toRoom()
      await until(() => hud() !== null, 'the HUD')
      Object.assign(running().resource(Inventory), { sling: true, equipped: ItemCode.sling, pellets: 12 })
      const warden = ENEMIES.findIndex((type) => type.id === 'warden') + 1
      running().spawn([
        [Enemy, { kind: warden }],
        [Fighter, { health: 17 }],
      ])
      await until(() => root.querySelector('[data-testid="hud-boss"]') !== null, 'the boss bar')
      expect(root.querySelector('[data-testid="hud-item"]')?.textContent).toContain('Spark Sling')
      expect(root.querySelector('[data-testid="hud-item"]')?.textContent).toContain('× 12')
      const bar = root.querySelector<HTMLElement>('[data-testid="hud-boss"] [role="meter"]')
      expect(root.querySelector('[data-testid="hud-boss"]')?.textContent).toContain('The Ashen Warden')
      expect([bar?.getAttribute('aria-valuenow'), bar?.getAttribute('aria-valuemax')]).toEqual(['17', '24'])
      expect(bar?.getAttribute('aria-label')).toBe('The Ashen Warden health')
    })
  })
  describe('the Items screen (DESIGN.md §9.3, GAME-3D.1e part 5b)', () => {
    const running = () => {
      if (hudInPlay.sim === undefined) throw new Error('no running sim')
      return hudInPlay.sim
    }
    const slot = (id: string) => root.querySelector<HTMLButtonElement>(`[data-slot="${id}"]`)
    /** Wick owns the sling (12 pellets) and the hookchain, the sling equipped. */
    const ownSome = () =>
      Object.assign(running().resource(Inventory), {
        sling: true,
        hookchain: true,
        equipped: ItemCode.sling,
        pellets: 12,
      })

    it('opens with I over a paused sim, with the owned slots, the outlined ones and the ammo', async () => {
      await toRoom()
      ownSome()
      key('keydown', 'KeyI')
      await until(() => screen() === 'items', 'the Items screen')
      const applied = results.length
      step(5)
      expect(results.length).toBe(applied)
      expect([...root.querySelectorAll<HTMLElement>('[data-slot]')].map((el) => el.dataset.slot)).toEqual([
        'sword',
        'shield',
        'sling',
        'bombs',
        'hookchain',
      ])
      expect(slot('sling')?.dataset.owned).toBe('true')
      expect(slot('bombs')?.dataset.owned).toBe('false')
      expect(slot('bombs')?.getAttribute('aria-disabled')).toBe('true')
      expect(slot('sling')?.textContent).toContain('12 / 30')
      expect(slot('sling')?.getAttribute('aria-pressed')).toBe('true')
      expect(root.querySelector('[data-testid="items-embers"]')?.textContent).toContain('0')
    })

    it('opens from the HUD’s Items button', async () => {
      await toRoom()
      await until(() => byTestId('hud-items') !== null, 'the Items button')
      byTestId('hud-items')?.click()
      await until(() => screen() === 'items', 'the Items screen')
    })

    it('equips the chosen item on play’s first tick, and the HUD’s chip follows', async () => {
      await toRoom()
      ownSome()
      key('keydown', 'KeyI')
      await until(() => screen() === 'items', 'the Items screen')
      slot('hookchain')?.click()
      await until(() => slot('hookchain')?.getAttribute('aria-pressed') === 'true', 'the hookchain marked')
      expect(slot('sling')?.getAttribute('aria-pressed')).toBe('false')
      slot('bombs')?.click()
      expect(slot('hookchain')?.getAttribute('aria-pressed')).toBe('true')
      byTestId('corner-back')?.click()
      await until(() => screen() === 'play', 'play again')
      step()
      expect(running().resource(Inventory).equipped).toBe(ItemCode.hookchain)
      await until(
        () => root.querySelector('[data-testid="hud-item"]')?.textContent?.includes('Hookchain') === true,
        'the chip',
      )
    })

    // The arrow keys steer the grid by the slots' boxes, which jsdom does not lay out: items.layout.test.ts.
    it('goes back to play on Escape', async () => {
      await toRoom()
      key('keydown', 'KeyI')
      await until(() => screen() === 'items', 'the Items screen')
      key('keydown', 'Escape')
      await until(() => screen() === 'play', 'play again')
    })

    it('equips with 1, 2 and 3 in play, an owned item only', async () => {
      await toRoom()
      ownSome()
      key('keydown', 'Digit3')
      step()
      expect(running().resource(Inventory).equipped).toBe(ItemCode.hookchain)
      key('keydown', 'Digit2')
      step()
      expect(running().resource(Inventory).equipped).toBe(ItemCode.hookchain)
      key('keydown', 'Digit1')
      step()
      expect(running().resource(Inventory).equipped).toBe(ItemCode.sling)
    })
  })
})
