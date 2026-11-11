import { createPixi3dRenderer, DEFAULT_LOOK, render3dExtension, targetSize } from '@automata/3d'
import { CameraTurn } from '@automata/3d/sim'
import { defaultContent, defineGame, inputs, keys } from '@automata/framework'
import { sectorsExtension } from '@automata/sectors'
import { GAME_PLUGINS } from './game-sim.ts'

/** The keyboard turns the camera 120 degrees a second (65,536 units a turn, about 364 a tick); more controls arrive with the features (task 12 and 14). */
const TURN = keys(CameraTurn, { KeyQ: { units: -364 }, KeyE: { units: 364 } }, { idle: { units: 0 } })

/**
 * The Last Light, the framework's 3D reference game. Its picture is the old game's: capped at 640 by 480 (640 by 360
 * in a wide window), which is what `DEFAULT_LOOK`'s short side gives a phone held sideways (844 by 390).
 */
export const game = defineGame({
  id: 'the-last-light',
  title: 'The Last Light',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  orientation: 'landscape',
  sim: { plugins: [...GAME_PLUGINS], seed: 1 },
  extensions: [render3dExtension, sectorsExtension],
  input: inputs(TURN),
  content: { ...defaultContent() },
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      views: {},
      scene: (view) => {
        view.environment = { skyColor: 0x0d1016, groundColor: 0x1a1520 }
        return undefined
      },
    }),
})
