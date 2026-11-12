import { content } from 'virtual:automata/content'
import { controlsFileSchema } from '@automata/content/controls'
import { levelAnchors, placeScript } from '@automata/cutscenes/sim'
import { cutsceneStage2d } from '@automata/cutscenes/stage-2d'
import { controlsFrom, defaultContent, defineGame, mergeStageHooks } from '@automata/framework'
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

// The cutscenes' actors are the placed characters named in the editor. A key that names `actor:keeper` starts where
// Levels places him, and the rest are points in metres.
const SCRIPTS_PLACED = Object.fromEntries(
  Object.entries(SCRIPTS).map(([id, script]) => {
    const placed = placeScript(script, levelAnchors(startLevel, METRE))
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

/** The default controls, as content/controls.toml. */
if (content.controls === undefined) throw new Error('There is no controls file. Add content/controls.toml.')
const CONTROLS = controlsFileSchema.parse(content.controls)

/** 2D Story: a square the player moves around the level, a keeper to talk to, a cutscene and a guard. */
export const game = defineGame({
  id: 'story',
  title: '2D Story',
  size: { width: LEVEL.width, height: LEVEL.height },
  sim: { plugins: PLUGINS, seed: 1, setup },
  extensions: EXTENSIONS,
  // The default screens' flow, and the level as the sim's content (what its systems read as `ctx.content`).
  content: { ...defaultContent(), sim: LEVEL },
  // The keys, pad buttons and touch buttons are content/controls.toml, which the Tuner edits.
  input: controlsFrom(Move, CONTROLS),
  views: squareView,
  // The level's tiles and placed characters, drawn by core from what the editor saved.
  level: LEVEL_SCENE,
  // The camera places the world each frame; Feel's shake, flash, freeze, squash and words play on top of it.
  renderer: { setup: (stage) => mergeStageHooks(storyCamera(stage), feelOnStage(stage)) },
  // The sounds the event map names and the music the rules pick, played on the game's own audio buses.
  audio,
})
