// worldkit-sky: a street at night under stars and rain, its lamp glowing, from the look's own passes
//
// Shows: a time of day with rain and the look's sky, stars, glow and rain. The look builds them from its switches
//   (`look.switches`) and the time of day (`stars` and `rain`), in that order, between the DUEL snap and the finish: nothing
//   is added by hand. The sky is a pass of its own, so the renderer draws no sky fill (`backgroundColor` is only the colour
//   under the field); the rain streaks over everything and the glow steps out from what glows, here the street lamp's bulb.
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★★★
// Tier: core
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
import { coreLibrary, DRESSED_BASE_SCENES } from '@automata/3d/base'
import { defineGame, definePlugin } from '@automata/framework'

// --- look ---
// Rain is the time of day's: a night with a light rain.
const night = timeOfDay('night', { scene: { rain: { density: 0.4, colour: '#88d6ff' } } })

// --- level ---
// The base street (a pavement before a building face, a road, a street lamp and a tree) with its shops furnished.
const world = buildWorld(DRESSED_BASE_SCENES['base-exterior-dressed'], coreLibrary, { night: true })

// --- game ---
// The sim has nothing in it: the street is scenery.
export default defineGame({
  id: 'worldkit-sky',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      time: night,
      backgroundColor: 0x23324d, // under the field only: the sky is the look's pass
      views: {},
      scene: (view, stage, occluders) => {
        view.camera.position.set(0.5, 2, 7)
        view.camera.lookAt({ x: -0.5, y: 1.6, z: -2 })
        view.environment = { skyColor: 0xa9b8e8, groundColor: 0x4a5a8a }
        const colourOf = (swatch: string) => swatchColour(coreLibrary, swatch)
        drawWorld({ parent: view.root, occluders, colourOf, look: DEFAULT_LOOK }, world.pieces)
        // What the scene is lit as and the passes it added, for the journey.
        stage.app.canvas.dataset.time = night.name
        stage.app.canvas.dataset.passes = view.passes
          .map((pass) => pass.constructor.name)
          .filter((name) => /^(Sky|Glow|Rain)Effect$/.test(name))
          .join(',')
        return undefined
      },
    }),
})
