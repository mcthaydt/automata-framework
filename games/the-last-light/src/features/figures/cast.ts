import type { CharacterDef } from '@automata/character-kit'
import { OLD_BRISK, OLD_UNCANNY } from './old-gaits.ts'
import { ADA_LOOK_SWATCHES, ADA_SWATCHES, NURSE_SWATCHES } from './old-swatches.ts'

// The two painted figures of the night: Ada, and the figure that walks the ward. Each is the old game's character file
// (`src/render/figure/characters/ada.json` and `nurse.json` at 92e6704) dressed piece for piece: the same hair physics, outfit and
// swatches, and the old gait whole, drawn by the character kit's painted wardrobe (a waistcoat, stockings, a belt, a cap and boots are
// its kinds). Where a number of the old file means something else in the painter now it is retuned by what the figure looks like against
// the old game's own pictures (the lines marked `retuned`). What the painter still cannot draw is in `HELD`, with what the figure shows
// instead; nothing else is left out.

/** How a figure is painted: at its true height (`crisp: false`, the old game's: whole pixels a texel would shrink Ada by the camera's
 *  1.4 pixels a density-1 texel, to 71%), and at the density its camera needs, which the kit chooses each frame. Play's camera
 *  (52 lines a metre, a zoom of 1.4) asks for density 1, about 37 texels a metre, which is the old game's; a cutscene shot closer than
 *  play asks for more, and a shot at zoom 2 or over gets density 2 or over. */
export const PLAY_FIGURE = { crisp: false, holdSkinHue: true, maxDensity: 8 } as const

/**
 * The character a density paints. A figure whose face is a decal (`face.drawn: false`: two dots, which is what the old figure showed at the
 * size it is played, where the builder's drawn face is a lid line the fringe covers) has its drawn face from density 2, where the painter's
 * lids, brows, nose and mouth fit in the texels. Any other figure is its own at every density.
 */
export const defAtDensity =
  (def: CharacterDef) =>
  (density: 1 | 2 | 4 | 8): CharacterDef =>
    density < 2 || def.face?.drawn !== false ? def : { ...def, face: { ...def.face, drawn: true } }

/**
 * Ada Voss, the staff nurse on her first night. The prologue puts her in her street clothes (the old character file's `story`:
 * `scenes.prologue = street`): an ivory shirt with a collar, its sleeves rolled to the elbow, under an oxblood waistcoat worn open, faded slim jeans cropped above
 * tan ankle boots, her auburn bob, dark eyes. The bob is the kit's `bobFringeFull`: the builder has no `bob` style of the old kind, and the kit's plain `smoothBob` is
 * a helmet with a tail (46 hair texels at the play size to the old bob's 88); the fringe and the fuller mass at the ear make 82.
 */
export const ADA: CharacterDef = {
  id: 'ada',
  name: 'Ada Voss',
  sliders: {
    frame: 0.85,
    // retuned: the old 162. The old painter drew her 162 cm as 59 rows and ours draws it as 65, so at the same scale she was a head-and-a-bit
    // bigger on the page than the figure the Owner prefers; 154 draws her 62 (the old atlas is 61). Her canon height is still 1.62 m.
    height: 154,
    muscle: 0.3, // retuned: the old 0.5
    fat: 0.05, // retuned: the old 0.2
    shoulders: 0.55, // retuned: the old 0.47
    // retuned: the old 0.37, then 0.2 for a leaner pelvis. The builder stands a figure with its weight foot drawn in a quarter of the way to the
    // middle line, so the feet stand 0.75 of the hip joints' width apart where the old figure's stood under its hips; at 0.2 her two legs touch
    // from the hip to the ankle at the size she is played. At her height now 0.9 leaves 5 texels of floor between them and 1 gives 12, with no
    // wider a hip row (19 by the proportions helper, 21 by the older bands, either way). A wider stand is the painter's (README, list 3).
    hips: 1,
    legs: 0.3, // the old 0.3 (round 1 had it at 0.6 for longer legs; the old figure's legs are half of her, 29 rows of 59, and ours were 52%)
    arms: 0.15,
    head: 0.87,
    neck: 0.5,
    neckLength: 0.1, // retuned: the old 0.2 (the head below sits lower)
    hands: 0.5,
    feet: 0.6,
    posture: 0.85,
    age: 0.25,
    headTilt: 0,
    chunk: 0.2, // retuned: the old 0.6
  },
  // The head's own size, in metres chin to crown (the slider's 0.87 draws 0.24 m at this height, 12 rows with her bob where the old Ada's head is
  // 13): the sliders move the head by less than a texel here, the gene does not.
  genes: { head: 0.28 },
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
        length: 0.05,
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
        taper: 0.6,
        gap: 1,
        crop: 0.3,
        turn: 'denimTurn',
        seam: 'denimTurn',
        waistband: 'denimBand',
      },
      { shoes: 'bootBrown', sole: 'bootSole', boots: true, shaft: 0.2, heel: 1, toe: 'bootToe' },
      { hair: 'auburn', style: 'bobFringeFull' },
      // The kit's eyes of a decal face: two texels tall and about four apart, where the builder's `eyes` is one texel each, two apart.
      { eyeMarks: 'eyeDark' },
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
  {
    old: 'Ada’s own bob (the old `bob` style)',
    why: 'the builder’s hair library has no `bob`; the kit’s `bobFringeFull` is a chin-length bob with a fringe and mass at the ear, built from the builder’s scalp and fall pieces, but a piece of its own could turn its ends under and part it',
    instead: 'the kit’s `bobFringeFull`',
  },
]
