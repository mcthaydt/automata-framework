// games/base-3d: AF's 3D base game, The Cold Kiln (games/base-3d/DESIGN.md), Emberwick's 3D counterpart, as one
// `defineGame` call (DX.3) that the page starts (GL spec §4.6).
//
// Shows (M3.7a): the first slice's sim on `startGame` with the default screens: Wick walks the hall and the kiln
// relative to the camera's heading. Nothing is drawn yet; M3.7b adds the 3D scene, the figures, the touch stick and
// the camera drag.
// Controls: WASD or the arrows to move, Escape to pause.
// Packages: @mcthaydt/automata-game, @mcthaydt/automata-sim, @mcthaydt/automata-render-pixi3d (its sim entry);
// @mcthaydt/automata-ship for packaging.
import '@mcthaydt/automata-game/no-eval'
import { defaultContent, defineGame, keys, startGame } from '@mcthaydt/automata-game'
import { render3dExtension } from '@mcthaydt/automata-render-pixi3d'
import { STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import { Move } from './commands.ts'
import { FIRST_SLICE } from './content/first-slice.ts'
import { base3dSim } from './state.ts'
import { compileArea } from './systems.ts'

/** The game's sim on the first slice; the sim takes the area as data (state.ts `base3dSim`). */
const BASE3D_SIM = base3dSim(compileArea(FIRST_SLICE))

/** WASD and the arrows push the stick to its edge (`move` is the stick, M4-D2); nothing held is a centred stick. */
export const input = keys(
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
  { idle: { x: 0, y: 0 } },
)

export const base3d = defineGame({
  id: 'base-3d',
  title: 'The Cold Kiln',
  size: { width: 844, height: 390 },
  orientation: 'landscape',
  sim: BASE3D_SIM,
  // The camera's heading plugin and its `camera-view` content kind.
  extensions: [render3dExtension],
  input,
  content: { ...defaultContent(), sim: BASE3D_SIM.content },
})

// The page (index.html) runs this file and the game starts; a test imports `base3d` without starting it, because
// Vitest runs with mode 'test' (GL spec §4.6).
if (import.meta.env.MODE !== 'test') startGame(base3d)
