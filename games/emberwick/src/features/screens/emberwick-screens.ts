// Emberwick's screens on the runtime: splash, menu, room, paused and end, as plain DOM in
// the screen layer the runtime's flow opens for each (EMBERWICK_FLOW says which follows which). The runtime
// does the rest: the Ruken handshake, nothing drawn before ready, the fixed-step loop, pausing on the host's
// background or menu (through the room's `openMenu`) and the boot failure panel.
//
// The room owns the round's sim. Entering from the menu or the end screen starts a round on a fresh sim;
// entering from paused resumes the same one. `AppLoop.run` resets the renderer, so a resume restores the
// sim's own snapshot first, which makes the next step a full resync.
import type { Disposables, InputMap, ScreenContext, ScreenDef } from '@mcthaydt/automata'
import { createSim, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { TICK_HZ } from '../../shared/tuning.ts'

/** How long the splash shows before moving on by itself. */
const SPLASH_MS = 1500

export interface ScreensGame {
  readonly sim: {
    readonly plugins: readonly PluginDef[]
    readonly seed: number
    readonly content?: unknown
    readonly setup?: ((sim: Sim) => void) | undefined
  }
  readonly input: InputMap
}

const PANELS = {
  splash: `<section class="panel" aria-label="Splash">
      <p class="mark">AutomataFramework</p>
      <p class="hint blink">Press any key or tap</p>
    </section>`,
  menu: `<section class="panel" aria-labelledby="menu-title">
      <h1 id="menu-title" class="title">Emberwick</h1>
      <p class="hint">Carry your lantern up to the ember.</p>
      <div class="actions"><button type="button" class="primary" data-kind="primary" data-action="play">Play</button></div>
      <p class="keys"><kbd>←</kbd><kbd>→</kbd> move <kbd>Space</kbd> jump <kbd>Esc</kbd> pause</p>
    </section>`,
  room: `<div class="hud">
      <button type="button" class="pause" data-action="pause" aria-label="Pause">II</button>
    </div>
    <div class="touch" aria-hidden="true">
      <button type="button" tabindex="-1" data-hold="left">◀</button>
      <button type="button" tabindex="-1" data-hold="right">▶</button>
      <button type="button" tabindex="-1" data-hold="jump" class="jump">▲</button>
    </div>`,
  paused: `<section class="panel" aria-labelledby="paused-title">
      <h2 id="paused-title">Paused</h2>
      <div class="actions">
        <button type="button" class="primary" data-kind="primary" data-action="resume">Resume</button>
        <button type="button" data-action="quit">Back to menu</button>
      </div>
    </section>`,
  end: `<section class="panel" aria-labelledby="end-title">
      <h2 id="end-title">The ember is yours</h2>
      <p class="time" data-slot="time"></p>
      <div class="actions">
        <button type="button" class="primary" data-kind="primary" data-action="play">Play again</button>
        <button type="button" data-action="quit">Menu</button>
      </div>
    </section>`,
} as const

type ScreenId = keyof typeof PANELS

/** The touch buttons' holds, in the order `keys()` made its buttons: left, right, jump. */
const TOUCH_IDS: Readonly<Record<string, string>> = { left: 'move-0', right: 'move-1', jump: 'move-2' }

/** A listener for as long as the screen is open. */
function listen<T extends EventTarget>(
  screen: Disposables,
  target: T,
  type: string,
  listener: (event: Event) => void,
): void {
  target.addEventListener(type, listener)
  screen.add(() => target.removeEventListener(type, listener))
}

/**
 * Draws a screen's panel into its layer, marks the game root with the screen (`data-screen`, which the page's
 * styles and the browser journeys read) and sends each `[data-action]` button's action to the flow.
 */
function show(
  { layer, services }: ScreenContext,
  id: ScreenId,
  actions: Readonly<Record<string, () => void>> = {},
): Window {
  layer.innerHTML = PANELS[id]
  const root = layer.closest('[data-layer="screens"]')?.parentElement
  if (root instanceof HTMLElement) root.dataset.screen = id
  layer.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === undefined) return
    const run = actions[action]
    if (run === undefined) services.flow.dispatch(action)
    else run()
  })
  return layer.ownerDocument.defaultView ?? window
}

export function emberwickScreens(game: ScreensGame): ScreenDef[] {
  let sim: Sim | undefined
  let seconds = 0
  let roomFlow: { dispatch(event: string): boolean } | undefined

  const dropSim = (): void => {
    sim?.dispose()
    sim = undefined
  }

  const splash: ScreenDef = {
    id: 'splash',
    enter: (context) => {
      const { screen, services } = context
      const target = show(context, 'splash')
      const next = (): void => void services.flow.dispatch('continue')
      listen(screen, target, 'keydown', next)
      listen(screen, target, 'pointerdown', next)
      const timer = services.clock.setTimeout(next, SPLASH_MS)
      screen.add(() => services.clock.clearTimeout(timer))
    },
  }

  const menu: ScreenDef = {
    id: 'menu',
    enter: (context) => void show(context, 'menu'),
  }

  const room: ScreenDef = {
    id: 'room',
    openMenu: () => roomFlow?.dispatch('pause') ?? false,
    enter: async (context) => {
      const { layer, from, screen, services } = context
      const { flow, appLoop, bus, hosting } = services
      const pause = (): void => void flow.dispatch('pause')
      const target = show(context, 'room', { pause })
      roomFlow = flow
      screen.add(() => {
        roomFlow = undefined
      })

      let current = sim
      if (from === 'paused' && current !== undefined) current.restore(current.snapshot())
      else {
        dropSim()
        const { plugins, seed, content, setup } = game.sim
        const made = await createSim({ plugins: [...plugins], seed, content })
        // Left while the sim was being made (the runtime shut down): nothing holds it, so it goes now.
        if (screen.disposed) {
          made.dispose()
          return
        }
        setup?.(made)
        sim = made
        current = made
        hosting.round.start()
      }
      const playing = current

      const input = game.input.attach(target)
      screen.add(() => input.dispose())
      for (const button of layer.querySelectorAll<HTMLElement>('[data-hold]')) {
        const id = TOUCH_IDS[button.dataset.hold ?? ''] ?? ''
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          input.hold(id)
          button.dataset.held = 'true'
        })
        const release = (): void => {
          input.release(id)
          delete button.dataset.held
        }
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
          button.addEventListener(type, release)
      }

      listen(screen, target, 'keydown', (event) => {
        const key = event as KeyboardEvent
        if (key.repeat || (key.code !== 'Escape' && key.code !== 'KeyP')) return
        key.preventDefault()
        pause()
      })

      // Leaving the page (another tab, another app, a locked phone) pauses the round, so the player comes back to
      // the pause menu instead of to a game that kept running.
      listen(screen, target.document, 'visibilitychange', () => {
        if (target.document.hidden) pause()
      })

      // The sim's goal event ends the round; the end screen shows how long it took.
      screen.add(
        bus.subscribe('sim.events', (events) => {
          if (!events.some((event) => event.type === 'goal.reached')) return
          seconds = playing.tick / TICK_HZ
          hosting.round.end('complete')
          flow.dispatch('goal')
        }),
      )

      appLoop.run({ sim: playing, commands: (tick) => input.commands(tick) })
      screen.add(() => appLoop.stop())
    },
  }

  const paused: ScreenDef = {
    id: 'paused',
    pausesSim: true,
    enter: (context) => {
      const { flow, hosting } = context.services
      const quit = (): void => {
        hosting.round.end('quit')
        flow.dispatch('quit')
      }
      const target = show(context, 'paused', { quit })
      listen(context.screen, target, 'keydown', (event) => {
        const key = event as KeyboardEvent
        if (key.code !== 'Escape' || key.repeat) return
        key.preventDefault()
        flow.dispatch('resume')
      })
    },
  }

  const end: ScreenDef = {
    id: 'end',
    enter: (context) => {
      const { layer } = context
      show(context, 'end')
      const time = layer.querySelector('[data-slot="time"]')
      if (time !== null) time.textContent = `${seconds.toFixed(2)} s`
    },
  }

  return [splash, menu, room, paused, end]
}
