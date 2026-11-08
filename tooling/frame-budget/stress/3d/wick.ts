import type { FigureDef, FigureLibrary, Gait, Swatch } from '@automata/3d/figures'

// Wick as the compiler would hand him over (a game writes him in content/figures/wick.toml): a cloak, boots and a
// cape, walking with the `bounce` gait. Colours are DUEL ramps and steps.
const duel = (ramp: Swatch['ramp'], step: number, more = {}): Swatch => ({ ramp, step, ...more })

export const library: FigureLibrary = {
  swatches: {
    'wick-cloak': duel('ocean', 3),
    'wick-cloak-shade': duel('ocean', 1),
    'wick-trim': duel('flame', 5, { gloss: 0.9 }),
    'wick-boot': duel('brick', 0),
    'wick-shadow': duel('plum', 0, { flat: true }),
    'wick-eye': duel('flame', 7, { flat: true }),
    sole: duel('plum', 0, { flat: true }),
    lid: duel('grey', 5, { flat: true }),
    brow: duel('brick', 0, { flat: true }),
    mouth: duel('skin', 0, { flat: true }),
  },
  hair: {},
  headwear: {},
  items: {},
}

const stride = { cycle: 0.46, speed: 3, stride: 0.6, duty: 0.54, lift: 0.065, bob: 0.05, crouch: 0.01 }
const hips = { sway: 0.03, hipYaw: 0.09, hipRoll: 0.08, chestCounter: 0.5, lean: 0.03 }
const feet = { heel: 0.24, push: 0.35, standOut: 0, standElbow: 0.36 }
const arms = { armSwing: 0.5, armOut: 0.08, elbow: 0.45, elbowSwing: 0.45, armLag: 0.04, shoulderRoll: 0.75 }
const head = { headLevel: 0, headStabilize: 0.8, drag: 0, track: 0.3, spring: 0.6, chin: 0.04 }
const stand = { stance: 0.045, stanceLead: 0.07, hang: 0.04, idleElbow: 0.3, reach: 1.4 }
const clock = { poseRate: 12, walkPoses: 8, idlePoses: 8, turnRate: 0.785, twitch: 0, twitchEvery: 3 }
const breath = { breath: 0.03, breathPeriod: 3.4, shift: 0.012, shiftPeriod: 5.5, headLead: 0.785 }
const bounce: Gait = { ...stride, ...hips, ...feet, ...arms, ...head, ...stand, ...clock, ...breath }

export const motion = {
  gaits: { bounce },
  poses: {},
  clips: {},
  items: library.items,
  stands: {},
  rigs: {},
}

const outfits = {
  wanderer: [
    { top: 'wick-cloak', sleeves: 'long', cuffs: 'wick-trim' },
    { trousers: 'wick-cloak-shade' },
    { shoes: 'wick-boot', boots: true, sole: 'sole' },
    { cape: 'wick-cloak', length: 0.9, trim: 'wick-trim' },
    { eyes: 'wick-eye', lids: 'lid', brows: 'brow', mouth: 'mouth' },
  ],
} as const

export const wick: FigureDef = {
  skin: 'wick-shadow',
  gait: 'bounce',
  hand: 'R',
  default: 'wanderer',
  outfits,
  sliders: { height: 120, head: 1, chunk: 1, frame: 0.4, legs: 0.2, posture: 0.6, hands: 0.6, feet: 0.6 },
}
