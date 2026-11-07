// AF's default palette, DUEL: 32 ramps of 8 colours, dark to light, so colour `r * 8 + s` is ramp `r`, step `s`
// (docs/art/palettes/duel.txt, which a test checks this list against). The colours were generated once from the
// DUEL look-up table; the palette's author and licence are not recorded yet (docs/art/palettes/duel.md).
// Ramp 6 step 0 (`#002219`) is the outline colour: never shaded.

/** DUEL's 32 ramps of 8 `#rrggbb` colours, dark to light: colour `r * 8 + s` is ramp `r`, step `s`. */
export const DUEL_RAMPS: readonly (readonly string[])[] = Object.freeze(
  [
    ['#000000', '#222323', '#434549', '#626871', '#828b98', '#a6aeba', '#cdd2da', '#f5f7fa'],
    ['#625d54', '#857565', '#9e8c79', '#aea189', '#bbafa4', '#ccc3b1', '#eadbc9', '#fff3d6'],
    ['#583126', '#733d3b', '#885041', '#9a624c', '#ad6e51', '#d58d6b', '#fbaa84', '#ffce7f'],
    ['#002735', '#003850', '#004d5e', '#0b667f', '#006f89', '#328ca7', '#24aed6', '#88d6ff'],
    ['#662b29', '#94363a', '#b64d46', '#cd5e46', '#e37840', '#f99b4e', '#ffbc4e', '#ffe949'],
    ['#282b4a', '#3a4568', '#615f84', '#7a7799', '#8690b2', '#96b2d9', '#c7d6ff', '#c6ecff'],
    ['#002219', '#003221', '#174a1b', '#225918', '#2f690c', '#518822', '#7da42d', '#a6cc34'],
    ['#181f2f', '#23324d', '#25466b', '#366b8a', '#318eb8', '#41b2e3', '#52d2ff', '#74f5fd'],
    ['#1a332c', '#2f3f38', '#385140', '#325c40', '#417455', '#498960', '#55b67d', '#91daa1'],
    ['#5e0711', '#82211d', '#b63c35', '#e45c5f', '#ff7676', '#ff9ba8', '#ffbbc7', '#ffdbff'],
    ['#2d3136', '#48474d', '#5b5c69', '#73737f', '#848795', '#abaebe', '#bac7db', '#ebf0f6'],
    ['#3b303c', '#5a3c45', '#8a5258', '#ae6b60', '#c7826c', '#d89f75', '#ecc581', '#fffaab'],
    ['#31222a', '#4a353c', '#5e4646', '#725a51', '#7e6c54', '#9e8a6e', '#c0a588', '#ddbf9a'],
    ['#2e1026', '#49283d', '#663659', '#975475', '#b96d91', '#c178aa', '#db99bf', '#f8c6da'],
    ['#002e49', '#004051', '#005162', '#006b6d', '#008279', '#00a087', '#00bfa3', '#00deda'],
    ['#453125', '#614a3c', '#7e6144', '#997951', '#b29062', '#cca96e', '#e8cb82', '#fbeaa3'],
    ['#5f0926', '#6e2434', '#904647', '#a76057', '#bd7d64', '#ce9770', '#edb67c', '#edd493'],
    ['#323558', '#4a5280', '#64659d', '#7877c1', '#8e8ce2', '#9c9bef', '#b8aeff', '#dcd4ff'],
    ['#431729', '#712b3b', '#9f3b52', '#d94a69', '#f85d80', '#ff7daf', '#ffa6c5', '#ffcdff'],
    ['#49251c', '#633432', '#7c4b47', '#98595a', '#ac6f6e', '#c17e7a', '#d28d7a', '#e59a7c'],
    ['#202900', '#2f4f08', '#495d00', '#617308', '#7c831e', '#969a26', '#b4aa33', '#d0cc32'],
    ['#622a00', '#753b09', '#854f12', '#9e6520', '#ba882e', '#d1aa39', '#e8d24b', '#fff64f'],
    ['#26233d', '#3b3855', '#56506f', '#75686e', '#917a7b', '#b39783', '#cfaf8e', '#fedfb1'],
    ['#1d2c43', '#2e3d47', '#394d3c', '#4c5f33', '#58712c', '#6b842d', '#789e24', '#7fbd39'],
    ['#372423', '#53393a', '#784c49', '#945d4f', '#a96d58', '#bf7e63', '#d79374', '#f4a380'],
    ['#2d4b47', '#47655a', '#5b7b69', '#71957d', '#87ae8e', '#8ac196', '#a9d1c1', '#e0faeb'],
    ['#001b40', '#03315f', '#07487c', '#105da2', '#1476c0', '#4097ea', '#55b1f1', '#6dccff'],
    ['#554769', '#765d73', '#977488', '#b98c93', '#d5a39a', '#ebbd9d', '#ffd59b', '#fdf786'],
    ['#1d1d21', '#3c3151', '#584a7f', '#7964ba', '#9585f1', '#a996ec', '#baabf7', '#d1bdfe'],
    ['#262450', '#28335d', '#2d3d72', '#3d5083', '#5165ae', '#5274c5', '#6c82c4', '#8393c3'],
    ['#492129', '#5e414a', '#77535b', '#91606a', '#ad7984', '#b58b94', '#d4aeaa', '#ffe2cf'],
    ['#721c03', '#9c3327', '#bf5a3e', '#e98627', '#ffb108', '#ffcf05', '#fff02b', '#f7f4bf'],
  ].map((ramp) => Object.freeze(ramp)),
)

/** How many steps a ramp has. */
const STEPS = 8

/**
 * One lowercase word for each ramp, in ramp order, so a swatch can say `{ ramp = "skin", step = 5 }` instead of a bare
 * number. The words are AF's own labels for what each ramp looks like; DUEL itself names none.
 */
export const DUEL_RAMP_NAMES = [
  'grey',
  'sand',
  'skin',
  'sea',
  'flame',
  'dusk',
  'moss',
  'sky',
  'pine',
  'rose',
  'slate',
  'clay',
  'mud',
  'plum',
  'teal',
  'wood',
  'wine',
  'indigo',
  'cherry',
  'rust',
  'olive',
  'amber',
  'mauve',
  'forest',
  'brick',
  'sage',
  'ocean',
  'dawn',
  'violet',
  'navy',
  'blush',
  'ember',
] as const

/** A ramp's name. */
export type DuelRampName = (typeof DUEL_RAMP_NAMES)[number]

/** The palette index (0 to 255) of step `at` (0 dark to 7 light) on the ramp called `name`. */
export function duelIndex(name: DuelRampName, at: number): number {
  if (!Number.isInteger(at) || at < 0 || at >= STEPS) throw new Error(`step is 0 to ${STEPS - 1}, got ${at}`)
  return DUEL_RAMP_NAMES.indexOf(name) * STEPS + at
}

/** The ramp (0 to 31) a palette index is on. */
export function rampOf(index: number): number {
  return Math.floor(index / STEPS)
}

/** `index` moved `by` steps along its own ramp (negative is darker), stopping at the ramp's ends. */
export function step(index: number, by: number): number {
  const first = rampOf(index) * STEPS
  return first + Math.min(STEPS - 1, Math.max(0, index - first + by))
}

/** `#rrggbb` as OKLab [L, a, b] (Björn Ottosson's matrices on linear sRGB). */
function oklab(hex: string): [number, number, number] {
  const linear = (shift: number): number => {
    const c = ((Number.parseInt(hex.slice(1), 16) >> shift) & 0xff) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const r = linear(16)
  const g = linear(8)
  const b = linear(0)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

let palette: [number, number, number][] | undefined

/** The palette index of the DUEL colour nearest `hex` (`#rrggbb`) in OKLab; the first wins a tie. */
export function nearestDuel(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`expected a colour like #ff0040, got "${hex}"`)
  palette ??= DUEL_RAMPS.flat().map(oklab)
  const [L, a, b] = oklab(hex.toLowerCase())
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (const [index, [pl, pa, pb]] of palette.entries()) {
    const distance = (pl - L) ** 2 + (pa - a) ** 2 + (pb - b) ** 2
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  }
  return best
}
