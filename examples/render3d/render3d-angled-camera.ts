// render3d-angled-camera: the angled camera, cut-away walls and a fading pillar
//
// Shows: the angled camera (a 24 mm lens, here 30° down and 8 m back) follows the player around a 4 m room while
//   the heading turns. Each frame the occluder rule takes the near walls away (a floor trim keeps the room's outline,
//   with a 150 ms fade and 5° of hysteresis), never draws the ceiling, and fades the pillar to 25% when it stands
//   between the camera and the player. The view keeps the whole floor in frame at 4:3 and 21:9 (D3-g).
// Controls: none
// Packages: @mcthaydt/automata, @mcthaydt/automata-render-pixi3d
// Difficulty: ★★★☆
// Tier: core
import '@mcthaydt/automata-render-pixi3d/no-eval'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@mcthaydt/automata'
import { box, createPixi3dRenderer, render3dExtension } from '@mcthaydt/automata-render-pixi3d'
import {
  CameraHeading,
  cameraHeadingPlugin,
  cameraView,
  enterView,
  START,
  turnCamera,
} from '@mcthaydt/automata-render-pixi3d/sim'

const ROOM = cameraView('room', { tiltDeg: 30, distance: 8 })

// The player's feet, in metres on the floor (y up).
const Body = defineComponent('body', { x: 'f32', y: 'f32', z: 'f32' })

// The player walks a 2 m square around the pillar, 0.02 m a tick, while the camera turns 64 units (0.35°) a tick.
const walk = defineSystem('walk', (ctx) => {
  const lap = ctx.tick % 400
  const side = Math.floor(lap / 100)
  const along = (lap % 100) / 50 // 0 to 2 metres along this side
  const [x, z] = [
    [1 + along, 1],
    [3, 1 + along],
    [3 - along, 3],
    [1, 3 - along],
  ][side] as [number, number]
  for (const player of ctx.query(Body, CameraHeading)) {
    player.set(Body, { x, z })
    player.set(CameraHeading, turnCamera(player.get(CameraHeading), 64))
  }
})

const room = definePlugin({ name: 'room', defs: [Body, walk] })

// Walls run with the room on their left, so their inside faces look into it.
const WALLS = [
  [0, 0, 4, 0],
  [4, 0, 4, 4],
  [4, 4, 0, 4],
  [0, 4, 0, 0],
] as const
const PILLAR = { min: [1.8, 0, 1.8], max: [2.2, 2.2, 2.2] } as const

export default defineGame({
  id: 'render3d-angled-camera',
  size: { width: 320, height: 180 },
  sim: {
    // The heading's plugin is named here: the runtime does not yet add an extension's sim plugins to the sim.
    plugins: [cameraHeadingPlugin, room],
    seed: 1,
    setup: (sim) => {
      sim.spawn([
        [Body, { x: 1, y: 0, z: 1 }],
        [CameraHeading, enterView(START, ROOM, { x: 0, y: 0 })],
      ])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      views: { [Body.id]: box({ width: 0.5, height: 1.62, depth: 0.3 }, { color: 0xf9c22b }) },
      camera: { views: [ROOM], initial: ROOM.id, follow: Body.id },
      // The room is static scenery, registered with the occluder rule: walls, the ceiling and a tall prop.
      scene: (view, _stage, occluders) => {
        view.environment = { skyColor: 0xc7dcd0, groundColor: 0x3e3546 }
        occluders.box({ min: [0, -0.1, 0], max: [4, 0, 4] }, 0x8b9bb4)
        for (const [ax, az, bx, bz] of WALLS)
          occluders.wall({ a: { x: ax, z: az }, b: { x: bx, z: bz }, height: 2.5, color: 0x5a6988 })
        occluders.ceiling(occluders.box({ min: [0, 2.5, 0], max: [4, 2.6, 4] }, 0x262b44))
        occluders.prop(occluders.box(PILLAR, 0xc0cbdc), { bounds: PILLAR })
        return undefined
      },
    }),
})
