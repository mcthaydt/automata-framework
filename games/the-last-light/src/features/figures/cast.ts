import type { CharacterDef } from '@automata/character-kit'
import { OLD_BRISK, OLD_UNCANNY } from './old-gaits.ts'
import { ADA_SWATCHES, NURSE_SWATCHES } from './old-swatches.ts'

// The two painted figures of the night: Ada, and the figure that walks the ward. Each is the old game's character file
// (`src/render/figure/characters/ada.json` and `nurse.json` at 92e6704) dressed piece for piece: the same hair physics, outfit and
// swatches, and the old gait whole, drawn by the character kit's painted wardrobe (a waistcoat, stockings, a belt, a cap and boots are
// its kinds). Where a number of the old file means something else in the painter now it is retuned by what the figure looks like against
// the old game's own pictures (the lines marked `retuned`). What the painter still cannot draw is in `HELD`, with what the figure shows
// instead; nothing else is left out.

/** How a figure is painted in play: the old game's. Density 1 is about 37 texels a metre (the camera gives 52 lines a metre, so a
 *  texel is 1.4 screen pixels), and `crisp: false` draws it at its true height. A close-up density is for a cutscene key that asks. */
export const PLAY_FIGURE = { density: 1, crisp: false } as const

/**
 * Ada Voss, the staff nurse on her first night. The prologue puts her in her street clothes (the old character file's `story`:
 * `scenes.prologue = street`): a cream top with short sleeves under a maroon waistcoat, denim trousers tucked into brown boots, her
 * auburn bob, dark eyes. The bob is the kit's `smoothBob`: the builder has no `bob` style of the old kind.
 */
export const ADA: CharacterDef = {
  id: 'ada',
  name: 'Ada Voss',
  sliders: {
    frame: 0.85,
    height: 162,
    muscle: 0.3, // retuned: the old 0.5
    fat: 0.05, // retuned: the old 0.2
    shoulders: 0.55, // retuned: the old 0.47
    hips: 0.2, // retuned: the old 0.37
    legs: 0.6, // retuned: the old 0.3
    arms: 0.15,
    head: 0.87,
    neck: 0.5,
    neckLength: 0.2,
    hands: 0.5,
    feet: 0.6,
    posture: 0.85,
    age: 0.25,
    headTilt: 0,
    chunk: 0.2, // retuned: the old 0.6
  },
  skin: 'fair',
  gait: 'brisk',
  // The old brisk walk whole. The old file zeroed her stance, stance lead and shift (no weight on a leg) and cut her idle elbow and hang; the
  // old brisk gait's own numbers stand her on one hip with a bent, hung arm, as the old hand-painted atlas does, so only her `armOut` of the
  // old file stays. `standOut` did not exist then: the arms hung at `armOut` standing too.
  gaitOverrides: { ...OLD_BRISK, armOut: 0.11, standOut: 0.11 },
  hand: 'R',
  // `drawn` was true in the old file. At the size she is played the builder's drawn face is a lid line the fringe covers (eyes need density 2),
  // so her front view had no face; its decal face is two eye dots, which is what the old figure showed there.
  face: { camera: 0.6, turn: 0.15, blink: 3.7, drawn: false },
  hair: { stiff: 70, damp: 9, trail: 0.3, bounce: 0.08 },
  swatches: ADA_SWATCHES,
  default: 'street',
  outfits: {
    street: [
      { top: 'cream', sleeves: 'short' },
      // The kit's waistcoat follows the torso: fitted at the waist and ending there, narrow across the shoulder so her cream sleeves show.
      { waistcoat: 'maroon', fit: 1, length: 0.05, armhole: 1 },
      // The kit's closer cut, tapered to the ankle: its `trousers` is a cloth shell over the whole leg, where the old trousers were paint on it.
      { jeans: 'denim', taper: 0.7 },
      { shoes: 'bootBrown', sole: 'bootSole', boots: true },
      { hair: 'auburn', style: 'smoothBob' },
      { eyes: 'eyeDark' },
    ],
  },
}

/**
 * The night nurse, the figure the creature is: tall and thin with arms too long, her head cocked, in a worn white uniform
 * (`nurse.json`): top and skirt in ward white with the skirt's hem stained, dark stockings, heavy shoes, a belt, a nurse's cap with
 * its cross, black hair. She has no eyes of her own: the old figure is faceless at the play size. Her hair is the kit's long fall in
 * place of the old `curtain`, and her skirt hangs without the old folds (`HELD`).
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
  skin: 'pale',
  gait: 'loose',
  // The old uncanny walk whole, her arms kept as close as the builder's `loose` hangs them (the old flared arms, 0.2, read as a coat hanger).
  gaitOverrides: { ...OLD_UNCANNY, armOut: 0.09, standOut: 0, standElbow: 0.04 },
  hand: 'R',
  face: { camera: 0, turn: 0, blink: 0 },
  hair: { stiff: 14, damp: 2.6, trail: 0.55, bounce: 0.02, sway: 2.2, hang: 0.8 },
  swatches: NURSE_SWATCHES,
  default: 'uniform',
  outfits: {
    uniform: [
      { top: 'wardWhite', sleeves: 'short' },
      { skirt: 'wardWhite', length: 0.42, flare: 0.3, stain: 'stain', stainHeight: 0.19 },
      { legs: 'stockingDark' },
      { shoes: 'heavyShoe' },
      { belt: 'wardWhiteShade' },
      { hair: 'inkBlack', style: 'fallLong' },
      { cap: 'capWhite', style: 'nurse', mark: 'cross' },
    ],
  },
}

/** What the old figures wear or do that the painter cannot draw yet, and what the figure shows instead. */
export interface Held {
  readonly old: string
  readonly why: string
  readonly instead: string
}

/** Checked against the kit's painted wardrobe, its hair pieces and the builder's gaits; every other piece of the old outfits is worn. */
export const HELD: readonly Held[] = [
  {
    old: 'the nurse’s curtain hair over her face',
    why: 'the builder’s hair pieces lay clumps from a hairline and let them fall to the sides and back; none hangs a panel across the face, which needs a hair piece of its own (the old `curtain` is a shell over the head and face)',
    instead: 'the kit’s long fall, so her face shows',
  },
  {
    old: 'the folds of the nurse’s skirt',
    why: 'the painted skirt is a smooth profile of rings, with no pleats; the old one hangs seven folds of 0.08',
    instead: 'a smooth skirt with the stained hem',
  },
  {
    old: 'the nurse’s stoop',
    why: 'the old figure stood bent forward with her head cocked down; the builder’s stand holds a figure upright whatever its gait and sliders (`headTilt`, `posture`, `hunch` move her head and shoulders by a texel or two), so it needs a stand of its own',
    instead:
      'the old uncanny gait (a data override of the builder’s `loose`) on an upright figure with her head cocked 15 degrees',
  },
  {
    old: 'Ada’s own bob (the old `bob` style)',
    why: 'the builder’s hair library has no `bob`; the kit’s `smoothBob` is the same chin-length cut in a smooth finish',
    instead: 'the kit’s `smoothBob`',
  },
]
