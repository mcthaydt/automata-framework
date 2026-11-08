// cutscenes-door-and-lamp: a short scene in a room: the camera drifts in, the lamp warms and the door opens
//
// Shows: a cutscene as data (`@automata/cutscenes`): one script of keyed tracks (the camera, a lamp's level, a door's
//   opening) and a director that answers "what does the scene look like at t seconds?". The sim only counts ticks;
//   the view asks the director each step and moves the camera, turns the door's meshes (`updatePieces`) and hands the
//   lamp's level to the scene light (`light.setLevels`), which rebakes only the walls and the floor the lamp reaches.
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
  sceneLightingSchema,
  swatchColour,
  targetSize,
  updatePieces,
} from '@automata/3d'
import { BASE_SCENES, baseLibrary } from '@automata/3d/base'
import { noPieceStates } from '@automata/3d/level'
import { createDirector } from '@automata/cutscenes/director'
import type { PlacedScript } from '@automata/cutscenes/sim'
import { showScene3d } from '@automata/cutscenes/stage-3d'
import { defineGame, definePlugin } from '@automata/framework'

// --- level ---
// The base interior with a hinged door in its doorway (a sector's `door`); its pendant lamp is `prop0.light0`.
const base = BASE_SCENES['base-interior']
const level = { ...base, sectors: base.sectors.map((s) => (s.id === 'doorway' ? { ...s, door: {} } : s)) }
const world = buildWorld(level, baseLibrary)
const LAMP = 'prop0.light0'

// The room's light is the world's own lamps; the pendant starts dim because the script's first key says so.
const lighting = sceneLightingSchema.parse({
  ambient: 0.4,
  lamps: sceneLamps(world.lamps).map((lamp) => ({ ...lamp, strength: 3 })),
})

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
      lighting,
      views: {},
      scene: (view, stage, occluders, light) => {
        const colourOf = (name: string) => swatchColour(baseLibrary, name)
        const drawn = drawWorld(
          { parent: view.root, occluders, colourOf, look: DEFAULT_LOOK, light },
          world.pieces,
        )
        // The door swings, so it keeps a plain lit mesh under the room's ambient light.
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c, intensity: 0.8 }
        const director = createDirector(script, () => {})
        let shown = noPieceStates()
        const show = showScene3d({
          camera: {
            set: (shot) => {
              view.camera.position.set(...shot.pos)
              view.camera.lookAt({ x: shot.look[0], y: shot.look[1], z: shot.look[2] })
              view.camera.fov = shot.fov
            },
          },
          pieces: (scene) => {
            updatePieces(drawn, shown, scene)
            shown = scene
          },
          lamps: (levels) => {
            const lamp = sceneLamps(world.lamps, true, levels).find((l) => l.id === LAMP)
            light?.setLevels({ [LAMP]: lamp?.level ?? 1 })
          },
        })
        return {
          apply: (result) => {
            const scene = director.stateAt(Math.min(result.tick / 60, script.duration))
            show(scene)
            const { dataset } = stage.app.canvas
            dataset.cutscene = scene.done ? 'done' : 'playing'
            dataset.door = String(scene.doors.doorway ?? 0)
            dataset.lamp = String(light?.level(LAMP) ?? 1)
          },
        }
      },
    }),
})
