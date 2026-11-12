import type { CharacterDef } from '@automata/character-kit'
import { OLD_BRISK, OLD_UNCANNY } from './old-gaits.ts'
import { ADA_LOOK_SWATCHES, ADA_SWATCHES, NURSE_SWATCHES } from './old-swatches.ts'

// The two painted figures of the night: Ada, and the figure that walks the ward. Each is the old game's character file
// (`src/render/figure/characters/ada.json` and `nurse.json` at 92e6704) dressed piece for piece: the same hair physics, outfit and
// swatches, and the old gait whole, drawn by the character kit's painted wardrobe (a waistcoat, stockings, a belt, a cap and boots are
// its kinds). Where a number of the old file means something else in the painter now it is retuned by what the figure looks like against
// the old game's own pictures (the lines marked `retuned`). What the painter still cannot draw is in `HELD`, with what the figure shows
// instead; nothing else is left out.

/**
 * How a figure is painted in play. At density 2, always: the painter's faces are made of features one or two texels thick at every
 * density (a brow two texels, a lid, an eye's white, a lip), so a face reads at density 2 and is dots at 1 and hair-thin lines at 8
 * (the painter's own note: faces that read at D2; the Owner, 2026-11-12: "I want the characters to look like how they do on the left").
 * At whole pixels (`crisp`): a texel is a whole number of field pixels, never a fraction, so the picture is chunky and clean. The
 * camera is set so that number is 1 in play (the level's views: a 80 mm lens, about 74 field pixels a metre at the figure), and the
 * close-up's shot is framed so it is 2, 3 or 4. The skin keeps its hue in the ward's dim cool light (`holdSkinHue`): Ada was lavender in it.
 */
export const PLAY_FIGURE = { crisp: true, density: 2, holdSkinHue: true } as const

/**
 * Ada Voss, the staff nurse on her first night. The prologue puts her in her street clothes (the old character file's `story`:
 * `scenes.prologue = street`): an ivory shirt with a collar, its sleeves rolled to the elbow, under an oxblood waistcoat worn open, faded slim jeans
 * cropped above tan ankle boots, her auburn chin-length bob with a fringe that ends over the brow.
 *
 * She is the painter's base woman with only what makes her Ada changed (the Owner, 2026-11-12: the characters look like the painter's
 * own faces at density 2): her skin, her hair, her clothes, and the lids and brows of a bolder face (brow weight .75, a crease, a light hood, liner,
 * fuller lips: the base man's lid, which is what the painter's reference shows reads best, with the base woman's eye size). Her body sliders are the
 * base woman's, slimmed a little (less fat and chunk, narrower hips, thinner arms); nothing is pushed by an earlier round. Her bob is the painter's own `bobFringe`: a chin-length dome whose fringe stops a texel over the brow, so her brows and eyes show.
 */
export const ADA: CharacterDef = {
  id: 'ada',
  name: 'Ada Voss',
  // The base woman's own numbers (`extensions/figures/src/shared/base/base-pair.ts`, a test holds them within 0.3 of hers), but for the ones
  // marked: her face's bolder lid and brows, and a slimmer build.
  sliders: {
    frame: 0.95,
    // The prologue's canon height is 1.62 m; 160 draws her 124 rows at density 2, six rows under the base woman's 166 cm.
    height: 160,
    muscle: 0.3,
    fat: 0.25, // the base's 0.35
    shoulders: 0.3,
    hips: 0.55, // the base's 0.65
    arms: 0.3, // the base's 0.35
    head: 1.15,
    chunk: 0.6, // the base's 0.85
    legs: 0.5,
    posture: 0.75,
    age: 0.25,
    headTilt: 0,
    neck: 0.6,
    neckLength: 0.4,
    hands: 0.5,
    feet: 0.55,
    faceForward: 0.6,
    face: {
      width: 0.45,
      jaw: 0.3,
      chin: 0.5,
      cheekHeight: 0.7,
      cheekWidth: 0.6,
      bridge: 0.45,
      nose: 0.45,
      lips: 0.9, // the base's 0.7
      browArch: 0.6,
      browWeight: 0.75, // the base's 0.4
      browHeight: 0.45,
      crease: 0.6, // the base's 0.4
      hood: 0.15, // the base's 0.35: the base man's own lid, which reads open (a lower hood closed the eye)
      liner: 0.5, // the base's 0
    },
  },
  skin: 'skinWarm',
  gait: 'brisk',
  // The old brisk walk whole. The old file zeroed her stance, stance lead and shift (no weight on a leg) and cut her idle elbow and hang; the
  // old brisk gait's own numbers stand her on one hip with a bent, hung arm, as the old hand-painted atlas does, so only her `armOut` of the
  // old file stays. `standOut` did not exist then: the arms hung at `armOut` standing too.
  // The generated images' A-pose is 15 to 20 degrees; in the room her hands hang close to her body.
  gaitOverrides: { ...OLD_BRISK, armOut: 0.03, standOut: 0.03 },
  hand: 'R',
  face: { camera: 0.6, turn: 0.15, blink: 3.7, drawn: true },
  hair: { stiff: 70, damp: 9, trail: 0.3, bounce: 0.08 },
  swatches: { ...ADA_SWATCHES, ...ADA_LOOK_SWATCHES },
  default: 'street',
  outfits: {
    street: [
      // The generated images' Ada (`ada-look-spec.md`), which the Owner chose over the old sprites: an ivory shirt with a spread collar, its sleeves
      // rolled to the elbow on a thick cuff fold, under an oxblood waistcoat worn open (a V of shirt to the sternum, a row of brass buttons
      // down each side); faded blue-grey slim jeans with an outer seam and a waistband, cropped above the ankle with a turn-up; tan ankle
      // boots with a low heel block and a lighter toe cap. All of it the kit's body-fitted shells, in plain calm cloth.
      { shirt: 'cream', sleeves: 'rolled', collar: 'collarLinen', cuff: 'cuffLinen', length: 0 },
      {
        waistcoat: 'oxblood',
        fit: 1,
        length: 0.5,
        armhole: 1,
        open: 1,
        chest: 0.4,
        hem: 0.3,
        neckline: 0.6,
        vend: 0.75,
        buttons: 'brass',
      },
      {
        jeans: 'fadedDenim',
        taper: 1,
        gap: 1,
        crop: 0.3,
        turn: 'denimTurn',
        seam: 'denimTurn',
        waistband: 'denimBand',
      },
      { shoes: 'bootBrown', sole: 'bootSole', boots: true, shaft: 0.2, heel: 1, toe: 'bootToe' },
      { hair: 'auburn', style: 'bobOpen' },
      // The painter's drawn face: eyes with their whites under a lid, brows, lips.
      { eyes: 'eyeBrown', lids: 'lidDeep', white: 'eyeWhite', brows: 'hairBlack', lips: 'lipsAda' },
    ],
  },
}

/**
 * The night nurse, the figure the creature is: tall and thin with arms too long, her head cocked, in a worn white uniform
 * (`nurse.json`): top and skirt in ward white with the skirt's hem stained, dark stockings, heavy shoes, a belt, a nurse's cap with
 * its cross, black hair. She has no eyes of her own: the old figure is faceless at the play size. Her hair is the kit's `curtainLoose`: a
 * scalp shell whose hairline comes down over her face and the rest fanned wide down her back, in place of the old `curtain` (which hangs free of the face, `HELD`), her cap sits flat on
 * her brow as the old one does, and her skirt hangs without the old folds (`HELD`).
 */
export const NIGHT_NURSE: CharacterDef = {
  id: 'nurse',
  name: 'the Night Nurse',
  sliders: {
    frame: 0.9,
    // retuned: the old 210. Her legs were 43 rows of 78 and her trunk 20; the old figures' are 35 and 37 of 71 and 75, her trunk 25 and 26: 200 cm
    // draws her 75 rows (the old atlas), with the legs, the neck and the hips set to the old proportions.
    height: 200,
    muscle: 0,
    fat: 0,
    shoulders: 0.25,
    hips: 0, // retuned: the old -0.29 (a hip row of 22 with the legs shorter, as the old procedural's)
    legs: 0.2, // retuned: the old 0.9 (the hip joint at 49 % of her, not 55: the old figure's legs are half her height)
    arms: 0.99,
    head: 0.19,
    neck: 0.3,
    neckLength: 0.5, // retuned: the old 0.93
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
      { hair: 'inkBlack', style: 'curtainLoose' },
      { cap: 'capWhite', style: 'nurseBrow', mark: 'cross' },
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
    why: 'the builder’s hair pieces lay clumps from a hairline and let them fall to the sides and back; none hangs a panel in front of the face, free of it, which needs a hair piece of its own (the old `curtain` is a shell over the head and face)',
    instead:
      'the kit’s `curtainLoose`: a scalp shell whose hairline comes down to her mouth, so her face is hair from the front, and a wide fan of hair down her back that shows beside her neck; it hugs the face and does not hang in front of her chest',
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
]
