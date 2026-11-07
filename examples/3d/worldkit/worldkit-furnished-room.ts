// worldkit-furnished-room: an empty room that asks to be an office, and the world-kit extension furnishing it
//
// Shows: the world kit (`@automata/world-kit`) furnishing a room from one word. The level is plain data: one room
//   with `dress = { as: 'office', seed: 3 }`. `dressLevel` reads the kit the library has under that name (desks, chairs,
//   cabinets, a bookcase, signs, clutter, a ceiling lamp), places each as an ordinary prop with an id like
//   `office:furniture:2`, paints the room with the kit's surfaces and takes `dress` off, so core builds and draws
//   the result with no extension. The same seed gives the same room; `problems` is empty when all went well.
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
import type { AfSector2 } from '@automata/3d/level'
import { defineGame, definePlugin } from '@automata/framework'
import { dressLevel, worldKitExtension, worldKitLibrary } from '@automata/world-kit'

// --- level ---
// A game writes this as content/levels/office.af-sector.json; here it is inline. Corners run round the room, x east
// and z south, in metres.
const bare: AfSector2 = {
  format: 'af-sector/2',
  name: 'office',
  sectors: [
    {
      id: 'office',
      floor: { z: 0 },
      ceiling: { z: 2.7 },
      light: 1,
      dress: { as: 'office', seed: 3 },
      corners: [
        [-3, -2.5],
        [3, -2.5],
        [3, 2.5],
        [-3, 2.5],
      ],
    },
  ],
}
const { level, problems } = dressLevel(bare, worldKitLibrary)
const world = buildWorld(level, worldKitLibrary)

// --- game ---
// The sim has nothing in it: the room is scenery.
export default defineGame({
  id: 'worldkit-furnished-room',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension, worldKitExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      views: {},
      scene: (view, stage, occluders) => {
        view.camera.position.set(0, 4.2, 5.2)
        view.camera.lookAt({ x: 0, y: 0.4, z: 0 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        const colourOf = (swatch: string) => swatchColour(worldKitLibrary, swatch)
        drawWorld({ parent: view.root, occluders, colourOf, look: DEFAULT_LOOK }, world.pieces)
        // What the scene drew, for the journey: the dresser's problems and how many pieces the room came to.
        stage.app.canvas.dataset.problems = String(problems.length + world.problems.length)
        stage.app.canvas.dataset.pieces = String(world.pieces.length)
        return undefined
      },
    }),
})
