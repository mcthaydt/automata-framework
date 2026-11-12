import { content } from 'virtual:automata/content'
import { createPixi3dRenderer, DEFAULT_LOOK, render3dExtension, targetSize } from '@automata/3d'
import { CameraTurn, STICK_MAX } from '@automata/3d/sim'
import { defaultContent, defineGame, inputs, keys } from '@automata/framework'
import { navExtension } from '@automata/nav'
import { sectorsExtension } from '@automata/sectors'
import { spawnAda } from '../features/ada/ada.plugin.ts'
import { Move } from '../features/ada/move.command.ts'
import { TICK_HZ } from '../shared/constants.ts'
import { playOf } from './content.ts'
import { createRuntime } from './runtime.ts'
import { scenePlugin } from './scene.plugin.ts'

const PLAY = playOf(content)
const RUNTIME = createRuntime(PLAY)

/** The keyboard turns the camera 120 degrees a second: 65,536 units a turn, about 364 units a tick. */
const KEY_TURN = Math.round((65_536 * 120) / 360 / TICK_HZ)

// WASD and the arrows walk; the camera turns with Q and E. More controls (the lamp, the inventory, use) arrive with the
// screen (task 14).
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
  { idle: { x: 0, y: 0 } },
)
const TURN = keys(
  CameraTurn,
  { KeyQ: { units: -KEY_TURN }, KeyE: { units: KEY_TURN } },
  { idle: { units: 0 } },
)

/**
 * The Last Light, the framework's 3D reference game. Its picture is the old game's: capped at 640 by 480 (640 by 360
 * in a wide window), which is what `DEFAULT_LOOK`'s short side gives a phone held sideways (844 by 390).
 */
export const game = defineGame({
  id: 'the-last-light',
  title: 'The Last Light',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  orientation: 'landscape',
  sim: {
    plugins: [...RUNTIME.plugins, scenePlugin(RUNTIME)],
    seed: 1,
    setup: (sim) => spawnAda(sim, PLAY.start, PLAY.tuning.WALK_SPEED),
  },
  // The camera's heading is a sim plugin of the 3D extension; defineGame adds it.
  extensions: [render3dExtension, sectorsExtension, navExtension, ...RUNTIME.extensions],
  input: inputs(MOVE, TURN),
  content: { ...defaultContent(), sim: PLAY },
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
