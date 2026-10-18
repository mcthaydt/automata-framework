import { realClock, TEST_GAME_ORIGIN } from '@mcthaydt/automata-host/testing'
import {
  type GameRenderer,
  type RendererFactory,
  type RuntimeHandle,
  runGame,
} from '@mcthaydt/automata-runtime'
import { defineExtension } from '@mcthaydt/automata-runtime/extension'
import { fakeFetch, type ManualFrames, manualFrames } from '@mcthaydt/automata-runtime/testing'
import {
  defineCommand,
  defineComponent,
  defineEvent,
  definePlugin,
  defineSystem,
  type Sim,
  type StepResult,
} from '@mcthaydt/automata-sim'
import { fakeGamepads } from '@mcthaydt/automata-testing/input'
import { createFakeHost } from '@ruken/sdk-host/testing'
import { Effect } from 'effect'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { type DefinedGame, defineGame, type GameSpec } from '../define-game.ts'
import { keys } from '../input/keys.ts'
import { defaultScreens } from './default-screens.ts'
import HudExtension from './HudExtension.test.svelte'
import SettingsExtension from './SettingsExtension.test.svelte'

// The default title, play and paused screens (DX spec §7), booted by the real runtime in jsdom: standalone
// hosting, manual frames and a renderer that records what it is given (Pixi needs WebGL, which jsdom lacks).
const Body = defineComponent('body', { x: 'f32' })
const Move = defineCommand('move', z.object({ x: z.number().int().min(-1).max(1).default(0) }))
const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const body of ctx.query(Body)) body.set(Body, { x: body.get(Body).x + payload.x })
})
const square = definePlugin({ name: 'square', defs: [Body, Move, move] })

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

/** A renderer that keeps every step result it is given. */
function recordingRenderer(results: StepResult[], resets: { count: number }): RendererFactory {
  const renderer: GameRenderer = {
    apply: (result) => results.push(result),
    draw: () => {},
    reset: () => {
      resets.count++
    },
  }
  return () => Effect.succeed(renderer)
}

describe('default screens', () => {
  let root: HTMLElement
  let frames: ManualFrames
  let results: StepResult[]
  let resets: { count: number }
  let handle: RuntimeHandle | undefined
  let game: DefinedGame
  // The default screens keep the sim until the title drops it, and a shutdown on play or paused does not: dispose
  // each test's sims here, or the file runs past Koota's 16 live worlds.
  const sims: Sim[] = []

  const screen = (id: string) => root.querySelector(`[data-testid="${id}-screen"]`)
  const button = (testId: string) => root.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
  const press = (code: string, target: EventTarget = window) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }))
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) frames.advance(1000 / 60)
  }
  const lastX = () => {
    const rows = results.flatMap((result) => [...result.render.added, ...result.render.changed])
    return (rows.at(-1)?.components.body as { x: number } | undefined)?.x
  }

  async function boot(spec: Partial<GameSpec> = {}, withInput = true): Promise<void> {
    const base: GameSpec = {
      id: 'screens-test',
      title: 'Square',
      size: { width: 320, height: 180 },
      sim: {
        plugins: [square],
        seed: 3,
        setup: (sim) => {
          sims.push(sim)
          sim.spawn([[Body, { x: 10 }]])
        },
      },
      root,
      seams: { frames, fetch: fakeFetch({}).fetch },
    }
    const input = keys(Move, { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 } })
    game = defineGame({ ...base, ...(withInput ? { input } : {}), ...spec })
    handle = runGame({ ...game, root, renderer: recordingRenderer(results, resets) })
    await until(() => frames.pending, 'the first frame')
    step()
    await until(() => document.documentElement.getAttribute('data-state') === 'ready', 'ready')
    await until(() => screen('title') !== null, 'the title screen')
  }

  async function toPlay(): Promise<void> {
    button('play')?.click()
    await until(() => screen('play') !== null, 'the play screen')
  }

  beforeEach(() => {
    root = document.body.appendChild(document.createElement('main'))
    frames = manualFrames()
    results = []
    resets = { count: 0 }
  })
  afterEach(async () => {
    await handle?.shutdown()
    handle = undefined
    for (const sim of sims.splice(0)) sim.dispose()
    root.remove()
    document.documentElement.removeAttribute('data-state')
  })

  it('title shows the game’s title and a primary Play that has focus', async () => {
    await boot()
    expect(screen('title')?.textContent).toContain('Square')
    expect(button('play')?.dataset.kind).toBe('primary')
    expect(document.activeElement).toBe(button('play'))
  })

  it.each(['Enter', 'Space'])('%s on the title goes to play', async (code) => {
    await boot()
    ;(document.activeElement as HTMLElement | null)?.blur()
    press(code)
    await until(() => screen('play') !== null, 'the play screen')
  })

  it('play creates the sim with the seed and setup, and steps the input map’s commands', async () => {
    await boot()
    await toPlay()
    step()
    expect(results[0]?.render.resync).toBe(true)
    expect(lastX()).toBe(10)
    press('ArrowRight')
    step(3)
    expect(lastX()).toBe(13)
  })

  it.each(['Escape', 'KeyP'])('%s in play pauses: the sim stops', async (code) => {
    await boot()
    await toPlay()
    step(2)
    press(code)
    await until(() => screen('paused') !== null, 'the paused screen')
    const applied = results.length
    step(5)
    expect(results.length).toBe(applied)
  })

  it('draws an extension’s hud.overlay on play, inside the frame, and not on paused (M4.7)', async () => {
    await boot({
      extensions: [defineExtension({ name: 'test-hud', ui: { slots: { 'hud.overlay': HudExtension } } })],
    })
    await toPlay()
    const hud = () => root.querySelector('[data-testid="hud-extension"]')
    expect(hud()).not.toBeNull()
    expect(hud()?.closest('[data-testid="play-screen"]')).not.toBeNull()
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    expect(hud()).toBeNull()
  })

  it('the corner Pause button pauses too', async () => {
    await boot()
    await toPlay()
    button('pause')?.click()
    await until(() => screen('paused') !== null, 'the paused screen')
  })

  // M5.7: a game with scores shows its first board on paused. Standalone there is no host board, so the panel says
  // so in words, and never shows a board kept here.
  it('shows the first scored board on paused when the game has scores, and none without (M5.7)', async () => {
    const Done = defineEvent('done', z.object({ score: z.number() }))
    const scoring = definePlugin({ name: 'scoring', defs: [Done] })
    await boot({
      sim: { plugins: [square, scoring], seed: 3, setup: (sim) => sims.push(sim) },
      scores: { [Done.id]: { board: 'best', score: (payload) => Done.schema.parse(payload).score } },
    })
    await toPlay()
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    await until(
      () => root.querySelector('[data-leaderboard]')?.getAttribute('data-state') === 'unavailable',
      'the unavailable board',
    )
    expect(root.querySelector('[data-leaderboard]')?.textContent).toContain("Scores aren't available here")
  })

  it('shows no board on paused for a game without scores', async () => {
    await boot()
    await toPlay()
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    expect(root.querySelector('[data-leaderboard]')).toBeNull()
  })

  it('the host’s menu request opens paused', async () => {
    await boot()
    await toPlay()
    expect(game.screens.find((candidate) => candidate.id === 'play')?.openMenu?.()).toBe(true)
    await until(() => screen('paused') !== null, 'the paused screen')
  })

  it('Resume (focused) and Escape return to the same sim, re-sent in full to the renderer', async () => {
    await boot()
    await toPlay()
    press('ArrowRight')
    step(4)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }))
    const tickBefore = results.at(-1)?.tick ?? -1
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    expect(document.activeElement).toBe(button('resume'))
    button('resume')?.click()
    await until(() => screen('play') !== null, 'the play screen again')
    step()
    expect(results.at(-1)?.tick).toBe(tickBefore + 1)
    expect(results.at(-1)?.render.resync).toBe(true)
    expect(lastX()).toBe(14)

    press('Escape')
    await until(() => screen('paused') !== null, 'paused again')
    press('Escape')
    await until(() => screen('play') !== null, 'play after Escape')
  })

  it('Quit to title drops the sim: the next Play starts again at tick 0', async () => {
    await boot()
    await toPlay()
    step(3)
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    button('quit')?.click()
    await until(() => screen('title') !== null, 'the title screen')
    results.length = 0
    await toPlay()
    step()
    expect(results[0]?.tick).toBe(1)
    expect(lastX()).toBe(10)
  })

  describe('the Settings screen (M4 spec §4.5, §4.8, M4.4)', () => {
    // Standalone, the SDK keeps saves in localStorage under `ruken:<game id>:`.
    const saved = () => JSON.parse(localStorage.getItem('ruken:screens-test:settings') ?? 'null')
    const settingsScreen = () => screen('settings')
    const row = (action: string) => root.querySelector<HTMLElement>(`[data-control-row="${action}"]`)
    const rebind = (action: string) =>
      row(action)?.querySelector<HTMLButtonElement>('[data-rebind="keyboard"]')
    const controlsState = () =>
      root.querySelector<HTMLElement>('[data-settings-section="controls"]')?.dataset.state
    beforeEach(() => localStorage.clear())

    async function toSettings(spec: Partial<GameSpec> = {}, withInput = true): Promise<void> {
      await boot(spec, withInput)
      await toPlay()
      press('Escape')
      await until(() => screen('paused') !== null, 'the paused screen')
      // Focus first, as a real click or key press does (jsdom's click() does not): the flow remembers it (F-b).
      button('settings')?.focus()
      button('settings')?.click()
      await until(() => settingsScreen() !== null, 'the settings screen')
    }

    it('under a host that reports an Xbox-layout pad, the controller prompts become Xbox’s (M4 spec §4.2)', async () => {
      const pads = fakeGamepads()
      pads.connect(0, { id: 'USB Gamepad (STANDARD GAMEPAD)' })
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: pads.getGamepads })
      let host: ReturnType<typeof createFakeHost> | undefined
      try {
        await toSettings({
          input: keys(Move, { ArrowRight: { x: 1 } }, { pad: { 0: { x: 1 } } }),
          seams: {
            frames,
            fetch: fakeFetch({}).fetch,
            sdkEnv: () => {
              host = createFakeHost({
                gameOrigin: TEST_GAME_ORIGIN,
                gameId: 'screens-test',
                clock: realClock,
              })
              if (host.gameEnv === undefined || host.gameEnv === null)
                throw new Error('the fake host has no game environment')
              return host.gameEnv
            },
          },
        })
        const padPrompt = () =>
          row('move-0')?.querySelector('[data-rebind="gamepad"]')?.textContent?.trim() ??
          'no controller column'
        await until(() => padPrompt() !== 'no controller column', 'the controller column')
        expect(padPrompt()).not.toBe('A')
        host?.bridge.setInputMode({ mode: 'gamepad', gamepad: { layout: 'xbox', connected: true } })
        await until(() => padPrompt() === 'A', 'the Xbox prompt')
      } finally {
        Reflect.deleteProperty(navigator, 'getGamepads')
      }
    })

    it('opens from paused; Back returns to paused with focus on Settings (F-b)', async () => {
      await toSettings()
      button('corner-back')?.click()
      await until(() => screen('paused') !== null, 'paused again')
      await until(() => document.activeElement === button('settings'), 'focus on Settings')
    })

    it('lists the input map’s actions with their keyboard prompts', async () => {
      await toSettings()
      expect(row('move-0')?.textContent).toContain('move x -1')
      expect(rebind('move-0')?.textContent?.trim()).toBe('←')
      expect(rebind('move-1')?.textContent?.trim()).toBe('→')
    })

    it('rebinds a key: saved through the host, shown at once, and driving the next play (I-h)', async () => {
      await toSettings()
      rebind('move-1')?.click()
      await until(() => controlsState() === 'capturing', 'the capture')
      press('KeyD')
      await until(() => controlsState() === 'saved', 'the saved rebind')
      expect(rebind('move-1')?.textContent?.trim()).toBe('D')
      expect(saved()).toMatchObject({
        input: { profile: 'move', overrides: { 'move-1': { keys: ['KeyD'] } } },
      })
      press('Escape')
      await until(() => screen('paused') !== null, 'paused again')
      button('resume')?.click()
      await until(() => screen('play') !== null, 'play again')
      step()
      const before = lastX() ?? 0
      press('KeyD')
      step(2)
      expect(lastX()).toBe(before + 2)
    })

    it('cancels a capture on Escape and stays on Settings (I-k)', async () => {
      await toSettings()
      rebind('move-0')?.click()
      await until(() => controlsState() === 'capturing', 'the capture')
      press('Escape')
      await until(() => controlsState() === 'list', 'the list')
      expect(settingsScreen()).not.toBeNull()
      expect(saved()?.input?.overrides ?? {}).toEqual({})
    })

    it('refuses a reserved key and says so', async () => {
      await toSettings()
      rebind('move-0')?.click()
      await until(() => controlsState() === 'capturing', 'the capture')
      press('Tab')
      await until(() => controlsState() === 'reserved', 'the refusal')
      expect(rebind('move-0')?.textContent?.trim()).toBe('←')
    })

    it('saves the quality and gives it to the stage', async () => {
      const setQuality = vi.fn()
      const sim = {
        plugins: [square],
        seed: 3,
        setup: (made: Sim) => {
          sims.push(made)
          made.spawn([[Body, { x: 10 }]])
        },
      }
      await toSettings({
        screens: defaultScreens({
          title: 'Square',
          sim,
          input: keys(Move, { ArrowLeft: { x: -1 } }),
          setQuality,
        }),
      })
      root.querySelector<HTMLInputElement>('[data-testid="quality-low"] input, input[value="low"]')?.click()
      await until(() => saved()?.display?.quality === 'low', 'the saved quality')
      expect(setQuality).toHaveBeenLastCalledWith('low')
    })

    it('shows an extension’s settings.sections component', async () => {
      await toSettings({
        extensions: [
          defineExtension({ name: 'test-extra', ui: { slots: { 'settings.sections': SettingsExtension } } }),
        ],
      })
      expect(root.querySelector('[data-settings-section="extension-test"]')).not.toBeNull()
    })

    it('has no Controls section for a game without an input map, and still its Display', async () => {
      await toSettings({}, false)
      expect(root.querySelector('[data-settings-section="controls"]')).toBeNull()
      expect(root.querySelector('[data-settings-section="display"]')).not.toBeNull()
    })
  })

  describe('the system back gesture (M4 spec §4.7, F-c)', () => {
    const guarded = () => (history.state as Record<string, unknown> | null)?.afBackGuard === true
    // A back step off the game's entry: jsdom's history.back() is asynchronous, so the step is driven directly.
    const stepBack = () => {
      history.replaceState(null, '')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    }
    const activate = () => window.dispatchEvent(new PointerEvent('pointerup'))
    beforeEach(() => history.replaceState(null, ''))

    it('on paused, a back step resumes play and keeps the game’s entry', async () => {
      await boot()
      await toPlay()
      press('Escape')
      await until(() => screen('paused') !== null, 'the paused screen')
      activate()
      expect(guarded()).toBe(true)
      stepBack()
      await until(() => screen('play') !== null, 'the play screen again')
      expect(guarded()).toBe(true)
    })

    it('on play, a back step pauses', async () => {
      await boot()
      await toPlay()
      activate()
      stepBack()
      await until(() => screen('paused') !== null, 'the paused screen')
      expect(guarded()).toBe(true)
    })

    it('on the title, a back step leaves: history steps back past the game', async () => {
      const back = vi.spyOn(history, 'back').mockImplementation(() => {})
      try {
        await boot()
        activate()
        stepBack()
        expect(back).toHaveBeenCalledOnce()
        expect(screen('title')).not.toBeNull()
      } finally {
        back.mockRestore()
      }
    })

    it('hosted, the host owns back: the game adds no history entry (M4-D10)', async () => {
      await boot({
        seams: {
          frames,
          fetch: fakeFetch({}).fetch,
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'screens-test',
              clock: realClock,
            })
            if (host.gameEnv === undefined || host.gameEnv === null)
              throw new Error('the fake host has no game environment')
            return host.gameEnv
          },
        },
      })
      await toPlay()
      activate()
      expect(guarded()).toBe(false)
    })
  })

  it('hides an idle pointer on play only, never on paused (M4 spec §4.7)', async () => {
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    try {
      await boot()
      await toPlay()
      const playLayer = () => root.querySelector<HTMLElement>('[data-screen="play"]')
      expect(game.screens.find((candidate) => candidate.id === 'play')?.kind).toBe('gameplay')
      window.dispatchEvent(new PointerEvent('pointermove'))
      step()
      expect(playLayer()?.style.cursor).toBe('')
      now = 2000
      step()
      expect(playLayer()?.style.cursor).toBe('none')
      window.dispatchEvent(new PointerEvent('pointermove'))
      step()
      expect(playLayer()?.style.cursor).toBe('')
      press('KeyA')
      step()
      expect(playLayer()?.style.cursor).toBe('none')
      press('Escape')
      await until(() => screen('paused') !== null, 'the paused screen')
      expect(root.querySelector<HTMLElement>('[data-screen="paused"]')?.style.cursor).toBe('')
    } finally {
      clock.mockRestore()
    }
  })

  it('the pad’s Start button pauses play, through the Input service’s pause edge (M4.1)', async () => {
    const buttons: boolean[] = []
    Object.defineProperty(window.navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          id: 'Standard Gamepad',
          index: 0,
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
        },
      ],
    })
    try {
      await boot()
      await toPlay()
      step()
      buttons[9] = true
      step()
      await until(() => screen('paused') !== null, 'the paused screen')
    } finally {
      Reflect.deleteProperty(window.navigator, 'getGamepads')
    }
  })

  it('on paused, the pad’s D-pad moves focus and A clicks Quit, through the Input’s menu edges (M4.5)', async () => {
    const buttons: boolean[] = []
    Object.defineProperty(window.navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          id: 'Standard Gamepad',
          index: 0,
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
        },
      ],
    })
    try {
      await boot()
      await toPlay()
      press('Escape')
      await until(() => screen('paused') !== null, 'the paused screen')
      expect(document.activeElement).toBe(button('resume'))
      await tick()
      buttons[13] = true
      await until(() => document.activeElement === button('quit'), 'focus on Quit')
      buttons[13] = false
      await tick()
      buttons[0] = true
      await until(() => screen('title') !== null, 'the title screen')
    } finally {
      Reflect.deleteProperty(window.navigator, 'getGamepads')
    }
  })

  describe('a pad without the standard mapping (M4 spec §6)', () => {
    afterEach(() => Reflect.deleteProperty(window.navigator, 'getGamepads'))
    const toasts = () => [...root.querySelectorAll('[data-testid="pad-unsupported"]')]

    it('says once, on any screen, that the controller is not supported yet', async () => {
      const pads = fakeGamepads({ target: window })
      Object.defineProperty(window.navigator, 'getGamepads', { configurable: true, value: pads.getGamepads })
      await boot()
      pads.connect(0, { mapping: '', id: 'Odd Pad' })
      await until(() => toasts().length === 1, 'the toast on the title')
      expect(toasts()[0]?.textContent).toContain('This controller isn’t supported yet')
      await toPlay()
      pads.unplug(0)
      pads.connect(0, { mapping: '', id: 'Odd Pad' })
      await tick()
      expect(toasts()).toHaveLength(0)
    })
  })

  describe('a pad unplugged during play (M4-D9)', () => {
    const buttons: boolean[] = []
    const pad = () => ({
      id: 'Standard Gamepad',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: buttons.map((pressed) => ({ pressed, value: pressed ? 1 : 0 })),
    })
    const unplug = () =>
      window.dispatchEvent(Object.assign(new Event('gamepaddisconnected'), { gamepad: pad() }))
    beforeEach(() => {
      buttons.length = 0
      Object.defineProperty(window.navigator, 'getGamepads', { configurable: true, value: () => [pad()] })
    })
    afterEach(() => {
      Reflect.deleteProperty(window.navigator, 'getGamepads')
    })

    it('pauses with "Reconnect your controller" when the active pad goes; Resume by any device plays on', async () => {
      await boot()
      await toPlay()
      buttons[15] = true
      step(2)
      buttons[15] = false
      step()
      unplug()
      await until(() => screen('paused') !== null, 'the paused screen')
      expect(screen('paused')?.textContent).toContain('Reconnect your controller')
      const applied = results.length
      step(3)
      expect(results.length).toBe(applied)
      button('resume')?.click()
      await until(() => screen('play') !== null, 'the play screen again')
      step()
      expect(results.length).toBe(applied + 1)
      press('Escape')
      await until(() => screen('paused') !== null, 'paused again')
      expect(screen('paused')?.textContent).not.toContain('Reconnect')
    })

    it('does not pause when the keyboard was the last input', async () => {
      await boot()
      await toPlay()
      buttons[15] = true
      step()
      buttons[15] = false
      press('ArrowRight')
      step()
      unplug()
      await tick()
      expect(screen('play')).not.toBeNull()
    })
  })

  it('shows touch buttons only when the player uses touch', async () => {
    await boot()
    await toPlay()
    expect(root.querySelector('[data-testid="move-0"]')).toBeNull()
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))
    await until(() => root.querySelector('[data-testid="move-0"]') !== null, 'the touch buttons')
    const right = button('move-1') as HTMLButtonElement
    expect(right.textContent).toBe('→')
    right.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    step(2)
    expect(lastX()).toBe(12)
    right.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    step()
    expect(lastX()).toBe(12)
  })

  it('in swipe mode, shows the swipe surface and no buttons, and a swipe and a tap drive the square (M4.3)', async () => {
    await boot({ input: keys(Move, {}, { gestures: { 'swipe-right': { x: 1 }, tap: { x: -1 } } }) })
    await toPlay()
    expect(root.querySelector('[data-testid="swipe-surface"]')).toBeNull()
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))
    await until(() => root.querySelector('[data-testid="swipe-surface"]') !== null, 'the swipe surface')
    expect(root.querySelector('[data-testid="touch-buttons"]')).toBeNull()
    const surface = root.querySelector('[data-testid="swipe-surface"]') as HTMLElement
    const finger = (type: string, clientX: number, timeStamp: number) => {
      const event = new PointerEvent(type, {
        pointerId: 1,
        clientX,
        clientY: 100,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'timeStamp', { value: timeStamp })
      surface.dispatchEvent(event)
    }
    finger('pointerdown', 100, 0)
    finger('pointermove', 130, 16)
    step(2)
    expect(lastX()).toBe(12)
    finger('pointerup', 130, 32)
    step()
    expect(lastX()).toBe(12)
    finger('pointerdown', 100, 1000)
    finger('pointerup', 100, 1050)
    step(3)
    expect(lastX()).toBe(11)
  })

  it('shows no touch buttons when the input map says touch: false', async () => {
    await boot({ input: keys(Move, { ArrowLeft: { x: -1 } }, { touch: false }) })
    await toPlay()
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }))
    await tick()
    expect(root.querySelector('[data-testid="move-0"]')).toBeNull()
  })

  it('plays with no input map, sending no commands', async () => {
    await boot({}, false)
    await toPlay()
    step(2)
    expect(results.flatMap((result) => result.rejected)).toEqual([])
    expect(lastX()).toBe(10)
  })

  it('hands the play screen’s sim to watchSim, and undefined when the title drops it (the draw layer)', async () => {
    const watched: (Sim | undefined)[] = []
    const sim = { plugins: [square], seed: 3, setup: (live: Sim) => void live.spawn([[Body, { x: 10 }]]) }
    await boot(
      { screens: defaultScreens({ title: 'Square', sim, watchSim: (live) => watched.push(live) }) },
      false,
    )
    expect(watched).toEqual([undefined])
    await toPlay()
    expect(watched.at(-1)?.tick).toBe(0)
    const live = watched.at(-1)
    press('Escape')
    await until(() => screen('paused') !== null, 'the paused screen')
    button('resume')?.click()
    await until(() => screen('play') !== null, 'the play screen again')
    expect(watched.at(-1)).toBe(live)
    press('Escape')
    await until(() => screen('paused') !== null, 'paused again')
    button('quit')?.click()
    await until(() => screen('title') !== null, 'the title screen')
    expect(watched.at(-1)).toBeUndefined()
  })
})
