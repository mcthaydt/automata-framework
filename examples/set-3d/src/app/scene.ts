// `scene(options)`: the one entry every 3D example calls. It returns a game definition that draws the station and
// nothing else yet; the walker, the cast and the zone's view are added to it, and an example adds its one thing.
import '@automata/3d/no-eval'
import { content } from 'virtual:automata/content'
import {
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  render3dExtension,
  swatchColour,
  targetSize,
} from '@automata/3d'
import { defineGame } from '@automata/framework'
import { SCENE_ZONES } from '../shared/station.ts'
import { placeOf, worldLibraryOf } from './place.ts'
import type { SceneCast, SceneOptions } from './scene-options.ts'

/** The characters an example may put in the place: a character file's id each. None until the cast is written. */
export const SCENE_CAST: readonly SceneCast[] = []

/** Throws, naming the choices, for a start or a cast member the set does not have. */
function check(options: SceneOptions): void {
  if (!SCENE_ZONES.includes(options.start))
    throw new Error(`There is no zone called "${options.start}". The zones are: ${SCENE_ZONES.join(', ')}`)
  for (const member of options.cast ?? [])
    if (!SCENE_CAST.includes(member))
      throw new Error(
        `There is no character called "${member}". The characters are: ${SCENE_CAST.join(', ')}`,
      )
}

/** One example: the station with the example's one thing switched on. */
export function scene(options: SceneOptions) {
  check(options)
  return defineGame({
    id: 'set-3d',
    title: 'The station',
    size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
    sim: { plugins: [], seed: 1 },
    // The example's one thing comes after the renderer's extension, which the place needs.
    extensions: [render3dExtension, ...(options.extensions ?? [])],
    createRenderer: (rendering) =>
      createPixi3dRenderer({
        ...rendering,
        look: DEFAULT_LOOK,
        // The walker and the cast are views of the sim's rows; this skeleton's sim has none yet.
        views: {},
        scene: (view, _stage, occluders) => {
          const library = worldLibraryOf(content)
          const place = placeOf(options, library)
          view.camera.position.set(0, 2.2, 3.5)
          view.camera.lookAt({ x: 0, y: 0.8, z: -1 })
          view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
          drawWorld(
            {
              parent: view.root,
              occluders,
              colourOf: (swatch) => swatchColour(library, swatch),
              look: DEFAULT_LOOK,
            },
            place.world.pieces,
          )
          return undefined
        },
      }),
  })
}
