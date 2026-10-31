// figures-clips: Wick walking back and forth along a line with clips played over the walk: a reach, a look and a flinch
//
// Shows: clips as data (timed keys into poses, a mask of the parts they move, `once` or `hold`); the sim starts
//   the next clip every 1.5 s and the view plays it over the gait, so the legs keep walking under a reach of the
//   right arm and a look of the head and chest; each clip cuts into the last with the action transition; the
//   view's clock is the sim's tick, so a clip starts where the sim started it.
// Controls: none
// Packages: @mcthaydt/automata, @mcthaydt/automata-figures, @mcthaydt/automata-render-pixi3d
// Difficulty: ★★★☆
// Tier: core
import '@mcthaydt/automata-render-pixi3d/no-eval'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@mcthaydt/automata'
import type { Ease, FigureClipDef, FigureDef, MotionLibrary, Vec3 } from '@mcthaydt/automata-figures'
import { createPixi3dRenderer, figure, render3dExtension } from '@mcthaydt/automata-render-pixi3d'
import { CameraHeading, cameraView, enterView, START } from '@mcthaydt/automata-render-pixi3d/sim'

// Wick, his swatches and the `bounce` gait as in figures-walk (FigureBuilder a1f7246), written as compiled.
const cloak = { 'wick-cloak': { colour: 41 }, 'wick-cloak-shade': { colour: 40 } }
const trim = { 'wick-trim': { colour: 24, gloss: 0.9 }, 'wick-boot': { colour: 17 } }
const shade = { 'wick-shadow': { colour: 15, flat: true }, 'wick-eye': { colour: 32, flat: true } }
const face = { sole: { colour: 15, flat: true }, lid: { colour: 10, flat: true } }
const brows = { brow: { colour: 17, flat: true }, mouth: { colour: 18, flat: true } }
const swatches = { ...cloak, ...trim, ...shade, ...face, ...brows }
const library = { swatches, hair: {}, headwear: {}, items: {} }
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const feet = { heel: 0.24, push: 0.35 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, standOut: 0.04, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce = { ...stride, ...hips, ...feet, ...arms, ...head, ...stand, ...clock, ...breath }
const features = { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' }
const boots = { shoes: 'wick-boot', boots: true, sole: 'sole' }
const cape = { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' }
const top = { top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' } as const
const wick: FigureDef = {
  ...{ skin: 'wick-shadow', gait: 'bounce', hand: 'R', default: 'wanderer' },
  sliders: { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 },
  outfits: { wanderer: [top, { trousers: 'wick-cloak-shade' }, boots, cape, features] },
}
// Poses from the figures package's test content (src/testing/fixtures/content/figure-poses/*.toml), the flinch cut
// to its hands and head: positions in metres in the figure's space (+z forward, +x his left), turns in degrees.
const turned = (chest: Vec3, neck: Vec3, head: Vec3) => ({ effectors: {}, fk: { chest, neck, head } })
const raised = { handL: { pos: [0.06, 1.4478, 0.21] }, handR: { pos: [-0.06, 1.4478, 0.21] } } as const
const poses = {
  free: { effectors: {} },
  'reach-out': { effectors: { handR: { pos: [-0.1275, 1.1114, 0.5] } }, fk: { chest: [6.8755, 6.8755, 0] } },
  'look-out': turned([0, 10.743, 0], [-0.2152, 12.8883, 0.1725], [-0.5038, 19.3259, 0.3593]),
  'look-across': turned([0, -10.743, 0], [0.1713, -12.8889, -0.2161], [0.3565, -19.3291, -0.5058]),
  flinch: { effectors: raised, fk: { head: [10.7433, 10.6012, 0.2399] } },
} as const

// The fixture clips (figure-clips/*.toml): keys at seconds into the clip, a mask of the parts each moves.
const key = (t: number, pose: string, ease?: Ease) => ({ t, pose, ease })
const reach: FigureClipDef = {
  ...{ length: 1.4, loop: 'once', mask: ['armR', 'torso'] },
  keys: [key(0, 'free'), key(0.49, 'reach-out', 'inOut'), key(1.008, 'reach-out'), key(1.4, 'free', 'inOut')],
}
const look: FigureClipDef = {
  ...{ length: 3.4, loop: 'hold', mask: ['torso', 'head'] },
  keys: [key(0, 'free'), key(0.6, 'look-out', 'out'), key(1.6, 'look-out'), key(3.4, 'look-across', 'inOut')],
}
const flinch: FigureClipDef = {
  ...{ length: 0.18, loop: 'hold', mask: ['pelvis', 'torso', 'head', 'armL', 'armR', 'legR'] },
  keys: [key(0, 'free'), key(0.18, 'flinch', 'inOut')],
}
const CLIPS = ['reach', 'look', 'flinch'] as const
const clips = { reach, look, flinch }
const motion: MotionLibrary = { gaits: { bounce }, poses, clips, items: {}, stands: {}, rigs: {} }

// Wick's feet on the floor (metres, y up), facing `yaw`, and his clip (an index into CLIPS) and the tick it started.
const Hero = defineComponent('hero', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32', clip: 'u32', since: 'u32' })

// Back and forth along a 2 m line at 1 m/s (120 ticks each way); the next clip every 1.5 s (90 ticks).
const walk = defineSystem('walk', (ctx) => {
  const lap = ctx.tick % 240
  const [x, yaw] = lap < 120 ? [-1 + lap / 60, 1.5708] : [3 - lap / 60, -1.5708]
  const clip = Math.floor(ctx.tick / 90)
  for (const hero of ctx.query(Hero)) hero.set(Hero, { x, yaw, clip: clip % 3, since: clip * 90 })
})

const loop = definePlugin({ name: 'loop', defs: [Hero, walk] })
let seconds = 0 // the sim's tick in seconds at 60 Hz, the view's clock, which each step moves on
const toSimTime = (result: { readonly tick: number }) => {
  seconds = result.tick / 60
}
const playing = (hero?: Readonly<Record<string, unknown>>) => ({
  moving: true,
  action: { id: CLIPS[Number(hero?.clip)] ?? 'reach', startedAt: Number(hero?.since) / 60 },
})
const shown = figure(wick, { library, motion, now: () => seconds, state: (c) => playing(c[Hero.id]) })
const FOLLOW = cameraView('follow')

export default defineGame({
  id: 'figures-clips',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [loop],
    seed: 1,
    setup: (sim) => {
      sim.spawn([
        [Hero, { x: -1, y: 0, z: 0, yaw: 1.5708, clip: 0, since: 0 }],
        [CameraHeading, enterView(START, FOLLOW, { x: 0, y: 0 })],
      ])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x193c3e,
      views: { [Hero.id]: shown },
      camera: { views: [FOLLOW], initial: FOLLOW.id, follow: Hero.id },
      scene: (view, _stage, occluders) => {
        view.environment = { skyColor: 0xc7dcd0, groundColor: 0x3e3546 }
        occluders.box({ min: [-4, -0.1, -4], max: [4, 0, 4] }, 0x8b9bb4)
        return { apply: toSimTime }
      },
    }),
})
