// games/base-3d: AF's 3D base game, The Cold Kiln (games/base-3d/DESIGN.md), Emberwick's 3D counterpart, as one
// `defineGame` call (DX.3) that the page starts (GL spec §4.6).
//
// Shows (M3.7b part 3): the first slice in 3D. Wick (figure content: the pose library, four clips and a sword)
// walks the hall and the kiln under the angled camera, which cuts between the rooms' views at the doorway, turns
// freely, cuts the walls away and fades the pillar; three static props from The Last Light and fog. Shift locks
// onto the second figure: Wick strafes and aims at it, and the camera frames them both. (Part 4) The flow: a splash,
// the menu, the room, paused and Settings, and the end screen when Wick picks up the ember in the kiln.
// Controls: WASD or the arrows to move, Q and E to turn the camera, Shift held to lock, J slash, K held to guard,
// L point, F pick up, Escape to pause. On touch, the same as buttons (the analog stick and the camera drag wait on
// the play screen, GAME-3D.1h).
// Packages: @mcthaydt/automata-game, @mcthaydt/automata-sim, @mcthaydt/automata-figures,
// @mcthaydt/automata-render-pixi3d; @mcthaydt/automata-content (its Vite plugin) and @mcthaydt/automata-ship.
import '@mcthaydt/automata-render-pixi3d/no-eval'
import { content } from 'virtual:automata/content'
import type { FigureDef } from '@mcthaydt/automata-figures'
import { defineGame, inputs, keys, startGame } from '@mcthaydt/automata-game'
import { createPixi3dRenderer, figure, render3dExtension } from '@mcthaydt/automata-render-pixi3d'
import { CameraTurn, STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import type { QualityTier } from '@mcthaydt/automata-runtime'
import { Act, Lock, Move } from './commands.ts'
import { Hero, Target } from './components.ts'
import { TICK_HZ } from './constants.ts'
import { FIRST_SLICE } from './content/first-slice.ts'
import { BASE3D_FLOW } from './screens/flow.ts'
import { base3dScreens } from './screens/screens.ts'
import { base3dSim } from './state/index.ts'
import { compileArea } from './systems/index.ts'
import {
  buildScene,
  FOG,
  figureContent,
  heroFigureState,
  inMetres,
  lockPoint,
  PROPS,
  placed,
} from './views.ts'

const AREA = compileArea(FIRST_SLICE)
/** The game's sim on the first slice; the sim takes the area as data (state.ts `base3dSim`). */
const BASE3D_SIM = base3dSim(AREA)

/** The keyboard's camera turn, 120° a second (M4-D16): 65,536 × 120 / 360 / 60 ≈ 364 turn units a tick. */
const KEY_TURN = Math.round((65_536 * 120) / 360 / TICK_HZ)

const idleAct = { slash: false, guard: false, point: false, pickup: false }

/**
 * WASD and the arrows push the stick to its edge (`move` is the stick, M4-D2), as the left stick's directions do;
 * Q and E turn the camera; Shift held locks; J, K, L and F are the action buttons. Each is its own command, sent
 * every tick (the sim finds the presses).
 */
export const input = inputs(
  keys(
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
    {
      idle: { x: 0, y: 0 },
      stick: {
        'left-up': { y: -STICK_MAX },
        'left-down': { y: STICK_MAX },
        'left-left': { x: -STICK_MAX },
        'left-right': { x: STICK_MAX },
      },
    },
  ),
  keys(CameraTurn, { KeyQ: { units: -KEY_TURN }, KeyE: { units: KEY_TURN } }, { idle: { units: 0 } }),
  keys(
    Lock,
    { ShiftLeft: { down: true }, ShiftRight: { down: true } },
    { idle: { down: false }, labels: { ShiftLeft: 'Lock' } },
  ),
  keys(
    Act,
    { KeyJ: { slash: true }, KeyK: { guard: true }, KeyL: { point: true }, KeyF: { pickup: true } },
    { idle: idleAct, labels: { KeyJ: 'Slash', KeyK: 'Guard', KeyL: 'Point', KeyF: 'Pick up' } },
  ),
)

// The figure content (src/content/figure*), compiled by the content plugin with the figures extension's kinds.
const { figures, library, motion } = figureContent(content)

/**
 * Sim presentation time in seconds: the last step's tick at 60 Hz. The figures sample their clips on it, because
 * the sim stamps an action's start in ticks (`hero-action.startedAt`), so a pause or a slow frame never runs a clip
 * ahead of the sim.
 */
let simTick = 0
const now = (): number => simTick / TICK_HZ
/** The targets' rows by sid, for the hero's aim at the one he locks. */
const targets = new Map<number, { readonly x: number; readonly z: number }>()

const TITLE = 'The Cold Kiln'
/** The camera's heading plugin and its `camera-view` content kind. */
const EXTENSIONS = [render3dExtension]
/** The stage, once the renderer has made it: the screens give it the player's graphics quality (M4.4). */
let stage: { setQuality(tier: QualityTier): void } | undefined

export const base3d = defineGame({
  id: 'base-3d',
  title: TITLE,
  size: { width: 844, height: 390 },
  orientation: 'landscape',
  sim: BASE3D_SIM,
  extensions: EXTENSIONS,
  input,
  content: { ...BASE3D_FLOW, sim: BASE3D_SIM.content },
  // Splash, menu, room, paused, Settings and end (screens/screens.ts) over the flow in screens/flow.ts.
  screens: base3dScreens({
    title: TITLE,
    sim: BASE3D_SIM,
    input,
    extensions: EXTENSIONS,
    setQuality: (tier) => stage?.setQuality(tier),
  }),
  preload: PROPS.map((prop) => prop.file),
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      setup: (made) => {
        stage = made
        return options.setup?.(made)
      },
      fog: FOG,
      models: PROPS.map((prop) => prop.file),
      views: {
        [Hero.id]: inMetres(
          figure(figures.wick as FigureDef, {
            library,
            motion,
            now,
            state: (c) => heroFigureState(c, targets.get(Number(c.hero?.lockTarget ?? 0))),
          }),
        ),
        // The target faces back down the kiln toward the doorway (−z).
        [Target.id]: inMetres(figure(figures.target as FigureDef, { library, motion, now }), Math.PI),
      },
      camera: {
        views: AREA.views,
        initial: 'hall',
        follow: Hero.id,
        position: (c) => placed(c.hero),
        lock: lockPoint,
      },
      scene: (view, _stage, occluders, _light, models) => {
        buildScene(view, occluders, models, FIRST_SLICE)
        return {
          apply(result) {
            simTick = result.tick
            if (result.render.resync) targets.clear()
            for (const sid of result.render.removed) targets.delete(sid)
            for (const row of [...result.render.added, ...result.render.changed]) {
              const target = row.components[Target.id]
              if (target !== undefined) targets.set(row.sid, { x: Number(target.x), z: Number(target.z) })
            }
          },
        }
      },
    }),
})

// The page (index.html) runs this file and the game starts; a test imports `base3d` without starting it, because
// Vitest runs with mode 'test' (GL spec §4.6).
if (import.meta.env.MODE !== 'test') startGame(base3d)
