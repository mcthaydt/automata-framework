// games/base-3d: AF's free 3D game, Emberwick in 3D (the rescope spec), as one `defineGame` call (DX.3) that the page
// starts (GL spec §4.6). Wick walks one room under the angled free-turn camera, takes embers, and rolls across the
// channels that walking cannot cross to reach the goal ember. The flow, saves and settings follow Emberwick's.
//
// Controls: WASD, the arrows, the left stick or the touch stick to walk; Q and E, the right stick or a drag to turn the
// camera; Space, K, A or the Roll button to roll; Escape to pause.
// Packages: @automata/framework, @automata/sim, @automata/figures,
// @automata/render-pixi3d; @automata/content (its Vite plugin) and @automata/tools.
import '@automata/render-pixi3d/no-eval'
import { content } from 'virtual:automata/content'
import type { FigureDef } from '@automata/figures'
import type { QualityTier } from '@automata/framework'
import { defineGame, type GameSaves, inputs, keys, startGame } from '@automata/framework'
import { createPixi3dRenderer, figure, render3dExtension } from '@automata/render-pixi3d'
import { CameraTurn, STICK_MAX } from '@automata/render-pixi3d/sim'
import { Act, Move } from './commands.ts'
import { Ember, Hero } from './components.ts'
import { TICK_HZ } from './constants/index.ts'
import { ROOM } from './content/room.ts'
import * as paraglideRuntime from './paraglide/runtime.js'
import { cameraTurnUnits, endGroup, moveFromStick } from './screens/controls.ts'
import { BASE3D_COPY } from './screens/copy.ts'
import { BASE3D_FLOW } from './screens/flow.ts'
import { hudExtension } from './screens/hud.extension.ts'
import { base3dSaves } from './screens/saves.ts'
import { base3dScreens } from './screens/screens.ts'
import { base3dSettings } from './screens/settings.ts'
import { base3dSim } from './state/index.ts'
import { compileArea } from './systems/index.ts'
import { emberView } from './views/ember.ts'
import { buildScene, FOG, figureContent, heroFigureState, inMetres, placed } from './views/index.ts'

// Compiling the room is boot's content cost: measured, so G3-u's journey holds it to a budget.
performance.mark('base-3d:compile-areas:start')
const AREA = compileArea(ROOM)
/** The keys' and touch buttons' labels, in the source language: the input map is data, read once at boot (G3-t). */
const KEYS = BASE3D_COPY.en.keys
performance.measure('base-3d:compile-areas', 'base-3d:compile-areas:start')
/** The game's sim over the room; the sim takes it as data (`base3dSim`). */
const BASE3D_SIM = base3dSim(AREA)

/** The keyboard's camera turn, 120° a second (M4-D16): 65,536 × 120 / 360 / 60 ≈ 364 turn units a tick. */
const KEY_TURN = Math.round((65_536 * 120) / 360 / TICK_HZ)

/**
 * The left stick, WASD and the arrows move (`move` is the stick, M4-D2); Q and E, the right stick and a camera drag turn
 * the camera; Space, K, A and the Roll button roll. Each is its own command, sent every tick (the sim finds the
 * press); the one touch button is in the `end` group, required.
 */
const MOVE = keys(
  Move,
  {
    KeyW: { y: -STICK_MAX },
    ArrowUp: { y: -STICK_MAX },
    KeyS: { y: STICK_MAX },
    ArrowDown: { y: STICK_MAX },
    KeyA: { x: -STICK_MAX },
    ArrowLeft: { x: -STICK_MAX },
    KeyD: { x: STICK_MAX },
    ArrowRight: { x: STICK_MAX },
  },
  { idle: { x: 0, y: 0 }, touch: false, analog: { touchStick: true, read: moveFromStick } },
)
const TURN = keys(
  CameraTurn,
  { KeyQ: { units: -KEY_TURN }, KeyE: { units: KEY_TURN } },
  { idle: { units: 0 }, touch: false, analog: { drag: true, read: cameraTurnUnits } },
)
const ROLL_KEYS = keys(
  Act,
  { Space: { roll: true }, KeyK: { roll: true } },
  { idle: { roll: false }, pad: { 0: { roll: true } }, labels: { Space: KEYS.roll }, required: ['Space'] },
)
export const input = endGroup(inputs(MOVE, TURN, ROLL_KEYS), { Space: KEYS.roll })

// The figure content (src/content/figure*), compiled by the content plugin with the figures extension's kinds.
const { figures, library, motion } = figureContent(content)

/**
 * Sim presentation time in seconds: the last step's tick at 60 Hz. The figure samples its clips on it, because the sim
 * stamps an action's start in ticks (`hero-action.startedAt`), so a pause or a slow frame never runs a clip ahead of the sim.
 */
let simTick = 0
const now = (): number => simTick / TICK_HZ

const TITLE = BASE3D_COPY.en.title
/** The camera's heading plugin and its `camera-view` content kind, and the HUD on play. */
const EXTENSIONS = [render3dExtension, hudExtension]
/** The stage, once the renderer has made it: the screens give it the player's graphics quality (M4.4). */
let stage: { setQuality(tier: QualityTier): void } | undefined
/** The one slot (state/save.ts): the menu lists it, and play keeps the loaded one saved. One instance for both. */
const saves = base3dSaves()

export const base3d = defineGame({
  id: 'base-3d',
  title: TITLE,
  size: { width: 844, height: 390 },
  orientation: 'landscape',
  sim: BASE3D_SIM,
  extensions: EXTENSIONS,
  input,
  content: { ...BASE3D_FLOW, sim: BASE3D_SIM.content },
  saves,
  settings: base3dSettings,
  // The runtime's `Locale` answers Paraglide's `getLocale`, so `t()` (screens/t.ts) follows it (G3-t).
  locale: paraglideRuntime,
  // Splash, menu, room, paused, Settings and end (screens/screens.ts) over the flow in screens/flow.ts.
  screens: base3dScreens({
    title: TITLE,
    sim: BASE3D_SIM,
    input,
    extensions: EXTENSIONS,
    saves: saves as GameSaves<unknown>,
    setQuality: (tier) => stage?.setQuality(tier),
  }),
  // The sounds the sim's events play (core audio; the files are generated by scripts/make-sounds.ts), fetched with the preload.
  sounds: {
    'ember.taken': 'sounds/ember.wav',
    'goal.reached': 'sounds/goal.wav',
    'hero.fell': 'sounds/fall.wav',
    'hero.rolled': 'sounds/roll.wav',
  },
  preload: ['sounds/ember.wav', 'sounds/goal.wav', 'sounds/fall.wav', 'sounds/roll.wav'],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      setup: (made) => {
        stage = made
        return options.setup?.(made)
      },
      fog: FOG,
      views: {
        [Hero.id]: inMetres(
          figure(figures.wick as FigureDef, { library, motion, now, state: (c) => heroFigureState(c) }),
        ),
        [Ember.id]: emberView(() => performance.now() / 1000),
      },
      camera: {
        views: AREA.views,
        initial: AREA.views[0]?.id ?? 'start',
        follow: Hero.id,
        position: (c) => placed(c.hero),
      },
      scene: (view, _stage, occluders) => {
        buildScene(view, occluders, ROOM)
        return {
          draw: () => {},
          reset: () => {},
          apply(result) {
            simTick = result.tick
            // The tick the page last drew, for the journeys (G3-x: the rotate cover holds it).
            document.documentElement.dataset.tick = String(result.tick)
          },
        }
      },
    }),
})

// The page (index.html) runs this file and the game starts; a test imports `base3d` without starting it, because
// Vitest runs with mode 'test' (GL spec §4.6).
if (import.meta.env.MODE !== 'test') startGame(base3d)
