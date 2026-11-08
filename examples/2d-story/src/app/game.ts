import { placeScript } from '@automata/cutscenes/sim'
import { cutsceneStage2d } from '@automata/cutscenes/stage-2d'
import { type Camera2d, createCamera2d, defaultContent, defineGame, keys } from '@automata/framework'
import { LEVEL } from '../features/level/level.ts'
import { project, startLevel } from '../features/level/level-content.ts'
import { images, LEVEL_SCENE } from '../features/level/level-scene.ts'
import { Move } from '../features/square/move.command.ts'
import { squareView } from '../features/square/square.view.ts'
import { EXTENSIONS } from '../features/story/story.extensions.ts'
import { SCRIPTS } from '../features/story/story-content.ts'
import { METRE } from '../shared/constants.ts'
import { PLUGINS, setup } from './story-sim.ts'

/**
 * The camera the cutscene points. The renderer makes its stage (and with it the container a camera moves) after the game is
 * defined, so this one forwards to the camera made there (`renderer.setup`) and does nothing before it exists.
 */
let camera: Camera2d | undefined
const cutsceneCamera: Camera2d = {
  target: (x, y) => camera?.target(x, y),
  shake: (amount) => camera?.shake(amount),
  update: (seconds) => camera?.update(seconds),
  get transform() {
    return camera?.transform ?? { x: 0, y: 0, scale: 1 }
  },
}

// The cutscenes' actors are the placed characters named in the editor, and their points are in metres, so they are placed
// as written: this story's scripts name no anchor.
const SCRIPTS_PLACED = Object.fromEntries(
  Object.entries(SCRIPTS).map(([id, script]) => {
    const placed = placeScript(script, () => undefined)
    if (!placed.ok)
      throw new Error(
        `The cutscene "${id}" names ${placed.missing.join(', ')}, which this story cannot place.`,
      )
    return [id, placed.script] as const
  }),
)
LEVEL_SCENE.add(
  cutsceneStage2d({
    scene: LEVEL_SCENE,
    project,
    level: startLevel,
    images,
    camera: cutsceneCamera,
    metre: METRE,
    scripts: SCRIPTS_PLACED,
    view: { width: LEVEL.width, height: LEVEL.height },
  }),
)

/** 2D Story: a square the player moves around the level, a keeper to talk to, a cutscene and a guard. */
export const game = defineGame({
  id: 'story',
  title: '2D Story',
  size: { width: LEVEL.width, height: LEVEL.height },
  sim: { plugins: PLUGINS, seed: 1, setup },
  extensions: EXTENSIONS,
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
  renderer: {
    setup: (stage) => {
      // The level fits the view, so the camera stays framed on it; it is here for a cutscene to point.
      camera = createCamera2d(stage.world, {
        view: { width: LEVEL.width, height: LEVEL.height },
        bounds: { x: 0, y: 0, width: LEVEL.width, height: LEVEL.height },
      })
      camera.target(LEVEL.width / 2, LEVEL.height / 2)
      return { draw: (frame) => camera?.update(frame.frameMs / 1000) }
    },
  },
})
