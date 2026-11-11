// The runway's swatches: DUEL ramp rows and steps (the builder's `duel-ramps`), merged into its `SWATCHES` by
// `registerFashion`. The wardrobe's cloth, leather, shoes and soles from FigureBuilder's `claude/runway-video`
// (`demo/runway/wardrobe.ts`, `cb4aa9f`), and the skin, hair, lip and eye tones of the showcase characters from its
// `demo/runway/library.ts` (the later of the two libraries; `claude/demo-characters` `8fb0242` adds nothing to its swatches).
import type { Material } from '../../shared/figure-builder/door.ts'

const cloth = (ramp: number, base: number, more: Partial<Material> = {}): Material => ({
  ramp,
  base,
  ...more,
})
const skin = (ramp: number, base: number, paint: string[]): Material => ({
  ramp,
  base,
  paint,
  tones: [0.55, 0.04, -0.5],
})
const flat = (ramp: number, base: number, paint: string[]): Material => ({ ramp, base, flat: true, paint })
const hair = (ramp: number, base: number, paint: string[]): Material => ({ ramp, base, paint })

export const FASHION_SWATCHES: Readonly<Record<string, Material>> = {
  // Denim: indigo, a light wash, black.
  denim: cloth(26, 3, { fabric: 'twill22' }),
  denimLight: cloth(26, 5, { fabric: 'twill22' }),
  denimBlack: cloth(29, 2, { fabric: 'twill22' }),
  // Knits.
  ribBlack: cloth(10, 1, { fabric: 'rib' }),
  ribCream: cloth(1, 5, { fabric: 'rib' }),
  ribRust: cloth(31, 2, { fabric: 'rib' }),
  ribSage: cloth(25, 3, { fabric: 'rib' }),
  hoodieGreen: cloth(8, 3, { fabric: 'rib' }),
  hoodieLilac: cloth(28, 4),
  // Plain jersey tees.
  teeWhite: cloth(10, 6),
  teeYellow: cloth(21, 5),
  teeCoral: cloth(9, 4),
  // Patterns.
  breton: cloth(5, 4, { fabric: 'breton' }),
  gingham: cloth(18, 4, { fabric: 'gingham', streaks: 0.4 }),
  plaid: cloth(4, 2, { fabric: 'plaid' }),
  plaidGrey: cloth(10, 3, { fabric: 'plaid', streaks: 0.4 }),
  checkShirt: cloth(3, 3, { fabric: 'gingham' }),
  pinstripe: cloth(29, 3, { fabric: 'pinstripe' }),
  camel: cloth(15, 4, { fabric: 'windowpane' }),
  // Plain wovens.
  chino: cloth(12, 5),
  olive: cloth(23, 3),
  charcoalWool: cloth(10, 1),
  navyWool: cloth(29, 2),
  mustard: cloth(21, 4, { streaks: 0.5 }),
  // Leather by gloss (ramp 0, the chrome row, takes the painter's hard-gloss rims and reads as metal: black leather is on
  // the grey row).
  leatherBlack: cloth(10, 1, { gloss: 0.5 }),
  leatherBrown: cloth(24, 2, { gloss: 0.45 }),
  leatherOxblood: cloth(16, 1, { gloss: 0.5 }),
  // Shoes and their soles.
  sneakerWhite: cloth(10, 6, { gloss: 0.7 }),
  soleWhite: cloth(1, 6),
  soleGum: cloth(12, 4),
  soleBlack: cloth(0, 1),
  chrome: cloth(0, 5, { gloss: 0.3, lift: 0 }),
  // Skin, light to deep, beside the library's skinWarm and skinBrown.
  skinPale: skin(27, 5, ['#fedfb1', '#ebbd9d', '#d5a39a', '#b98c93']),
  skinTan: skin(24, 5, ['#f4a380', '#d79374', '#bf7e63', '#945d4f']),
  skinGolden: skin(11, 5, ['#ecc581', '#d89f75', '#c7826c', '#ae6b60']),
  skinDeep: skin(19, 3, ['#98595a', '#7c4b47', '#633432', '#49251c']),
  // Hair.
  hairBlond: hair(15, 5, ['#e8cb82', '#cca96e', '#b29062', '#7e6144']),
  hairGrey: hair(10, 5, ['#ebf0f6', '#bac7db', '#abaebe', '#848795']),
  hairAuburn: hair(4, 2, ['#cd5e46', '#b64d46', '#94363a', '#662b29']),
  hairBrown: hair(12, 2, ['#725a51', '#5e4646', '#4a353c', '#31222a']),
  hairMouse: hair(22, 3, ['#917a7b', '#75686e', '#56506f', '#3b3855']),
  // Lips and eyes.
  lipsPink: flat(9, 3, ['#e45c5f', '#ff9ba8', '#b63c35', '#b63c35']),
  lipsPale: flat(27, 3, ['#b98c93', '#d5a39a', '#977488', '#977488']),
  lipsDeep: flat(19, 1, ['#633432', '#7c4b47', '#49251c', '#49251c']),
  eyeBlue: flat(7, 3, ['#366b8a', '#25466b', '#23324d', '#000000']),
  eyeGreen: flat(8, 3, ['#417455', '#325c40', '#2f3f38', '#000000']),
}
