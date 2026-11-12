import type { CharacterDef } from '@automata/character-kit'

// The two painted figures of the night: Ada, and the figure that walks the ward. Each is the old game's character file
// (`src/render/figure/characters/ada.json` and `nurse.json` at 92e6704: the same sliders, gait, hair physics and face) dressed from
// the clothes the character kit has today. What the old figures wear that the kit has no garment for is in `MISSING`, with why, and is
// held until the wardrobe lands; nothing stands in for it.

/** How a figure is painted in play: the old game's. Density 1 is about 37 texels a metre (the camera gives 52 lines a metre, so a
 *  texel is 1.4 screen pixels), and `crisp: false` draws it at its true height. A close-up density is for a cutscene key that asks. */
export const PLAY_FIGURE = { density: 1, crisp: false } as const

/** The face the old game draws on both: drawn by the painter's templates. */
const EYES = { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite' } as const

/**
 * Ada Voss, the staff nurse on her first night. The prologue puts her in her street clothes (the old character file's `story`:
 * `scenes.prologue = street`): a cream top with short sleeves, jeans where the old game had denim trousers, brown shoes, her
 * auburn bob.
 */
export const ADA: CharacterDef = {
  id: 'ada',
  name: 'Ada Voss',
  sliders: {
    frame: 0.85,
    height: 162,
    muscle: 0.5,
    fat: 0.2,
    shoulders: 0.47,
    hips: 0.37,
    legs: 0.3,
    arms: 0.15,
    head: 0.87,
    neck: 0.5,
    neckLength: 0.2,
    hands: 0.5,
    feet: 0.6,
    posture: 0.85,
    age: 0.25,
    headTilt: 0,
    chunk: 0.6,
  },
  skin: 'skinPale',
  gait: 'brisk',
  gaitOverrides: { armOut: 0.11, idleElbow: 0.15, hang: 0.04, stance: 0, stanceLead: 0, shift: 0 },
  hand: 'R',
  face: { camera: 0.6, turn: 0.15, blink: 3.7, drawn: true },
  hair: { stiff: 70, damp: 9, trail: 0.3, bounce: 0.08 },
  default: 'street',
  outfits: {
    street: [
      { tee: 'ribCream', sleeves: 'short' },
      { jeans: 'denim' },
      { shoes: 'leatherBrown', sole: 'soleBlack' },
      { hair: 'hairAuburn', style: 'smoothBob' },
      { ...EYES, brows: 'hairBrown', lips: 'lipsPink' },
    ],
  },
}

/**
 * The night nurse, the figure the creature is: tall and thin with arms too long, her head cocked, in a worn white uniform
 * (`nurse.json`). Her pace is the old game's `uncanny` gait, which the builder does not have; she walks the `loose` one.
 */
export const NIGHT_NURSE: CharacterDef = {
  id: 'nurse',
  name: 'the Night Nurse',
  sliders: {
    frame: 0.9,
    height: 210,
    muscle: 0,
    fat: 0,
    shoulders: 0.25,
    hips: -0.29,
    legs: 0.9,
    arms: 0.99,
    head: 0.19,
    neck: 0.3,
    neckLength: 0.93,
    hands: 0.6,
    feet: 0.4,
    posture: 0.52,
    age: 0.5,
    headTilt: 15,
    chunk: 0.55,
  },
  genes: { headPitch: 0.2 },
  skin: 'skinPale',
  gait: 'loose',
  gaitOverrides: { armOut: 0.09 },
  hand: 'R',
  face: { camera: 0, turn: 0, blink: 0 },
  hair: { stiff: 14, damp: 2.6, trail: 0.55, bounce: 0.02, sway: 2.2, hang: 0.8 },
  default: 'uniform',
  swatches: {
    heavyShoe: { ramp: 10, base: 1, gloss: 0.95, paint: ['#48474d', '#2d3136', '#121214', '#121214'] },
  },
  outfits: {
    uniform: [
      { tee: 'teeWhite', sleeves: 'short' },
      { skirt: 'teeWhite', length: 0.42, flare: 0.3 },
      { shoes: 'heavyShoe' },
      { hair: 'hairBlack', style: 'fallLong' },
      { ...EYES, brows: 'hairBlack', lips: 'lipsBrown' },
    ],
  },
}

/** An old garment, hair or gait the kit has nothing for, and what the figure shows instead. */
export interface Missing {
  readonly old: string
  readonly why: string
}

/** What the old game's Ada and creature wear or do that the kit's library cannot say today; held until the wardrobe lands. */
export const MISSING: { readonly ada: readonly Missing[]; readonly nightNurse: readonly Missing[] } = {
  ada: [
    {
      old: 'waistcoat maroon',
      why: 'the kit has a waistcoat for the mesh figures only; the painted wardrobe has none, so her tee shows bare',
    },
    {
      old: 'boots (shaft and sole)',
      why: 'the painted `shoes` draw a shoe, not a boot with a shaft up the shin; her shoes are brown leather on a black sole',
    },
  ],
  nightNurse: [
    { old: 'stockings (stockingDark)', why: 'no painted legwear: her legs are bare under the skirt' },
    {
      old: 'belt (wardWhiteShade)',
      why: 'no painted belt: the tee meets the skirt with nothing round her waist',
    },
    {
      old: 'nurse cap (capWhite, a cross)',
      why: 'the builder has no headwear: her head is bare under her hair',
    },
    {
      old: 'curtain hair over the face',
      why: 'the kit’s long hair falls past the shoulders and does not cover the face; her face shows',
    },
    {
      old: 'hem stain and folds on the skirt',
      why: 'the painted skirt has a length and a flare only: its hem is clean',
    },
    {
      old: 'the uncanny gait',
      why: 'the builder’s gaits are brisk, strut, loose, bounce and still: she walks the loose one',
    },
  ],
}
