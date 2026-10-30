// base-3d as one `defineGame` call (DX.3): the first slice's sim and the keys that walk Wick, on the default
// screens. M3.7a's page has no renderer yet; M3.7b adds the 3D scene, the figures, the touch stick and the camera
// drag, and the flat layout's `src/main.ts` once `pnpm boundaries` can check a src/ that holds page code (GL.1).
import { defaultContent, defineGame, keys } from '@mcthaydt/automata-game'
import { render3dExtension } from '@mcthaydt/automata-render-pixi3d'
import { STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import { Move } from './src/commands.ts'
import { BASE3D_SIM } from './src/state.ts'

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
