// characterkit-wardrobe: three figures standing side by side in clothes only the character kit has
//
// Shows: the character kit (`@automata/character-kit`) adding garments to the procedural figures: core dresses a body in a
//   top, trousers, shoes, a cape, hair, a cap and a face, and the kit adds a waistcoat, a coat, a skirt, an apron,
//   a belt and more. Naming the kit in the game's `extensions` is all it takes; a figure that wears a skirt without
//   it is refused in words ("No garment called skirt is registered"). Each figure is the base pair's body and face
//   with the kit's garments added to its outfit; the cloth is a swatch in the library, a DUEL ramp and step.
// Controls: none
// Packages: @automata/framework, @automata/3d, @automata/character-kit
// Difficulty: ★★★☆
// Tier: extension
import '@automata/3d/no-eval'
import { createPixi3dRenderer, figure, render3dExtension } from '@automata/3d'
import { BASE_PAIR, BASE_PAIR_SWATCHES } from '@automata/3d/base'
import type { FigureDef, FigureLibrary, Gait, Garment, MotionLibrary, Swatch } from '@automata/3d/figures'
import { figuresExtension } from '@automata/3d/figures'
import { characterKitExtension } from '@automata/character-kit'
import { defineComponent, defineGame, definePlugin } from '@automata/framework'

// --- figure ---
// The `bounce` gait (as in figures-walk), which a standing figure breathes and shifts by.
const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const feet = { heel: 0.24, push: 0.35, standOut: 0, standElbow: 0.36 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...arms, ...feet, ...head, ...stand, ...clock, ...breath }
const motion: MotionLibrary = { gaits: { bounce }, poses: {}, clips: {}, items: {}, stands: {}, rigs: {} }
const cloth: Record<string, Swatch> = {
  wool: { ramp: 'wine', step: 3 },
  linen: { ramp: 'sand', step: 6 },
  dye: { ramp: 'ocean', step: 3 },
}
const library: FigureLibrary = {
  swatches: { ...BASE_PAIR_SWATCHES, ...cloth },
  hair: {},
  headwear: {},
  items: {},
}

// The base pair's bodies and faces with their own clothes, and the kit's on top.
const { stand: _arms_crossed, ...man } = BASE_PAIR.man
const { stand: _hand_on_hip, ...woman } = BASE_PAIR.woman
const dressed = (def: FigureDef, ...kit: Garment[]): FigureDef => ({
  ...def,
  gait: 'bounce',
  outfits: { base: [...(def.outfits.base ?? []), ...kit] },
})
const coat = { coat: 'wool', length: 0.8, buttons: 'linen', collar: 'linen' }
const apron = { apron: 'linen', length: 0.5, bib: true }
const people: Record<string, FigureDef> = {
  coat: dressed(man, { waistcoat: 'dye' }, coat),
  apron: dressed(woman, { skirt: 'dye', length: 0.6, hem: 'linen' }, apron),
  belt: dressed(man, { skirt: 'wool', length: 0.45 }, { belt: 'linen' }),
}

// --- sim ---
// Where each figure stands (metres, y up). One component a figure, since a view draws a component.
const place = { x: 'f32', y: 'f32', z: 'f32', yaw: 'f32' } as const
const kinds = Object.keys(people).map((name) => defineComponent(name, place))

// --- game ---
export default defineGame({
  id: 'characterkit-wardrobe',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [definePlugin({ name: 'stand', defs: kinds })],
    seed: 1,
    setup: (sim) => {
      for (const [i, kind] of kinds.entries()) sim.spawn([[kind, { x: (i - 1) * 0.9, y: 0, z: 0, yaw: 0 }]])
    },
  },
  extensions: [render3dExtension, figuresExtension, characterKitExtension],
  createRenderer: (options) =>
    createPixi3dRenderer({
      ...options,
      backgroundColor: 0x2f3f38,
      views: Object.fromEntries(
        kinds.map((kind) => [
          kind.id,
          figure(people[kind.id] as FigureDef, { library, motion, now: () => performance.now() / 1000 }),
        ]),
      ),
      scene: (view, _stage, occluders) => {
        view.camera.position.set(0, 1.1, 3)
        view.camera.lookAt({ x: 0, y: 0.8, z: 0 })
        view.environment = { skyColor: 0xcdd2da, groundColor: 0x3b303c }
        occluders.box({ min: [-3, -0.1, -3], max: [3, 0, 3] }, 0x8690b2)
        return undefined
      },
    }),
})
