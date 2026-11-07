// figures-poses: Wick taking each pose of a small library in turn, a clip blending him into it
//
// Shows: poses as data (hand and foot targets, elbow poles and extra joint turns, written as compiled); the sim says
//   which pose and since which tick, and the view plays a hold clip that blends the figure from the last pose into
//   it over 0.4 s and holds it; the view's clock is the sim's tick, so a clip starts where the sim started it.
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★★☆
// Tier: core
import '@automata/3d/no-eval'
import { createPixi3dRenderer, figure, render3dExtension } from '@automata/3d'
import {
  type FigureClipDef,
  type FigureDef,
  type FigureLibrary,
  type Gait,
  MASK_GROUPS,
  type PoseLibrary,
  type Swatch,
  type Vec3,
} from '@automata/3d/figures'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automata/framework'

// Wick, his swatches and the `bounce` gait as in figures-walk (FigureBuilder a1f7246), written as compiled.
const duel = (ramp: Swatch['ramp'], step: number, more = {}): Swatch => ({ ramp, step, ...more })
const cloak = { 'wick-cloak': duel('ocean', 3), 'wick-cloak-shade': duel('ocean', 1) }
const trim = { 'wick-trim': duel('flame', 5, { gloss: 0.9 }), 'wick-boot': duel('brick', 0) }
const shade = { 'wick-shadow': duel('plum', 0, { flat: true }), 'wick-eye': duel('flame', 7, { flat: true }) }
const face = { sole: duel('plum', 0, { flat: true }), lid: duel('grey', 5, { flat: true }) }
const brows = { brow: duel('brick', 0, { flat: true }), mouth: duel('skin', 0, { flat: true }) }
const swatches = { ...cloak, ...trim, ...shade, ...face, ...brows }
const library: FigureLibrary = { swatches, hair: {}, headwear: {}, items: {} }
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const feet = { heel: 0.24, push: 0.35 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, standOut: 0.04, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...feet, ...arms, ...head, ...stand, ...clock, ...breath }
const features = { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' }
const boots = { shoes: 'wick-boot', boots: true, sole: 'sole' }
const cape = { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' }
const top = { top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' } as const
const wick: FigureDef = {
  ...{ skin: 'wick-shadow', gait: 'bounce', hand: 'R', default: 'wanderer' },
  sliders: { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 },
  outfits: { wanderer: [top, { trousers: 'wick-cloak-shade' }, boots, cape, features] },
}

// Poses from the figures package's test content (src/testing/fixtures/content/figure-poses/*.toml), cut to their
// main handles: positions in metres in the figure's space (+z forward, +x his left), turns in degrees.
const hands = (l: Vec3, r: Vec3) => ({ handL: { pos: l }, handR: { pos: r } })
const flatFoot = { footL: { pos: [0.1, 0.08, 0.3], rot: [0, 0, 0] } } as const
const toesDown = { footR: { pos: [-0.1, 0.12, -0.35], rot: [40, 0, 0] } } as const
const elbowsOut = { elbowL: { dir: [0.6, -1, 0] }, elbowR: { dir: [-0.6, -1, 0] } } as const
const pointing = { handR: { pos: [-0.16, 1.3, 0.52], rot: [-90, 0, 0] }, head: { rot: [0, -10, 0] } } as const
const poses: PoseLibrary = {
  stand: { effectors: { ...hands([0.2, 0.78, 0.05], [-0.2, 0.78, 0.05]), chest: { rot: [2, 0, 0] } } },
  kneel: { effectors: { ...flatFoot, ...toesDown, pelvis: { pos: [0, 0.5, -0.05] } } },
  'guard-high': { effectors: { ...hands([0.1, 1.3, 0.22], [-0.1, 1.35, 0.25]) }, poles: elbowsOut },
  point: { effectors: pointing, root: { yaw: 15 } },
  'reach-out': { effectors: { handR: { pos: [-0.1275, 1.1114, 0.5] } }, fk: { chest: [6.8755, 6.8755, 0] } },
}
const SHOWN = ['stand', 'kneel', 'guard-high', 'point', 'reach-out'] as const

// One clip a pose: from the pose before it in SHOWN into it over 0.4 s, then held there, the whole body.
const into = (from: string, pose: string) => [{ t: 0, pose: from }, { t: 0.4, pose, ease: 'inOut' } as const]
const hold = { length: 0.4, loop: 'hold', mask: MASK_GROUPS } as const
const before = (i: number) => SHOWN[(i + SHOWN.length - 1) % SHOWN.length] ?? 'stand'
const clips: Record<string, FigureClipDef> = Object.fromEntries(
  SHOWN.map((id, i) => [id, { ...hold, keys: into(before(i), id) }]),
)
const motion = { gaits: { bounce }, poses, clips, items: {}, stands: {}, rigs: {} }

// Wick's feet, his facing, the pose he is in (an index into SHOWN) and the tick he took it.
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' } as const
const Model = defineComponent('model', { ...place, pose: 'u32', since: 'u32' })

// The next pose every two seconds (120 ticks).
const cycle = defineSystem('cycle', (ctx) => {
  const turn = Math.floor(ctx.tick / 120)
  for (const model of ctx.query(Model)) model.set(Model, { pose: turn % SHOWN.length, since: turn * 120 })
})

let seconds = 0 // the sim's tick in seconds at 60 Hz, the view's clock
const posed = (model?: Readonly<Record<string, unknown>>) => ({
  moving: false,
  action: { id: SHOWN[Number(model?.pose)] ?? 'stand', startedAt: Number(model?.since) / 60 },
})

export default defineGame({
  id: 'figures-poses',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [definePlugin({ name: 'poses', defs: [Model, cycle] })],
    seed: 1,
    setup: (sim) => void sim.spawn([[Model, { x: 0, y: 0, z: 0, yaw: 0.4, pose: 0, since: 0 }]]),
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x2f3f38,
      views: {
        [Model.id]: figure(wick, { library, motion, now: () => seconds, state: (c) => posed(c[Model.id]) }),
      },
      // A fixed camera 2 m in front, looking at the hips; each step moves the view's clock to the sim's.
      scene: (view, _stage, occluders) => {
        view.camera.position.set(0, 1.1, 2)
        view.camera.lookAt({ x: 0, y: 0.6, z: 0 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-3, -0.1, -3], max: [3, 0, 3] }, 0x8690b2)
        return {
          apply: (result) => {
            seconds = result.tick / 60
          },
        }
      },
    }),
})
