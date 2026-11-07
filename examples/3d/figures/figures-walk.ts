// figures-walk: Wick, a procedural figure, walking a loop under the angled camera
//
// Shows: a figure as data (a FigureDef: sliders, an outfit of garments, palette swatches and a gait) drawn by
//   @automata/3d's figure view, one mesh per part posed from the gait's pose clock; the sim moves the figure and
//   says whether it is walking, and the view walks or idles from that; the camera is the Owner's default view
//   (24 mm, 25° down, 5 m back) following the figure.
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★★☆
// Tier: core
import '@automata/3d/no-eval'
import { createPixi3dRenderer, figure, render3dExtension } from '@automata/3d'
import type { FigureDef, FigureLibrary, Gait, Swatch } from '@automata/3d/figures'
import { CameraHeading, cameraView, enterView, START } from '@automata/3d/sim'
import { defineComponent, defineGame, definePlugin, defineSystem } from '@automata/framework'

// --- figure ---
// A game writes these in content/figures/wick.toml, content/figure-swatches/*.toml and content/figure-gaits/*.toml
// and the content compiler checks them and fills their defaults; here they are inline, written as compiled.
// Swatch colours are DUEL ramps and steps; sole, lid, brow and mouth are the defaults a boot and a face name.
const duel = (ramp: Swatch['ramp'], step: number, more = {}): Swatch => ({ ramp, step, ...more })
const cloak = { 'wick-cloak': duel('ocean', 3), 'wick-cloak-shade': duel('ocean', 1) }
const trim = { 'wick-trim': duel('flame', 5, { gloss: 0.9 }), 'wick-boot': duel('brick', 0) }
const shade = { 'wick-shadow': duel('plum', 0, { flat: true }), 'wick-eye': duel('flame', 7, { flat: true }) }
const face = { sole: duel('plum', 0, { flat: true }), lid: duel('grey', 5, { flat: true }) }
const brows = { brow: duel('brick', 0, { flat: true }), mouth: duel('skin', 0, { flat: true }) }
const swatches = { ...cloak, ...trim, ...shade, ...face, ...brows }
const library: FigureLibrary = { swatches, hair: {}, headwear: {}, items: {} }

// FigureBuilder's `bounce` gait (src/features/motion/library/gaits.json at 025ffb4), grouped by what each part moves.
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
// The feet's heel and push walking; standOut and standElbow (how the arms hang standing) ride along.
const feet = { heel: 0.24, push: 0.35, standOut: 0, standElbow: 0.36 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...feet, ...arms, ...head, ...stand, ...clock, ...breath }
const motion = { gaits: { bounce }, poses: {}, clips: {}, items: library.items, stands: {}, rigs: {} }

// Wick, Emberwick's hero, in a cloak with gold cuffs, a cape, boots and eyes glowing under the hood's shadow.
const wick: FigureDef = {
  skin: 'wick-shadow',
  gait: 'bounce',
  hand: 'R',
  default: 'wanderer',
  sliders: { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 },
  outfits: {
    wanderer: [
      { top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' },
      { trousers: 'wick-cloak-shade' },
      { shoes: 'wick-boot', boots: true, sole: 'sole' },
      { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' },
      { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' },
    ],
  },
}

// --- sim ---
// Wick's feet on the floor (metres, y up), facing `yaw`, and whether Wick is walking.
const Hero = defineComponent('hero', { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32', walking: 'bool' })

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
  for (const hero of ctx.query(Hero)) hero.set(Hero, { x, z, yaw, walking: lap < 480 })
})

const loop = definePlugin({ name: 'loop', defs: [Hero, walk] })
const FOLLOW = cameraView('follow')

// --- game ---
export default defineGame({
  id: 'figures-walk',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [loop],
    seed: 1,
    setup: (sim) => {
      sim.spawn([
        [Hero, { x: -1, y: 0, z: -1, yaw: 1.5708, walking: true }],
        [CameraHeading, enterView(START, FOLLOW, { x: 0, y: 0 })],
      ])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x2f3f38,
      views: {
        [Hero.id]: figure(wick, {
          library,
          motion,
          state: (c) => ({ moving: c[Hero.id]?.walking === true }),
        }),
      },
      camera: { views: [FOLLOW], initial: FOLLOW.id, follow: Hero.id },
      scene: (view, _stage, occluders) => {
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-4, -0.1, -4], max: [4, 0, 4] }, 0x8690b2)
        return undefined
      },
    }),
})
