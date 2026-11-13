// The old game's swatches (`src/render/figure/library/swatches.json` at 92e6704) that Ada and the night nurse wear, under their old
// names and with the old numbers, so each cloth is the colour it was. The builder's `Material` has since dropped four of the old numbers (`grain`, `floor`, `wear`, `rim`); the painted colours, ramps and finishes are the old ones. A character's own swatches go over the builder's and the
// kit's (`CharacterDef.swatches`), so `denim` here is the old denim, not the runway's.
import type { CharacterDef } from '@automata/character-kit'

export type Swatches = NonNullable<CharacterDef['swatches']>

/** Ada's: her street clothes, her auburn hair, her dark eyes and her fair skin. */
export const ADA_SWATCHES: Swatches = {
  cream: { ramp: 1, base: 4, paint: ['#fff3d6', '#eadbc9', '#ccc3b1', '#bbafa4'], tones: [0.45, -0.2, -0.6] },
  maroon: { ramp: 19, base: 1, lift: 0, paint: ['#904647', '#6e2434', '#492129', '#2e1026'] },
  denim: { ramp: 7, base: 1, paint: ['#366b8a', '#25466b', '#23324d', '#181f2f'] },
  bootBrown: { ramp: 24, base: 2, gloss: 0.93, paint: ['#945d4f', '#784c49', '#583126', '#372423'] },
  bootSole: { ramp: 24, base: 0, flat: true },
  auburn: {
    ramp: 2,
    base: 2,
    gloss: 0.94,
    strands: true,
    paint: ['#885041', '#662b29', '#49251c', '#372423'],
  },
  // The hair she wears in play: the auburn above has DUEL row 2's red step (#662b29) in its ramp, and the room darkens its base into row 2's
  // #733d3b: her crown read as three patches (maroon, mauve, pink). Row 15 is DUEL's one brown row that stays brown as it darkens (52 to 66
  // degrees of hue); shot in the hall beside auburn, auburn without its gloss and a lighter row 15, this ash brown alone reads as one head of
  // hair with a lit band and a shadow (the ada frames folder, session 4, item 2b). No gloss: the plain finish.
  ashBrown: { ramp: 15, base: 2, strands: true, paint: ['#7e6144', '#614a3c', '#453125', '#372423'] },
  eyeDark: { ramp: 28, base: 0, flat: true },
  fair: {
    ramp: 27,
    base: 5,
    lift: 0,
    paint: ['#ebbd9d', '#d5a39a', '#c17e7a', '#945d4f'],
    tones: [0.05, -0.55, -0.9],
  },
}

/**
 * Ada's clothes as the generated images draw them (`ada-look-spec.md`), which the Owner chose over the old sprites: calm plain cloth on DUEL,
 * no tile and no wash. An ivory shirt with a lighter collar and a darker cuff fold, a deep oxblood waistcoat with brass buttons, faded
 * blue-grey denim with a paler turn-up, seam and a darker waistband, tan-brown boots with a lighter toe cap.
 */
export const ADA_LOOK_SWATCHES: Swatches = {
  collarLinen: {
    ramp: 1,
    base: 5,
    paint: ['#fff3d6', '#eadbc9', '#ccc3b1', '#bbafa4'],
    tones: [0.2, -0.5, -0.9],
  },
  cuffLinen: { ramp: 1, base: 3, paint: ['#eadbc9', '#ccc3b1', '#bbafa4', '#aea189'] },
  oxblood: { ramp: 16, base: 1, lift: 0, paint: ['#904647', '#6e2434', '#49251c', '#2e1026'] },
  brass: { ramp: 15, base: 5, flat: true, paint: ['#cca96e', '#b29062', '#997951', '#997951'] },
  // The lightest paint is the mid one, so the form's light on a thigh or a knee is not a pale blotch on plain cloth.
  fadedDenim: { ramp: 0, base: 3, paint: ['#626871', '#626871', '#2e3d47', '#1d2c43'] },
  denimTurn: { ramp: 0, base: 4, paint: ['#a6aeba', '#828b98', '#626871', '#434549'] },
  denimBand: { ramp: 0, base: 2, paint: ['#626871', '#434549', '#2e3d47', '#1d2c43'] },
  // The painter's `lipsWarm` has its upper lip (#a76057) a step from the warm skin, so at density 2 on a lit face the mouth is one pale smudge.
  // The upper lip is the painter's deeper brown-red (#7c4b47) over a lit lower lip: two rows, two tones, as the reference's mouth. The lower
  // lip is a rose a step deeper than the painter's #d28d7a, which sat .033 from her skin in OKLab and read as skin in play.
  lipsAda: { ramp: 16, base: 3, flat: true, paint: ['#7c4b47', '#c17e7a', '#904647', '#904647'] },
  // A toe cap a step lighter than the boot, never the skin's own peach: #bf7e63 read as bare toes under the jeans at density 2 on a lit face.
  bootToe: { ramp: 24, base: 4, paint: ['#945d4f', '#784c49', '#583126', '#372423'] },
}

/** The night nurse's: the worn uniform, its stained hem, her dark stockings and heavy shoes, her cap and its cross, black hair, pale skin. */
export const NURSE_SWATCHES: Swatches = {
  wardWhite: {
    ramp: 10,
    base: 6,
    paint: ['#cdd2da', '#abaebe', '#848795', '#5b5c69'],
    streaks: 0.7,
  },
  wardWhiteShade: {
    ramp: 10,
    base: 5,
    lift: 0,
    paint: ['#abaebe', '#848795', '#5b5c69', '#5b5c69'],
  },
  stockingDark: { ramp: 10, base: 1, lift: 0, paint: ['#3b303c', '#2c272e', '#1d1d21', '#1d1d21'] },
  inkBlack: {
    ramp: 0,
    base: 1,
    lift: 1,
    gloss: 0.95,
    strands: true,
    paint: ['#29324c', '#181f2f', '#0c1018', '#0c1018'],
    tones: [0.9, 0.5, -5],
  },
  capWhite: { ramp: 10, base: 7, lift: 0, paint: ['#f5f7fa', '#e1e5ea', '#a6aeba', '#828b98'] },
  cross: { ramp: 9, base: 2, flat: true, paint: ['#b63c35', '#b63c35', '#82211d', '#82211d'] },
  heavyShoe: { ramp: 10, base: 1, gloss: 0.95, paint: ['#48474d', '#2d3136', '#121214', '#121214'] },
  stain: { ramp: 16, base: 1, lift: 0, paint: ['#633432', '#492129', '#492129', '#492129'] },
  pale: {
    ramp: 1,
    base: 4,
    lift: 0,
    paint: ['#cfcbc4', '#bbafa4', '#917a7b', '#75686e'],
    tones: [0.05, -0.55, -0.9],
  },
}
