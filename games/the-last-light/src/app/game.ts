import { content } from 'virtual:automata/content'
import { createPixi3dRenderer, render3dExtension } from '@automata/3d'
import { cameraYawPlugin, STICK_MAX } from '@automata/3d/sim'
import { defaultContent, defineGame, inputs, keys } from '@automata/framework'
import { prefersReducedMotion, typedFor } from '@automata/narrative'
import { sectorsExtension } from '@automata/sectors'
import { InSector } from '@automata/sectors/sim'
import { SystemsAgent } from '@automata/systems/sim'
import { spawnAda } from '../features/ada/ada.plugin.ts'
import { Move } from '../features/ada/move.command.ts'
import { ADA, NIGHT_NURSE } from '../features/figures/cast.ts'
import {
  type Actors,
  adaMoving,
  adaYaw,
  figureView,
  stepped,
  walkedYaw,
} from '../features/figures/figure-view.ts'
import { LIGHTING, MODEL_FILES, TIME } from '../features/room/room.ts'
import { Ada } from '../shared/ada.component.ts'
import { audio, SOUND_FILES } from './audio.ts'
import { playOf } from './content.ts'
import { BAR_FRACTION, fieldOfWindow } from './field.ts'
import { BAR_COLOR, lookOf } from './look.ts'
import { lookPassesOf, RENDERER_SCALE } from './look-passes.ts'
import { lookProfilesSchema } from './look-profiles.content.ts'
import { actCard, playControls, playHud } from './play.extension.ts'
import { createRuntime, navigation } from './runtime.ts'
import { scenePlugin } from './scene.plugin.ts'
import { cutsceneShot, sceneOf } from './stage.ts'
import { CAMERA_INPUT, moveFromStick } from './touch-controls.ts'
import { lineOf, SCRIPTS, wordsOf } from './words.ts'

const PLAY = playOf(content)

// The old game's retro grade and LCD panel, added once before the renderer is made; both are on in play and in every cutscene. The
// film holds still for a player whose system asks for less motion (the retro pass reads that each frame).
lookPassesOf(lookProfilesSchema.parse(content.look ?? {}))
const RUNTIME = createRuntime(PLAY, {
  words: wordsOf,
  lines: lineOf,
  scripts: SCRIPTS, // A line with a delivery is typed out, unless the player asked their system for less motion.
  typed: (words: string, delivery: Parameters<typeof typedFor>[1], seconds: number) =>
    typedFor(words, delivery, seconds, { reducedMotion: prefersReducedMotion() }),
})

// WASD and the arrows walk; the camera turns by the right stick, a swipe or a mouse drag (`CAMERA_INPUT`), never a key. The lamp, the inventory and skipping a cutscene are on the
// screen's own controls (the HUD and the overlay), since a held key would send them every tick.
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
  // The thumb has a floating stick, not eight key buttons.
  { idle: { x: 0, y: 0 }, touch: false, analog: { touchStick: true, read: moveFromStick } },
)

/** The picture: the old game's, the window's shape capped at 640 by 480 (640 by 360 in a 16:9 window). */
const SIZE = fieldOfWindow()
/** The look with its field's short side the picture's, so the passes that read it draw at this size, and the old game's haze. */
const LOOK = lookOf(SIZE, PLAY.views[0]?.distance ?? 16)

/** The characters a cutscene can place, by who a script calls them. */
const actors: Actors = new Map()

/** The Last Light, the framework's 3D reference game. Its picture is the old game's (`app/field.ts`). */
export const game = defineGame({
  id: 'the-last-light',
  title: 'The Last Light',
  size: SIZE,
  orientation: 'landscape',
  sim: {
    // The free camera turn (`camera-yaw`): the right stick, a swipe and a mouse drag turn the heading smoothly.
    plugins: [cameraYawPlugin, ...RUNTIME.plugins, scenePlugin(RUNTIME)],
    seed: 1,
    setup: (sim) => spawnAda(sim, PLAY.start, PLAY.tuning.WALK_SPEED),
  },
  // The camera's heading is a sim plugin of the 3D extension; defineGame adds it.
  extensions: [
    render3dExtension,
    sectorsExtension,
    navigation,
    ...RUNTIME.extensions,
    playHud(PLAY, RUNTIME),
    actCard,
    playControls,
  ],
  input: inputs(MOVE, CAMERA_INPUT),
  content: { ...defaultContent(), sim: PLAY },
  audio,
  // The night flashes a little (a red wash at a catch, a shake): the first run on a device warns once. The warning's wording will
  // be the game's own to declare (which hazards it has) when the fixes branch that makes it so lands.
  photosensitivity: true,
  preload: [...SOUND_FILES, ...MODEL_FILES],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      // Whole pixels, as the old game drew the picture.
      ...RENDERER_SCALE,
      barFraction: BAR_FRACTION,
      barColor: BAR_COLOR,
      look: LOOK,
      time: TIME,
      lighting: LIGHTING,
      // The furniture's models, loaded before the first frame: a prop that names one draws it in place of its blockout.
      models: MODEL_FILES,
      // The painted figures, as the old game draws them: the sim says where each stands and which way it faces.
      views: {
        [Ada.id]: figureView({ def: ADA, who: () => 'player', yawOf: adaYaw, movingOf: adaMoving }, actors),
        [SystemsAgent.id]: figureView(
          {
            def: NIGHT_NURSE,
            who: (components) => PLAY.systems.agents?.[Number(components['systems.agent']?.index ?? -1)]?.id,
            yawOf: walkedYaw,
            movingOf: stepped,
          },
          actors,
        ),
      },
      // The level names the views; the camera follows Ada through them, and `ada.view` says which she is in.
      camera: {
        views: PLAY.views,
        initial: PLAY.views[0]?.id ?? 'hall',
        follow: InSector.id,
        // While a cutscene draws its own shot the walls are cut for that shot, not for the play camera's.
        drawing: cutsceneShot,
        // Ada's feet: where the sectors say she stands, on the floor.
        position: (components) => {
          const at = components[InSector.id]
          return at === undefined ? undefined : { x: Number(at.x), y: 0, z: Number(at.z) }
        },
      },
      scene: sceneOf({ play: PLAY, actors, size: SIZE }),
    }),
})
