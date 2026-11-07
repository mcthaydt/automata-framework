// render3d-angled-camera: the angled camera, cut-away walls and a fading pillar
//
// Shows: the angled camera (a 24 mm lens, here 30° down and 8 m back) follows the player around a 4 m room while
//   the heading turns. Each frame the occluder rule takes the near walls away (a floor trim keeps the room's outline,
//   with a 150 ms fade and 5° of hysteresis), never draws the ceiling, and fades the pillar to 25% when it stands
//   between the camera and the player. The view keeps the whole floor in frame at 4:3 and 21:9 (D3-g).
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★★☆
// Tier: core
import '@automata/3d/no-eval'
import { box, createPixi3dRenderer, render3dExtension } from '@automata/3d'
import { CameraHeading, cameraView, enterView, START, turnCamera } from '@automata/3d/sim'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automata/framework'

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
    // render3dExtension brings the heading's plugin (RT.EXT1).
    plugins: [room],
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
      backgroundColor: 0xcdd2da, // the sky around the room: the light's sky colour
      views: { [Body.id]: box({ width: 0.5, height: 1.62, depth: 0.3 }, { color: 0xffbc4e }) },
      camera: { views: [ROOM], initial: ROOM.id, follow: Body.id },
      // The room is static scenery, registered with the occluder rule: walls, the ceiling and a tall prop.
      scene: (view, _stage, occluders) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [0, -0.1, 0], max: [4, 0, 4] }, 0x8690b2)
        for (const [ax, az, bx, bz] of WALLS)
          occluders.wall({ a: { x: ax, z: az }, b: { x: bx, z: bz }, height: 2.5, color: 0x615f84 })
        occluders.ceiling(occluders.box({ min: [0, 2.5, 0], max: [4, 2.6, 4] }, 0x282b4a))
        occluders.prop(occluders.box(PILLAR, 0xbac7db), { bounds: PILLAR })
        return undefined
      },
    }),
})
