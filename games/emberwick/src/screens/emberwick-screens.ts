// Emberwick's screens on the runtime (DX.3 decision E-2): splash, menu, room, paused and end, as plain DOM in
// the screen layer the runtime's flow opens for each (EMBERWICK_FLOW says which follows which). The runtime
// does the rest: the Ruken handshake, nothing drawn before ready, the fixed-step loop, pausing on the host's
// background or menu (through the room's `openMenu`) and the boot failure panel.
//
// The room owns the round's sim. Entering from the menu or the end screen starts a round on a fresh sim;
// entering from paused resumes the same one. `AppLoop.run` resets the renderer, so a resume restores the
// sim's own snapshot first, which makes the next step a full resync.
import type { InputMap } from '@mcthaydt/automata-game'
import { Hosting } from '@mcthaydt/automata-host'
import { AppLoop, Flow, PresentationBus, type ScreenDef } from '@mcthaydt/automata-runtime'
import { createSim, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { Effect, type Scope } from 'effect'
import { TICK_HZ } from '../sim/tuning.ts'

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
        <button type="button" data-action="quit">Quit</button>
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
function listen<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  listener: (event: WindowEventMap[K]) => void,
): Effect.Effect<void, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => target.addEventListener(type, listener)),
    () => Effect.sync(() => target.removeEventListener(type, listener)),
  )
}

/**
 * Draws a screen's panel into its layer, marks the game root with the screen (`data-screen`, which the page's
 * styles and the browser journeys read) and sends each `[data-action]` button's action to the flow.
 */
function show(layer: HTMLElement, id: ScreenId, actions: Readonly<Record<string, () => void>> = {}) {
  return Effect.gen(function* () {
    const flow = yield* Flow
    layer.innerHTML = PANELS[id]
    const root = layer.closest('[data-layer="screens"]')?.parentElement
    if (root instanceof HTMLElement) root.dataset.screen = id
    layer.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action
      if (action === undefined) return
      const run = actions[action]
      if (run === undefined) flow.dispatch(action)
      else run()
    })
    return layer.ownerDocument.defaultView ?? window
  })
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
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const target = yield* show(layer, 'splash')
        const next = (): void => void flow.dispatch('continue')
        yield* listen(target, 'keydown', next)
        yield* listen(target, 'pointerdown', next)
        yield* Effect.acquireRelease(
          Effect.sync(() => target.setTimeout(next, SPLASH_MS)),
          (timer) => Effect.sync(() => target.clearTimeout(timer)),
        )
      }),
  }

  const menu: ScreenDef = {
    id: 'menu',
    enter: ({ layer }) => Effect.asVoid(show(layer, 'menu')),
  }

  const room: ScreenDef = {
    id: 'room',
    openMenu: () => roomFlow?.dispatch('pause') ?? false,
    enter: ({ layer, from }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const appLoop = yield* AppLoop
        const bus = yield* PresentationBus
        const hosting = yield* Hosting
        const pause = (): void => void flow.dispatch('pause')
        const target = yield* show(layer, 'room', { pause })
        roomFlow = flow
        yield* Effect.addFinalizer(() => Effect.sync(() => (roomFlow = undefined)))

        let current = sim
        if (from === 'paused' && current !== undefined) current.restore(current.snapshot())
        else {
          dropSim()
          const { plugins, seed, content, setup } = game.sim
          current = yield* Effect.promise(() => createSim({ plugins: [...plugins], seed, content }))
          setup?.(current)
          sim = current
          yield* hosting.round.start
        }
        const playing = current

        const input = game.input.attach(target)
        yield* Effect.addFinalizer(() => Effect.sync(() => input.dispose()))
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

        yield* listen(target, 'keydown', (event) => {
          if (event.repeat || (event.code !== 'Escape' && event.code !== 'KeyP')) return
          event.preventDefault()
          pause()
        })

        // The sim's goal event ends the round; the end screen shows how long it took.
        const unsubscribe = bus.subscribe('sim.events', (events) => {
          if (!events.some((event) => event.type === 'goal.reached')) return
          seconds = playing.tick / TICK_HZ
          Effect.runFork(hosting.round.end('complete'))
          flow.dispatch('goal')
        })
        yield* Effect.addFinalizer(() => Effect.sync(unsubscribe))

        appLoop.run({ sim: playing, commands: (tick) => input.commands(tick) })
        yield* Effect.addFinalizer(() => Effect.sync(() => appLoop.stop()))
      }),
  }

  const paused: ScreenDef = {
    id: 'paused',
    pausesSim: true,
    enter: ({ layer }) =>
      Effect.gen(function* () {
        const flow = yield* Flow
        const hosting = yield* Hosting
        const quit = (): void => {
          Effect.runFork(hosting.round.end('quit'))
          flow.dispatch('quit')
        }
        const target = yield* show(layer, 'paused', { quit })
        yield* listen(target, 'keydown', (event) => {
          if (event.code !== 'Escape' || event.repeat) return
          event.preventDefault()
          flow.dispatch('resume')
        })
      }),
  }

  const end: ScreenDef = {
    id: 'end',
    enter: ({ layer }) =>
      Effect.gen(function* () {
        yield* show(layer, 'end')
        const time = layer.querySelector('[data-slot="time"]')
        if (time !== null) time.textContent = `${seconds.toFixed(2)} s`
      }),
  }

  return [splash, menu, room, paused, end]
}
