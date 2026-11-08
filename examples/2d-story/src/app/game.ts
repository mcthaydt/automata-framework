import { placeScript } from '@automata/cutscenes/sim'
import { cutsceneStage2d } from '@automata/cutscenes/stage-2d'
import { defaultContent, defineGame, keys, mergeStageHooks } from '@automata/framework'
import { LEVEL } from '../features/level/level.ts'
import { project, startLevel } from '../features/level/level-content.ts'
import { images, LEVEL_SCENE } from '../features/level/level-scene.ts'
import { Move } from '../features/square/move.command.ts'
import { squareView } from '../features/square/square.view.ts'
import { EXTENSIONS } from '../features/story/story.extensions.ts'
import { SCRIPTS } from '../features/story/story-content.ts'
import { METRE } from '../shared/constants.ts'
import { cutsceneCamera, storyCamera } from './story-camera.ts'
import { audio, feelOnStage } from './story-feel-audio.ts'
import { PLUGINS, setup } from './story-sim.ts'

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
  // The camera places the world each frame; Feel's shake, flash, freeze, squash and words play on top of it.
  renderer: { setup: (stage) => mergeStageHooks(storyCamera(stage), feelOnStage(stage)) },
  // The sounds the event map names and the music the rules pick, played on the game's own audio buses.
  audio,
})
