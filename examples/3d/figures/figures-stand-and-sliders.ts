// figures-stand-and-sliders: three Wicks standing side by side, one figure definition and three sets of sliders
//
// Shows: a figure's body is its sliders (height, head, chunk, frame, legs, posture), numbers a character file or a
//   Tuner sets and no code changes; the same outfit, swatches and gait fit each body; standing is the gait's idle:
//   a slow breath and a weight shift, with no walking and no clip, drawn from the sim's clock like everything else.
// Controls: none
// Packages: @automata/framework, @automata/3d
// Difficulty: ★★☆☆
// Tier: core
import '@automata/3d/no-eval'
import { createPixi3dRenderer, figure, render3dExtension } from '@automata/3d'
import type { FigureDef, FigureLibrary, Gait, Swatch } from '@automata/3d/figures'
import { defineComponent, defineGame, definePlugin } from '@automata/framework'

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

// Wick, Emberwick's hero: a cloak with gold cuffs, a cape, boots and eyes glowing under the hood's shadow.
const outfits = {
  wanderer: [
    { top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' },
    { trousers: 'wick-cloak-shade' },
    { shoes: 'wick-boot', boots: true, sole: 'sole' },
    { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' },
    { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' },
  ],
} as const
const body = { skin: 'wick-shadow', gait: 'bounce', hand: 'R', default: 'wanderer', outfits } as const
const average = { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 }

// Three bodies from one definition: only the sliders differ.
const bodies: Record<string, FigureDef> = {
  short: { ...body, sliders: { ...average, height: 100, chunk: 1.2, legs: 0 } },
  average: { ...body, sliders: average },
  tall: { ...body, sliders: { ...average, height: 140, chunk: 0.8, legs: 0.5, frame: 0.2 } },
}

// --- sim ---
// Where each Wick stands (metres, y up) and which way he faces. One component a body, since a view draws a component.
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' } as const
const kinds = Object.keys(bodies).map((name) => defineComponent(name, place))
const standing = definePlugin({ name: 'stand', defs: kinds })

// --- game ---
export default defineGame({
  id: 'figures-stand-and-sliders',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [standing],
    seed: 1,
    setup: (sim) => {
      for (const [i, kind] of kinds.entries()) sim.spawn([[kind, { x: (i - 1) * 0.9, y: 0, z: 0, yaw: 0 }]])
    },
  },
  extensions: [render3dExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x2f3f38,
      views: Object.fromEntries(
        kinds.map((kind) => [
          kind.id,
          figure(bodies[kind.id] as FigureDef, { library, motion, now: () => performance.now() / 1000 }),
        ]),
      ),
      // A fixed camera 3 m in front, looking at the middle one's hips.
      scene: (view, _stage, occluders) => {
        view.camera.position.set(0, 1.1, 3)
        view.camera.lookAt({ x: 0, y: 0.7, z: 0 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-3, -0.1, -3], max: [3, 0, 3] }, 0x8690b2)
        return undefined
      },
    }),
})
