// The base pair: one man and one woman, the figure every character starts from, and the two every visual change to a
// body, a face or the light is judged on. Each is only data (sliders and names). They wear no cloth: a top and shorts
// painted on the body (modest blocks of two plain greys, no parts of their own), barefoot, with a hairstyle written
// inline (the hood-style locks a cap or a cropped cut is made of) and the face's marks, so the body, the face and the
// light are judged and not the clothes. The same two stand in the base scenes (`man` and `woman` are their cast ids).
//
// Ported from FigureBuilder (mcthaydt/FigureBuilder) base/base.ts at 025ffb4 (`BASE`): the sliders and the face are
// its numbers. Changed: a hairstyle is two or six locks (the braided pony and the fade are the character kit's), the
// colours are DUEL swatches named here (`BASE_PAIR_SWATCHES`), and a gait and a stand are ids of the game's own content
// (`loose` and `bounce`, `arms-crossed` and `hand-on-hip`: base-3d and the test fixtures have them).
import type { Lock } from '../content/headwear.schema.ts'
import type { Swatch } from '../content/swatch.schema.ts'
import type { FigureDef } from '../figure/figure.schema.ts'

/** Shared by both: hero proportions, some six heads tall, a pixel build that keeps wrists and ankles legible. */
const shared = {
  head: 1.15,
  chunk: 0.85,
  legs: 0.5,
  posture: 0.75,
  age: 0.25,
  headTilt: 0,
  neck: 0.6,
  neckLength: 0.4,
  hands: 0.5,
  feet: 0.55,
  faceForward: 0.6,
}

/** The swatches the pair names, by id (a game adds them to its `figure-swatch` content or hands them to the library). */
export const BASE_PAIR_SWATCHES: Readonly<Record<string, Swatch>> = {
  'skin-warm': { ramp: 'wine', step: 5 },
  'skin-brown': { ramp: 'skin', step: 4 },
  'block-top': { ramp: 'slate', step: 3 },
  'block-shorts': { ramp: 'slate', step: 1 },
  'hair-black': { ramp: 'sky', step: 1, gloss: 0.9 },
  'eye-brown': { ramp: 'mud', step: 1, flat: true },
  'lid-deep': { ramp: 'brick', step: 1, flat: true },
  'lips-warm': { ramp: 'wine', step: 3, flat: true },
  'lips-brown': { ramp: 'cherry', step: 2, flat: true },
}

/** A short cut: the sides and nape, low enough that a cap would cover its crown. */
const cropped: readonly Lock[] = [
  { on: 'head', at: [0, 0.56, -0.18], r: [1.06, 0.32, 0.96], e: [0.55, 0.65] },
  { on: 'head', at: [0, 0.3, -0.5], r: [0.98, 0.22, 0.56], e: [0.55, 0.65], taper: [0.9, 1] },
]

/** A chin-length bob: a full crown, a fringe above the eyes, hair beside the cheeks and the back to the nape. */
const bob: readonly Lock[] = [
  {
    on: 'head',
    at: [0, 0.74, -0.12],
    r: [1.26, 0.4, 1.04],
    e: [1, 0.85],
    follow: 0.6,
    cut: { below: -0.05, front: 0.1 },
  },
  {
    on: 'head',
    at: [-0.62, 0.75, 0.66],
    r: [0.56, 0.18, 0.3],
    e: [0.3, 0.6],
    taper: [0.92, 1],
    roll: 0.06,
    follow: 1,
  },
  {
    on: 'head',
    at: [0, 0.79, 0.66],
    r: [0.56, 0.19, 0.3],
    e: [0.3, 0.6],
    taper: [0.92, 1],
    roll: 0,
    follow: 1,
  },
  {
    on: 'head',
    at: [0.62, 0.75, 0.66],
    r: [0.56, 0.18, 0.3],
    e: [0.3, 0.6],
    taper: [0.92, 1],
    roll: -0.06,
    follow: 1,
  },
  { on: 'sides', at: [1.1, 0.38, -0.6], r: [0.38, 0.36, 0.66], e: [0.5, 0.6], taper: [1.15, 0.95] },
  { on: 'back', at: [0, 0.36, -0.7], r: [1.14, 0.36, 0.42], e: [0.5, 0.6], taper: [1.06, 1] },
]

/** The painted-on blocks both wear: a top over the chest and the waist, shorts over the hips and thighs. */
const blocks = [{ top: 'block-top', sleeves: 'none' }, { trousers: 'block-shorts' }] as const

export const BASE_PAIR: Readonly<Record<'man' | 'woman', FigureDef>> = {
  man: {
    skin: 'skin-warm',
    gait: 'loose',
    hand: 'R',
    stand: 'arms-crossed',
    default: 'base',
    sliders: {
      ...shared,
      frame: 0.1,
      height: 178,
      muscle: 0.55,
      fat: 0.25,
      shoulders: 0.6,
      hips: 0.4,
      arms: 0.5,
      face: {
        width: 0.55,
        jaw: 0.65,
        chin: 0.6,
        cheekHeight: 0.5,
        cheekWidth: 0.5,
        bridge: 0.55,
        nose: 0.5,
        lips: 0.45,
        browArch: 0.2,
        browWeight: 0.65,
        browHeight: 0.3,
        crease: 0.6,
        hood: 0.15,
        liner: 0.5,
      },
    },
    outfits: {
      base: [
        ...blocks,
        { hair: 'hair-black', style: cropped },
        { eyes: 'eye-brown', lids: 'lid-deep', brows: 'hair-black', mouth: 'lips-warm' },
      ],
    },
  },
  woman: {
    skin: 'skin-brown',
    gait: 'bounce',
    hand: 'R',
    stand: 'hand-on-hip',
    default: 'base',
    sliders: {
      ...shared,
      frame: 0.95,
      height: 166,
      muscle: 0.35,
      fat: 0.35,
      shoulders: 0.3,
      hips: 0.65,
      arms: 0.35,
      face: {
        width: 0.45,
        jaw: 0.3,
        chin: 0.5,
        cheekHeight: 0.7,
        cheekWidth: 0.6,
        bridge: 0.45,
        nose: 0.45,
        lips: 0.7,
        browArch: 0.6,
        browWeight: 0.4,
        browHeight: 0.45,
        crease: 0.4,
        hood: 0.35,
        liner: 0,
      },
    },
    outfits: {
      base: [
        ...blocks,
        { hair: 'hair-black', style: bob },
        { eyes: 'eye-brown', lids: 'lid-deep', brows: 'hair-black', mouth: 'lips-brown' },
      ],
    },
    hair: { stiff: 55, damp: 8, trail: 0.35, bounce: 0.08 },
  },
}
