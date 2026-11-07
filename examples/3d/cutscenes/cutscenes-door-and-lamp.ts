// cutscenes-door-and-lamp: a short scene in a room: the camera drifts in, the lamp warms and the door opens
//
// Shows: a cutscene as data (`@automata/cutscenes`): one script of keyed tracks (the camera, a lamp's level, a door's
//   opening) and a director that answers "what does the scene look like at t seconds?". The sim only counts ticks;
//   the view asks the director each step and moves the camera, turns the door's meshes (`updatePieces`) and scales
//   the room's light by the lamp's level (a baked room would hand the level to the scene light instead).
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/cutscenes
// Difficulty: ★★★☆
// Tier: extension
import '@automata/3d/no-eval'
import {
  buildWorld,
  createPixi3dRenderer,
  DEFAULT_LOOK,
  drawWorld,
  render3dExtension,
  sceneLamps,
  swatchColour,
  targetSize,
  updatePieces,
} from '@automata/3d'
import { BASE_SCENES, baseLibrary } from '@automata/3d/base'
import { noPieceStates } from '@automata/3d/level'
import { createDirector } from '@automata/cutscenes/director'
import type { PlacedScript } from '@automata/cutscenes/sim'
import { defineGame, definePlugin } from '@automata/framework'

// --- level ---
// The base interior with a hinged door in its doorway (a sector's `door`); its pendant lamp is `prop0.light0`.
const base = BASE_SCENES['base-interior']
const level = { ...base, sectors: base.sectors.map((s) => (s.id === 'doorway' ? { ...s, door: {} } : s)) }
const world = buildWorld(level, baseLibrary)
const LAMP = 'prop0.light0'

// --- script ---
// Seconds. A scene is rows on tracks; a key with no `ease` moves smoothly. The lens (24 mm) is the script's.
const script: PlacedScript = {
  id: 'door-and-lamp',
  duration: 6,
  lens: 24,
  camera: [
    { t: 0, pos: [2.8, 1.7, 2.4], look: [-0.2, 1, -1] },
    { t: 6, pos: [1.8, 1.9, 0.6], look: [-0.1, 1, -2.4] },
  ],
  light: [
    { t: 0, lamp: LAMP, level: 0.1 },
    { t: 3, lamp: LAMP, level: 1 },
  ],
  doors: [
    { t: 3, door: 'doorway', open: 0 },
    { t: 5, door: 'doorway', open: 1 },
  ],
}

// --- game ---
// The sim has nothing in it: the scene's clock is its tick.
export default defineGame({
  id: 'cutscenes-door-and-lamp',
  size: targetSize({ width: 844, height: 390 }, DEFAULT_LOOK.pixel.short),
  sim: { plugins: [definePlugin({ name: 'empty', defs: [] })], seed: 1 },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      look: DEFAULT_LOOK,
      views: {},
      scene: (view, stage, occluders) => {
        const colourOf = (name: string) => swatchColour(baseLibrary, name)
        const drawn = drawWorld({ parent: view.root, occluders, colourOf, look: DEFAULT_LOOK }, world.pieces)
        const director = createDirector(script, () => {})
        let shown = noPieceStates()
        return {
          apply: (result) => {
            const scene = director.stateAt(Math.min(result.tick / 60, script.duration))
            updatePieces(drawn, shown, scene)
            shown = scene
            view.camera.position.set(...scene.camera.pos)
            view.camera.lookAt({ x: scene.camera.look[0], y: scene.camera.look[1], z: scene.camera.look[2] })
            view.camera.fov = scene.camera.fov
            const lamp = sceneLamps(world.lamps, true, scene.lamps).find((l) => l.id === LAMP)
            view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c, intensity: lamp?.level ?? 1 }
            const { dataset } = stage.app.canvas
            dataset.cutscene = scene.done ? 'done' : 'playing'
            dataset.door = String(scene.doors.doorway ?? 0)
            dataset.lamp = String(lamp?.level ?? 1)
          },
        }
      },
    }),
})
