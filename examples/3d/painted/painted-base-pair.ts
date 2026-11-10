// painted-base-pair: the base pair as painted pixel art in a 3D room, one walking a loop, the other standing
//
// Shows: `paintedFigure` (`@automata/3d/painted`), a figure painted texel by texel from data, drawn in the scene as a
//   quad that stands where its entity stands and faces the camera. It is drawn in eight views, as a sprite set is: the
//   painter picks the one nearest the camera's bearing, so a turning camera steps through them. Everything about the
//   look (the light's bands, the outline, the face, the colours) is the painter's.
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★☆☆
// Tier: core
import '@automata/3d/no-eval'
import { createPixi3dRenderer, render3dExtension } from '@automata/3d'
import { BASE, paintedFigure } from '@automata/3d/painted'
import { CameraHeading, cameraView, enterView, START } from '@automata/3d/sim'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automata/framework'

// --- figure ---
// The base pair as the painter's data: sliders, a gait and outfits of library garments (painted-on blocks, barefoot).
const [man, woman] = BASE.map((b) => b.def)

// --- sim ---
// Where each stands (metres, y up), facing `yaw`, and whether it is walking.
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32', walking: 'bool' } as const
const Walker = defineComponent('walker', place)
const Stander = defineComponent('stander', place)
// A 2 m square at 1 m/s (one side every 120 ticks), then three seconds standing, then again.
const walk = defineSystem('walk', (ctx) => {
  const lap = ctx.tick % 660
  const side = Math.min(Math.floor(lap / 120), 3)
  const along = lap < 480 ? ((lap % 120) / 120) * 2 : 2
  const [x, z, yaw] = [
    [-1 + along, -1, 1.5708],
    [1, -1 + along, 0],
    [1 - along, 1, -1.5708],
    [-1, 1 - along, 3.1416],
  ][side] as [number, number, number]
  for (const walker of ctx.query(Walker)) walker.set(Walker, { x, z, yaw, walking: lap < 480 })
})
const FOLLOW = cameraView('follow')

// --- game ---
export default defineGame({
  id: 'painted-base-pair',
  size: { width: 480, height: 270 },
  sim: {
    plugins: [definePlugin({ name: 'pair', defs: [Walker, Stander, walk] })],
    seed: 1,
    setup: (sim) => {
      sim.spawn([
        [Walker, { x: -1, y: 0, z: -1, yaw: 1.5708, walking: true }],
        [CameraHeading, enterView(START, FOLLOW, { x: 0, y: 0 })],
      ])
      sim.spawn([[Stander, { x: 0, y: 0, z: 0, yaw: -1.5708, walking: false }]])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x31222a,
      views: {
        [Walker.id]: paintedFigure(man!, { state: (c) => ({ moving: c[Walker.id]?.walking === true }) }),
        [Stander.id]: paintedFigure(woman!),
      },
      camera: { views: [FOLLOW], initial: FOLLOW.id, follow: Walker.id },
      scene: (view, _stage, occluders) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-4, -0.1, -4], max: [4, 0, 4] }, 0x8690b2)
        return undefined
      },
    }),
})
