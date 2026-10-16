import type { Hosting } from '@mcthaydt/automata-host'
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'
import { Effect, Scope, Stream } from 'effect'
import { createBaseSim, moveCommand } from './base-sim.ts'
import { type BaseBootFailed, connect } from './boot.ts'
import { RendererFailed, SimFailed } from './boot-failure.ts'
import { parseRoom, ROOM } from './content/room.ts'
import { createFailure } from './failure.ts'
import { type FlowEvent, next, type Screen } from './flow.ts'
import { createInputDevices } from './input/devices.ts'
import { toMove } from './input/keys.ts'
import { createLoop } from './loop.ts'
import { createRenderer, type Renderer, type RendererLayer } from './render/renderer.ts'
import { createRounds } from './rounds.ts'
import { createScreens } from './screens/screens.ts'
import { TICK_HZ } from './sim/tuning.ts'

// Wires the base together: connect to the host, then (only after ready) the renderer, the screens, input and the
// loop. The screen flow (flow.ts) decides what shows; this file does what each change means.

/** How long the splash shows before moving on by itself. */
const SPLASH_MS = 1500

/** What a demo adds to the base without copying the game (examples/README.md). */
export interface GameOptions {
  /** Extra sim plugins, added to every round's sim after the base's own. */
  readonly plugins?: readonly PluginDef[]
  /** Runs on each round's fresh sim before it plays, e.g. to spawn a demo's bodies. A throw disposes that sim and ends the game (failure.ts). */
  readonly onRound?: (sim: Sim) => void
  /** Drawing layers, added to the renderer once (see RendererLayer: lit like the room, reset each round). */
  readonly layers?: readonly RendererLayer[]
}

export function startGame(
  root: HTMLElement,
  options: GameOptions = {},
): Effect.Effect<void, BaseBootFailed | RendererFailed | SimFailed> {
  // Every round's sim is made the same way, the first one included.
  const makeSim = async (): Promise<Sim> => {
    const sim = await createBaseSim({ plugins: options.plugins ?? [] })
    try {
      options.onRound?.(sim)
    } catch (error) {
      sim.dispose()
      throw error
    }
    return sim
  }

  return Effect.gen(function* () {
    let screen: Screen = 'splash'
    // Replaced below once the screens exist; the host can only ask for the menu after ready anyway.
    let dispatch: (event: FlowEvent) => void = () => {}

    // `Hosting` lives as long as the page, so its scope is never closed.
    const page = yield* Scope.make()
    const hosting: Hosting = yield* Scope.extend(
      connect({
        onMenuRequest: () => {
          if (screen !== 'room' || failure.failed()) return false
          dispatch('menu-request')
          return true
        },
      }),
      page,
    )

    // Nothing is created before the host says ready (Ruken R-04): the page was empty until here.
    const room = parseRoom(ROOM)
    const firstSim = yield* Effect.tryPromise({
      try: makeSim,
      catch: (cause) => new SimFailed({ cause }),
    })
    const screens = createScreens(root, {
      onContinue: () => dispatch('continue'),
      onPlay: () => dispatch('play'),
      onPause: () => dispatch('pause'),
      onResume: () => dispatch('resume'),
      onQuit: () => dispatch('quit'),
    })
    const renderer: Renderer = yield* Effect.tryPromise({
      try: () => createRenderer(screens.stage, room),
      catch: (cause) => new RendererFailed({ cause }),
    })
    for (const layer of options.layers ?? []) renderer.addLayer(layer)

    const input = createInputDevices({
      target: window,
      touchButtons: screens.touchButtons,
      onPause: () => dispatch(screen === 'paused' ? 'resume' : 'pause'),
      onAnyInput: () => {
        if (screen === 'splash') dispatch('continue')
      },
    })

    const showPlayer = () => {
      const at = renderer.playerPixel()
      if (at === null) return
      root.dataset.playerX = String(at.x)
      root.dataset.playerY = String(at.y)
      root.dataset.tick = String(rounds.current().tick)
    }

    const loop = createLoop({
      now: () => performance.now(),
      requestFrame: (callback) => requestAnimationFrame(() => callback()),
      cancelFrame: (handle) => cancelAnimationFrame(handle),
      onStep: () => {
        const sim = rounds.current()
        const result = sim.step([moveCommand(sim, toMove(input.held()))])
        // A rejected command is a bug in this page's input code; the browser journeys fail on any console error.
        for (const rejected of result.rejected) console.error('base-2d: the sim rejected a command', rejected)
        renderer.apply(result)
        if (result.events.some((event) => event.type === 'goal.reached')) dispatch('goal')
      },
      onFrame: () => {
        renderer.draw(performance.now())
        showPlayer()
      },
    })

    // A new round gets a fresh sim, so play always starts from the same state (rounds.ts makes one at a time and
    // keeps only the newest). The host hears of the round when Play is pressed, not when its sim arrives, so a
    // Quit before the sim arrives still ends a round that has started.
    const rounds = createRounds(firstSim, makeSim, {
      onReady: () => {
        if (screen === 'room') loop.start()
      },
      onFailed: (error) => failure.fail(error),
    })
    const onResize = () => renderer.fitToHost()
    // Out of sim worlds or memory: nothing to play on, for good (failure.ts).
    const failure = createFailure({
      root,
      html: document.documentElement,
      stopLoop: () => loop.stop(),
      endRound: (outcome) => Effect.runSync(hosting.round.end(outcome)),
      cleanups: [
        () => input.dispose(),
        () => window.removeEventListener('resize', onResize),
        () => renderer.destroy(),
      ],
      log: (error) => console.error('base-2d: could not make a sim for the round', error),
    })
    const startRound = () => {
      renderer.reset()
      delete root.dataset.hash
      Effect.runSync(hosting.round.start)
      rounds.start()
    }

    dispatch = (event) => {
      if (failure.failed()) return
      const from = screen
      const to = next(from, event)
      if (to === from) return
      screen = to
      if (from === 'room') loop.stop()
      if (to === 'room') {
        // Resuming while a round is still starting waits for its sim; the round starts the loop itself.
        if (from === 'paused') {
          if (!rounds.starting()) loop.start()
        } else startRound()
      }
      if (event === 'goal') {
        Effect.runSync(hosting.round.end('complete'))
        // The sim's state hash where the round ended, for the browser journeys: the same golden route must end
        // on the same hash in every build target (PUB spec §12 PUB-c), as data-tick shows the tick.
        root.dataset.hash = rounds.current().hash()
      }
      if (event === 'quit' && from === 'paused') Effect.runSync(hosting.round.end('quit'))
      const seconds = to === 'end' ? rounds.current().tick / TICK_HZ : undefined
      screens.show(to, seconds === undefined ? {} : { seconds })
      if (to === 'room' && !rounds.starting()) renderer.draw(performance.now())
    }

    yield* Effect.forkIn(
      Stream.runForEach(hosting.lifecycle.changes, (change) =>
        Effect.sync(() => {
          if (change.state === 'background') dispatch('background')
        }),
      ),
      page,
    )
    window.addEventListener('resize', onResize)

    screens.show('splash')
    renderer.draw(performance.now())
    setTimeout(() => dispatch('continue'), SPLASH_MS)
  })
}
