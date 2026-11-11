// characterkit-painted: the base pair as painted pixel art in a 3D room, one walking a loop behind a low wall, the other standing
//
// Shows: `paintedFigure` from the character kit (`@automata/character-kit`): a figure generated from data and painted
//   texel by texel, drawn in the scene as a quad that stands where its entity stands. It is drawn in eight views, as a
//   sprite set is: the painter picks the one nearest the camera's bearing, so a turning camera steps through them. It is
//   always painted at the painter's own 18° pitch, whatever the camera's tilt, and at one screen pixel a texel: the field
//   is 720 × 405 so that a texel at the walker's feet is about a pixel (at 480 × 270 it would be two thirds of one, and
//   texels would drop out). Each texel has its own depth, so the walker goes behind the low wall on its near side texel by
//   texel, not as a flat cut-out. Everything about the look (the light's bands, the outline, the face, the colours) is
//   the painter's.
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/character-kit
// Difficulty: ★★☆☆
// Tier: extension
import '@automata/3d/no-eval'
import { box, createPixi3dRenderer, render3dExtension } from '@automata/3d'
import { figuresExtension } from '@automata/3d/figures'
import { CameraHeading, cameraView, enterView, START } from '@automata/3d/sim'
import { BASE, characterKitExtension, paintedFigure } from '@automata/character-kit'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automata/framework'

// --- figure ---
// The base pair as the painter's data: sliders, a gait and outfits of library garments (painted-on blocks, barefoot).
const [man, woman] = BASE.map((b) => b.def)

// --- sim ---
// Where each stands (metres, y up), facing `yaw`, and whether it is walking.
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32', walking: 'bool' } as const
const Walker = defineComponent('walker', place)
const Stander = defineComponent('stander', place)
// A low wall between the camera and the near side of the walker's square (the camera looks toward +z): the walker goes behind it.
const Wall = defineComponent('wall', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })
// A 2 m square at 1 m/s (one side every 120 ticks), then three seconds standing, then again.
const LAP = 660
const walk = defineSystem('walk', (ctx) => {
  const lap = ctx.tick % LAP
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
  id: 'characterkit-painted',
  size: { width: 720, height: 405 },
  sim: {
    plugins: [definePlugin({ name: 'pair', defs: [Walker, Stander, Wall, walk] })],
    seed: 1,
    setup: (sim) => {
      sim.spawn([
        [Walker, { x: -1, y: 0, z: -1, yaw: 1.5708, walking: true }],
        [CameraHeading, enterView(START, FOLLOW, { x: 0, y: 0 })],
      ])
      sim.spawn([[Stander, { x: 0, y: 0, z: 0, yaw: -1.5708, walking: false }]])
      sim.spawn([[Wall, { x: 0, y: 0, z: -1.7, yaw: 0 }]])
    },
  },
  extensions: [render3dExtension, figuresExtension, characterKitExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x31222a,
      views: {
        [Walker.id]: paintedFigure(man!, { state: (c) => ({ moving: c[Walker.id]?.walking === true }) }),
        [Stander.id]: paintedFigure(woman!),
        [Wall.id]: box({ width: 3.4, height: 0.9, depth: 0.15 }, { color: 0x6b5a73 }),
      },
      camera: { views: [FOLLOW], initial: FOLLOW.id, follow: Walker.id },
      scene: (view, stage, occluders) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-4, -0.1, -4], max: [4, 0, 4] }, 0x8690b2)
        // The journey waits on the walker's laps (it has been behind the wall by the end of the first), not on a sleep.
        return {
          apply: (result) => {
            stage.app.canvas.dataset.lap = String(Math.floor(result.tick / LAP))
          },
        }
      },
    }),
})
