// render3d-lighting-fog: baked lamp light, a lit walker and fog in a 3D room
//
// Shows: lighting (a SceneLighting: an ambient level, lamps, and the boxes and planes that block them) bakes vertex
//   light into the room's static boxes once at load, with occlusion; the sim switches the warm lamp off and on with
//   a lamp entity's level, which rebakes only the boxes that lamp reaches; the walker takes the ambient light plus
//   the lamps in range at its position every frame; linear fog closes the far side of the room.
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★★☆
// Tier: core
import '@automata/3d/no-eval'
import { box, createPixi3dRenderer, render3dExtension, sceneLightingSchema } from '@automata/3d'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automata/framework'

// A game with content writes this in content/lighting/<room>.toml (kind scene-lighting); here it is inline.
// Colours are Endesga 64. The pillar blocks the warm lamp's light from the floor behind it.
const lighting = sceneLightingSchema.parse({
  ambient: 0.4,
  ambientColor: 0x8fd3ff,
  lamps: [
    { id: 'warm', x: -1.8, y: 2, z: 0.2, color: 0xffc825, strength: 5, range: 4.5 },
    { id: 'cool', x: 2.2, y: 2, z: -0.8, color: 0x0ce6f2, strength: 3, range: 4 },
  ],
  boxes: [{ id: 'pillar', x: -0.4, y: 0, z: -0.2, width: 0.5, height: 2, depth: 0.5 }],
  planes: [
    { x: 0, y: 0, z: 0, normal: [0, 1, 0], width: 12, height: 12 },
    { x: 0, y: 1.5, z: -2.5, normal: [0, 0, 1], width: 12, height: 3 },
  ],
  fog: { near: 5, far: 11, color: 0x193c3e },
})

// Positions in metres (y up). Scenery is entities too: each kind of block is drawn by its own static box view.
const Floor = defineComponent('floor', { x: 'f32', y: 'f32', z: 'f32' })
const Wall = defineComponent('wall', { x: 'f32', y: 'f32', z: 'f32' })
const Pillar = defineComponent('pillar', { x: 'f32', y: 'f32', z: 'f32' })
const Crate = defineComponent('crate', { x: 'f32', y: 'f32', z: 'f32' })
const Walker = defineComponent('walker', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' })
// The sim's lamp switch: the renderer reads `level` for the lamp named `lamp` (Pixi3dOptions.lamps).
const LampSwitch = defineComponent('lamp-switch', { lamp: 'string', level: 'f32' })

// The walker paces from lamp to lamp; the warm lamp goes off for one second (60 ticks) in every two.
const pace = defineSystem('pace', (ctx) => {
  const along = (ctx.tick % 240) / 60 // 0 to 4, then again
  for (const walker of ctx.query(Walker))
    walker.set(Walker, { x: along < 2 ? along * 2 - 2 : 6 - along * 2, yaw: along < 2 ? 1.57 : -1.57 })
  for (const lamp of ctx.query(LampSwitch)) lamp.set(LampSwitch, { level: ctx.tick % 120 < 60 ? 1 : 0 })
})

const room = definePlugin({ name: 'room', defs: [Floor, Wall, Pillar, Crate, Walker, LampSwitch, pace] })

export default defineGame({
  id: 'render3d-lighting-fog',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [room],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Floor, { x: 0, y: -0.1, z: 0 }]])
      sim.spawn([[Wall, { x: 0, y: 0, z: -2.6 }]])
      sim.spawn([[Pillar, { x: -0.4, y: 0, z: -0.2 }]])
      for (const [x, z] of [
        [-2.6, -1.6],
        [-0.4, -1.4],
        [2.4, -1.5],
        [1, 0.9],
      ] as const)
        sim.spawn([[Crate, { x, y: 0, z }]])
      sim.spawn([[Walker, { x: -2, y: 0, z: 1, yaw: 0 }]])
      sim.spawn([[LampSwitch, { lamp: 'warm', level: 1 }]])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      lighting,
      lamps: LampSwitch.id,
      views: {
        // 'static' bakes once and rebakes on a lamp change; 'moving' is tinted every frame.
        [Floor.id]: box({ width: 12, height: 0.1, depth: 12 }, { color: 0xc7dcd0, lit: 'static' }),
        [Wall.id]: box({ width: 12, height: 3, depth: 0.2 }, { color: 0xc7dcd0, lit: 'static' }),
        [Pillar.id]: box({ width: 0.5, height: 2, depth: 0.5 }, { color: 0x9babb2, lit: 'static' }),
        [Crate.id]: box({ width: 0.6, height: 0.6, depth: 0.6 }, { color: 0xcd683d, lit: 'static' }),
        [Walker.id]: box({ width: 0.4, height: 1.2, depth: 0.4 }, { color: 0xffffff, lit: 'moving' }),
      },
      scene: (view) => {
        view.camera.position.set(0, 3.2, 5.6)
        view.camera.lookAt({ x: 0, y: 0.6, z: -0.4 })
        return undefined
      },
    }),
})
