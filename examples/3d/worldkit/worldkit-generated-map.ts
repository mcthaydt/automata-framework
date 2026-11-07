// worldkit-generated-map: an apartment the world kit generates from a number, furnished, seen from above
//
// Shows: a whole place as a generator and a seed (`@automata/world-kit`): `generateMap('apartment', 7)` makes an
//   `af-sector/2` level (a corridor with four to six rooms, a ramp and a landing), and every room in it asks to be dressed,
//   so `dressLevel` furnishes each from its kit. The same number gives the same level in every engine; change the
//   seed and the rooms, their sizes and their furniture change. The camera looks down on the plan.
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/world-kit
// Difficulty: ★★★☆
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
} from '@automata/3d'
import { defineGame, definePlugin } from '@automata/framework'
import { dressLevel, generateMap, worldKitExtension, worldKitLibrary } from '@automata/world-kit'

// --- level ---
const { level, problems } = dressLevel(generateMap('apartment', 7), worldKitLibrary)
const world = buildWorld(level, worldKitLibrary)
// The plan's middle and widest side, for the camera to stand over.
const corners = level.sectors.flatMap((sector) => sector.corners)
const [xs, zs] = [corners.map((c) => c[0]), corners.map((c) => c[1])]
const middle = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] as const
const reach = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * 1.8)

// --- game ---
// The sim has nothing in it: the apartment is scenery.
export default defineGame({
  id: 'worldkit-generated-map',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension, worldKitExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      views: {},
      scene: (view, stage, occluders) => {
        view.camera.position.set(middle[0], reach * 0.75, middle[1] + reach * 0.4)
        view.camera.lookAt({ x: middle[0], y: 0, z: middle[1] })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        const colourOf = (swatch: string) => swatchColour(worldKitLibrary, swatch)
        drawWorld({ parent: view.root, occluders, colourOf, look: DEFAULT_LOOK }, world.pieces)
        // What the scene drew, for the journey.
        stage.app.canvas.dataset.problems = String(problems.length + world.problems.length)
        stage.app.canvas.dataset.sectors = String(level.sectors.length)
        stage.app.canvas.dataset.pieces = String(world.pieces.length)
        return undefined
      },
    }),
})
