// worldkit-sky: a street at night under stars and rain, its lamp glowing, from the world kit's look passes
//
// Shows: a time of day and the look passes the world kit adds to it (`@automata/world-kit/sky`). Core's look has no
//   stars, rain or glow; the kit adds each as a pass under its own name with `addLookPass`, once, before the renderer is
//   made. `timeOfDay('night')` says how thick the stars are and how dark the sky is, and the renderer reads it
//   (`time`); the rain streaks over everything and the glow steps out from the brightest pixels, here the street lamp's
//   bulb. A game that wants a clear night adds only the stars and the glow.
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/world-kit
// Difficulty: ★★★★
// Tier: extension
import '@automata/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  render3dExtension,
  swatchColour,
  targetSize,
  timeOfDay,
} from '@automata/3d'
import { defineGame, definePlugin } from '@automata/framework'
import { dressedBaseScenes, worldKitExtension, worldKitLibrary } from '@automata/world-kit'
import { addSkyPasses, skyLookPasses } from '@automata/world-kit/sky'

// --- look ---
// Stars, a glow and a light rain: the passes run in that order, after core's own.
const passes = { stars: true, glow: true, rain: { density: 0.4 } }
addSkyPasses(passes)
const night = timeOfDay('night')

// --- level ---
// The base street (a pavement before a building face, a road, a street lamp and a tree) with its shops furnished.
const world = buildWorld(dressedBaseScenes['base-exterior-dressed'], worldKitLibrary, { night: true })

// --- game ---
// The sim has nothing in it: the street is scenery.
export default defineGame({
  id: 'worldkit-sky',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension, worldKitExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      time: night,
      backgroundColor: 0x23324d, // the night sky's middle colour; the stars are drawn where it shows
      views: {},
      scene: (view, stage, occluders) => {
        view.camera.position.set(0.5, 2, 7)
        view.camera.lookAt({ x: -0.5, y: 1.6, z: -2 })
        view.environment = { skyColor: 0xa9b8e8, groundColor: 0x4a5a8a }
        const colourOf = (swatch: string) => swatchColour(worldKitLibrary, swatch)
        drawWorld({ parent: view.root, occluders, colourOf, look: DEFAULT_LOOK }, world.pieces)
        // What the scene is lit as and the passes it added, for the journey.
        stage.app.canvas.dataset.time = night.name
        stage.app.canvas.dataset.passes = skyLookPasses(passes)
          .map((pass) => pass.name)
          .join(',')
        return undefined
      },
    }),
})
