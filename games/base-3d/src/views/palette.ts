// The night palette (art direction spec §2, §4.1): base-3d's colours as roles, each an Endesga 64 entry by index, the
// same entry Emberwick's scene uses for that role (its render/scene.ts and render/backdrop.ts). The colours themselves
// come from the one palette source, `@mcthaydt/automata-content/palette`; no view writes a colour literal.
import { DEFAULT_PALETTE } from '@mcthaydt/automata-content/palette'

export const TOKENS = {
  /** The night itself: the clear colour and the nearest silhouettes. */
  night: 15,
  /** The sky above, the haze at the horizon, and the valley below it (Emberwick's three sky bands). */
  skyHigh: 52,
  skyMid: 39,
  skyLow: 38,
  /** The night below the floating ruin and in its fog: the deep blue of Wick's cloak shade. */
  skyDeep: 40,
  /** The moon's light, its shafts and its glow. */
  moonlight: 45,
  /** The moon's disc, its highlight and its craters; the stars. */
  moon: 9,
  moonBright: 8,
  moonShade: 10,
  /** Moonlight where no lamp reaches (Emberwick's light-map clear colour). */
  ambient: 11,
  /** The glowing mushrooms' caps and light. */
  mushroom: 43,
  /** Embers, the lantern, the fireflies and the sparks. */
  ember: 30,
  lantern: 31,
  firefly: 33,
  spark: 32,
  /** Lava: its heat, crust and cracks. */
  hot: 28,
  crust: 27,
  crustDeep: 26,
  /** Stone: blocks, a lighter chip, mortar; the walls' darker mortar. */
  stone: 13,
  stoneLight: 12,
  stoneEdge: 11,
  mortar: 14,
  mortarDeep: 15,
  /** Moss and grass, darkest to brightest: Emberwick's grass sprite (34 tips, 35 moss, 36 shade, 37 drips). */
  mossDeep: 37,
  /** Moss in shadow: a platform's mossy edge. */
  mossShade: 38,
  moss: 36,
  mossMid: 35,
  grass: 35,
  grassTip: 34,
  /** Ruined towers far off. */
  tower: 52,
} as const

export type Token = keyof typeof TOKENS

/** The `#rrggbb` of a palette index. */
export const hexOf = (index: number): string => DEFAULT_PALETTE.colors[index] as string

/** The token's colour as 0xRRGGBB. */
export const colour = (token: Token): number => Number.parseInt(hexOf(TOKENS[token]).slice(1), 16)
