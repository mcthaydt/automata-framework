import { defaultContent, defineGame, keys } from '@automata/framework'
import { LEVEL } from '../features/level/level.ts'
import { LEVEL_SCENE } from '../features/level/level-scene.ts'
import { Move } from '../features/square/move.command.ts'
import { Square } from '../features/square/square.component.ts'
import { squarePlugin } from '../features/square/square.plugin.ts'
import { squareView } from '../features/square/square.view.ts'
import { SQUARE_SIZE } from '../shared/constants.ts'

/** 2D Story: a square the player moves around the level, on the default title, play and pause screens. */
export const game = defineGame({
  id: 'story',
  title: '2D Story',
  size: { width: LEVEL.width, height: LEVEL.height },
  sim: {
    plugins: [squarePlugin],
    seed: 1,
    // The square stands on the level's player start: its bottom edge there, so its centre half a square higher.
    setup: (sim) => {
      sim.spawn([[Square, { x: LEVEL.start.x, y: LEVEL.start.y - SQUARE_SIZE / 2 }]])
    },
  },
  // The default screens' flow, and the level as the sim's content (what its systems read as `ctx.content`).
  content: { ...defaultContent(), sim: LEVEL },
  // Arrows or WASD, or the pad's D-pad; on a touch screen, buttons.
  input: keys(
    Move,
    {
      ArrowLeft: { x: -1 },
      KeyA: { x: -1 },
      ArrowRight: { x: 1 },
      KeyD: { x: 1 },
      ArrowUp: { y: -1 },
      KeyW: { y: -1 },
      ArrowDown: { y: 1 },
      KeyS: { y: 1 },
    },
    { pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } } },
  ),
  views: squareView,
  // The level's tiles and placed characters, drawn by core from what the editor saved.
  level: LEVEL_SCENE,
})
