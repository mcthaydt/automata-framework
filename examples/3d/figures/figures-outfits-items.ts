// figures-outfits-items: one figure changing outfits and the item in its hand
//
// Shows: the sim names the figure's outfit and held item (strings on a component) and the figure view rebuilds
//   the figure's meshes once on each change, without moving a joint; an item (FigureBuilder's hold: where the
//   hand goes and how it turns) is data in the figure library, beside the swatches it is made of.
// Controls: none
// Packages: @automataframework/automata, @automataframework/automata-figures, @automataframework/automata-render-pixi3d
// Difficulty: ★★★☆
// Tier: core
import '@automataframework/automata-render-pixi3d/no-eval'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automataframework/automata'
import type { FigureDef, FigureLibrary, Gait, ItemDef } from '@automataframework/automata-figures'
import { createPixi3dRenderer, figure, render3dExtension } from '@automataframework/automata-render-pixi3d'

// Content a game compiles from content/figure-swatches/*.toml and content/figure-items/*.toml, written as compiled.
// Swatch colours are Endesga 64 indices. The item is FigureBuilder's hand lamp (src/render/figure/library at a1f7246).
const cloak = { 'wick-cloak': { colour: 41 }, 'wick-cloak-shade': { colour: 40 } }
const trim = { 'wick-trim': { colour: 24, gloss: 0.9 }, 'wick-boot': { colour: 17 } }
const shade = { 'wick-shadow': { colour: 15, flat: true }, 'wick-eye': { colour: 32, flat: true } }
const face = { sole: { colour: 15, flat: true }, lid: { colour: 10, flat: true } }
const brows = { brow: { colour: 17, flat: true }, mouth: { colour: 18, flat: true } }
const lamp = { brass: { colour: 21, gloss: 0.93 }, glass: { colour: 23, flat: true }, cream: { colour: 7 } }
// A lamp hung from the hand at the side, the arm nearly straight: a brass cap, a glass body and a brass base.
const handLamp: ItemDef = {
  hold: {
    hand: [{ k: 0.05, shoulders: 1 }, { arms: -0.93 }, { k: 0.14 }],
    pole: [0.3, 0, -1],
    turn: [-0.15, 0, 0],
  },
  parts: [
    { at: [0, -0.02, 0], material: 'brass', r: [0.032, 0.014, 0.032], rings: 3, seg: 8 },
    { at: [0, -0.09, 0], e: [0.7, 0.9], material: 'glass', r: [0.045, 0.064, 0.045], rings: 5, seg: 10 },
    { at: [0, -0.165, 0], e: [0.45, 0.8], material: 'brass', r: [0.054, 0.022, 0.054], rings: 3, seg: 10 },
  ],
  tip: [0, -0.09, 0],
}
const swatches = { ...cloak, ...trim, ...shade, ...face, ...brows, ...lamp }
const library: FigureLibrary = { swatches, hair: {}, headwear: {}, items: { 'hand-lamp': handLamp } }

// FigureBuilder's `bounce` gait (src/render/figure/library/gaits.json at a1f7246), grouped by what each part moves.
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const feet = { heel: 0.24, push: 0.35 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, standOut: 0.04, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...feet, ...arms, ...head, ...stand, ...clock, ...breath }
const motion = { gaits: { bounce }, poses: {}, clips: {}, items: library.items, stands: {}, rigs: {} }

// Wick in two outfits: the cloak and cape, and a pale shirt in shirtsleeves.
const boots = { shoes: 'wick-boot', boots: true, sole: 'sole' }
const trousers = { trousers: 'wick-cloak-shade' }
const cape = { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' }
const features = { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' }
const wick: FigureDef = {
  skin: 'wick-shadow',
  gait: 'bounce',
  hand: 'R',
  default: 'wanderer',
  sliders: { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 },
  outfits: {
    wanderer: [{ top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' }, trousers, boots, cape, features],
    shirtsleeves: [{ top: 'cream', sleeves: 'short' }, trousers, boots, features],
  },
}

// The figure's feet, its facing, and what it wears and holds ('' for an empty hand).
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' } as const
const Model = defineComponent('model', { ...place, outfit: 'string', item: 'string' })
const OUTFITS = ['wanderer', 'shirtsleeves'] as const
const ITEMS = ['', 'hand-lamp'] as const

// Every two seconds (120 ticks) the lamp is picked up or put down, and the outfit changes after both; it turns slowly.
const dress = defineSystem('dress', (ctx) => {
  const look = Math.floor(ctx.tick / 120)
  const item = ITEMS[look % 2] ?? ''
  const outfit = OUTFITS[Math.floor(look / 2) % 2] ?? 'wanderer'
  for (const model of ctx.query(Model))
    model.set(Model, { outfit, item, yaw: ((ctx.tick % 720) / 720) * 6.2832 })
})

// What the view reads from the render row: the outfit, and the item or an empty hand.
const worn = (model?: Readonly<Record<string, unknown>>) => ({
  moving: false,
  outfit: String(model?.outfit),
  item: String(model?.item) || null,
})

const wardrobe = definePlugin({ name: 'wardrobe', defs: [Model, dress] })

export default defineGame({
  id: 'figures-outfits-items',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [wardrobe],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Model, { x: 0, y: 0, z: 0, yaw: 0, outfit: 'wanderer', item: '' }]])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x193c3e,
      views: {
        [Model.id]: figure(wick, { library, motion, state: (c) => worn(c[Model.id]) }),
      },
      // A fixed camera 3 m in front, looking at the chest: the figure turns, the view stays.
      scene: (view, _stage, occluders) => {
        view.camera.position.set(0, 1.4, 3)
        view.camera.lookAt({ x: 0, y: 0.8, z: 0 })
        view.environment = { skyColor: 0xc7dcd0, groundColor: 0x3e3546 }
        occluders.box({ min: [-3, -0.1, -3], max: [3, 0, 3] }, 0x8b9bb4)
        return undefined
      },
    }),
})
