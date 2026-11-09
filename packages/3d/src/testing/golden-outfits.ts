// The outfits the geometry goldens (tests/fixtures/goldens/dress.json) are taken on: between them every core
// garment, cap and hair style (locks), on four bodies. The kit's garments and hairstyles have their goldens in the
// character kit; the streetwear wardrobe's outfits are the wardrobe example's (examples/3d/wardrobe/testing/wardrobe-outfits.ts).
// scripts/record-goldens.ts dresses each one; build.test.ts dresses them again and compares part by part.

import type { Sliders } from '../features/figures/body/genes.ts'
import type { FigureDef } from '../features/figures/figure/figure.schema.ts'
import type { Garment } from '../features/figures/figure/garment.schema.ts'
import { KEEPER_SLIDERS, WICK_SLIDERS } from './fixture-sliders.ts'

export interface GoldenOutfit {
  readonly name: string
  readonly sliders: Partial<Sliders>
  readonly skin: string
  readonly garments: readonly Garment[]
}

/** A one-outfit figure (its outfit named `golden`) with the given body, skin and garments. */
export function figureOf(
  sliders: FigureDef['sliders'],
  skin: string,
  garments: readonly Garment[],
): FigureDef {
  return { sliders, skin, gait: 'bounce', hand: 'R', outfits: { golden: garments }, default: 'golden' }
}

const KEEPER: Partial<Sliders> = {
  ...KEEPER_SLIDERS,
  face: { jaw: 0.7, chin: 0.65, bridge: 0.8, browWeight: 0.8, hood: 0.6 },
}
const MODEL: Partial<Sliders> = {}
const TALL: Partial<Sliders> = { height: 197, fat: 1, muscle: 0.85, frame: 0.8 }
const eyes = { eyes: 'eye-dark' }

export const GOLDEN_OUTFITS: readonly GoldenOutfit[] = [
  {
    name: 'wick-wanderer',
    sliders: WICK_SLIDERS,
    skin: 'fair',
    garments: [
      { top: 'navy', sleeves: 'long', cuffs: 'brass' },
      { trousers: 'navy-deep' },
      { shoes: 'boot-brown', boots: true },
      { cape: 'navy', length: 0.9, trim: 'brass' },
      {
        cap: 'navy',
        style: {
          locks: [
            { on: 'head', at: [0, 0.62, -0.08], r: [1.3, 0.62, 1.2], e: [0.6, 0.7] },
            { on: 'back', at: [0, 0.95, -0.9], r: [0.3, 0.42, 0.3], taper: [1, 0.4], pitch: -0.6 },
          ],
        },
      },
      { eyes: 'glint' },
    ],
  },
  {
    name: 'keeper-lamplighter',
    sliders: KEEPER,
    skin: 'pale',
    garments: [
      { top: 'starch', sleeves: 'long', collar: 'starch-shade' },
      { trousers: 'charcoal' },
      { shoes: 'boot-brown', sole: 'boot-sole', boots: true },
      { hair: 'steel-grey', style: 'cropped' },
      { cap: 'tweed', style: 'flat', mark: 'badge' },
      { eyes: 'eye-dark', brows: 'steel-grey', lids: 'pale-lid', stubble: 'stubble' },
    ],
  },
  {
    name: 'keeper-shirtsleeves',
    sliders: KEEPER,
    skin: 'pale',
    garments: [
      { top: 'starch', sleeves: 'short', cuffs: 'starch-shade' },
      { trousers: 'charcoal' },
      { shoes: 'boot-brown' },
      { hair: 'steel-grey', style: 'curtain' },
      { eyes: 'eye-dark', brows: 'steel-grey' },
    ],
  },
  {
    name: 'model-bob',
    sliders: MODEL,
    skin: 'sallow',
    garments: [
      { top: 'ward-white', sleeves: 'short', collar: 'ward-white-shade' },
      { trousers: 'denim' },
      { shoes: 'black', sole: 'sole' },
      { hair: 'auburn', style: 'bob' },
      { cap: 'cap-white', style: 'nurse', mark: 'cross' },
      { eyes: 'eye-dark', lids: 'lid', brows: 'brow' },
    ],
  },
  {
    name: 'tall-curtain',
    sliders: TALL,
    skin: 'auburn',
    garments: [
      { top: 'work-green', sleeves: 'long', cuffs: 'charcoal' },
      { trousers: 'tweed' },
      { shoes: 'black', sole: 'midsole' },
      { hair: 'ink-black', style: 'curtain' },
      { cap: 'red-trim', style: 'fitted-back', mark: 'badge' },
      eyes,
    ],
  },
]
