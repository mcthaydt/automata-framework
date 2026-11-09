// base-3d's screens (M3 spec §4.7): the default screens (`defaultScreens`) for the menu, the room, paused and Settings,
// so play keeps the Input service, the touch overlay and the player's settings, and two of the game's own around them: the
// splash and the end. BASE3D_FLOW says which follows which.
//
// Play is the default play screen with one addition: the sim's `goal.reached` ends the round as complete and moves on to
// the end screen. The round starts when play is entered from the menu and ends as `quit` when Quit leaves paused for the
// menu.
import { type Disposables, defaultScreens, type ScreenDef, type ScreensGame } from '@automata/framework'
import { resolveExtensions } from '@automata/framework/extension'
import type { Sim } from '@automata/sim'
import { flushSync, mount, unmount } from 'svelte'
import { TICK_HZ } from '../constants/index.ts'
import { GoalReached } from '../events.ts'
import { followLocale } from './copy.svelte.ts'
import EndScreen from './EndScreen.svelte'
import { hudInPlay } from './hud.ts'
import SplashScreen from './SplashScreen.svelte'

/** How long the splash shows before moving on by itself. */
export const SPLASH_MS = 1500

/** Mounts a panel in the screen's layer for as long as the screen is open, rendered now for the flow's focus step. */
function show<Props extends Record<string, unknown>>(
  screen: Disposables,
  component: Parameters<typeof mount<Props, Record<string, never>>>[0],
  target: HTMLElement,
  props: Props,
): void {
  const instance = mount(component, { target, props })
  flushSync()
  screen.add(() => void unmount(instance))
}

/** A window listener for as long as the screen is open. */
function listen(screen: Disposables, target: Window, type: string, listener: () => void): void {
  target.addEventListener(type, listener)
  screen.add(() => target.removeEventListener(type, listener))
}

const byId = (screens: readonly ScreenDef[], id: string): ScreenDef => {
  const screen = screens.find((candidate) => candidate.id === id)
  if (screen === undefined) throw new Error(`base-3d: the default screens have no "${id}"`)
  return screen
}

/** The six screens BASE3D_FLOW names, over the default screens for `game`. */
export function base3dScreens(game: ScreensGame): ScreenDef[] {
  // The sim play runs, told by the default screens (`watchSim`): the end screen's time is its tick.
  let running: Sim | undefined
  let seconds = 0
  const defaults = defaultScreens({
    ...game,
    // The sim `defineGame` runs: the game's plugins, then its extensions' (render3dExtension's camera heading), as
    // `defineGame` gives its own default screens; a game that passes its screens passes the sim they make.
    sim: {
      ...game.sim,
      plugins: [...game.sim.plugins, ...resolveExtensions(game.extensions ?? []).simPlugins],
    },
    watchSim: (sim) => {
      running = sim
      hudInPlay.sim = sim
      game.watchSim?.(sim)
    },
  })
  const title = byId(defaults, 'title')
  const play = byId(defaults, 'play')

  const splash: ScreenDef = {
    id: 'splash',
    enter: ({ layer, screen, services }) => {
      const target = layer.ownerDocument.defaultView ?? window
      show(screen, SplashScreen, layer, { title: game.title })
      const next = (): void => void services.flow.dispatch('continue')
      listen(screen, target, 'keydown', next)
      listen(screen, target, 'pointerdown', next)
      const timer = services.clock.setTimeout(next, SPLASH_MS)
      screen.add(() => services.clock.clearTimeout(timer))
    },
  }

  const menu: ScreenDef = {
    ...title,
    enter: (context) => {
      if (context.from === 'paused') context.services.hosting.round.end('quit')
      return title.enter(context)
    },
  }

  const room: ScreenDef = {
    ...play,
    enter: (context) => {
      const { flow, hosting, bus, locale } = context.services
      if (context.from === 'title') hosting.round.start()
      // The game's words (copy.ts) kept in the player's language for as long as the screen is open (DX.2d's way).
      context.screen.add(followLocale(locale))
      context.screen.add(
        bus.subscribe('sim.events', (events) => {
          if (events.some((event) => event.type === GoalReached.id)) {
            seconds = (running?.tick ?? 0) / TICK_HZ
            hosting.round.end('complete')
            flow.dispatch('goal')
          }
        }),
      )
      return play.enter(context)
    },
  }

  const end: ScreenDef = {
    id: 'end',
    enter: ({ layer, screen, services }) => {
      show(screen, EndScreen, layer, {
        time: `${seconds.toFixed(2)} s`,
        onMenu: () => void services.flow.dispatch('quit'),
      })
    },
  }

  const replaced = [title, play]
  return [splash, menu, room, ...defaults.filter((screen) => !replaced.includes(screen)), end]
}
