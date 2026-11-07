// The outfits the geometry goldens (tests/fixtures/goldens/dress.json) are taken on: between them every classic
// garment, both kinds of headwear and every kind of hair piece, on four bodies. The streetwear wardrobe's own
// outfits are the wardrobe example's (examples/3d/wardrobe/testing/wardrobe-outfits.ts).
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
      { waistcoat: 'tweed' },
      { trousers: 'charcoal' },
      { shoes: 'boot-brown', sole: 'boot-sole', boots: true },
      { coat: 'navy-deep', length: 0.8, buttons: 'brass', collar: 'navy' },
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
      { belt: 'boot-brown', buckle: 'brass' },
      { shoes: 'boot-brown' },
      { hair: 'steel-grey', style: 'curtain' },
      { eyes: 'eye-dark', brows: 'steel-grey' },
      { mark: 'watch', colour: 'silver', side: 'L' },
    ],
  },
  {
    name: 'model-nurse',
    sliders: MODEL,
    skin: 'sallow',
    garments: [
      { top: 'ward-white', sleeves: 'short', collar: 'ward-white-shade' },
      { legs: 'stocking' },
      { skirt: 'ward-white', length: 0.7, flare: 0.5, folds: 0.08, hem: 'red-trim' },
      {
        apron: 'starch',
        length: 0.6,
        straps: 'cross',
        pockets: true,
        tie: true,
        bibWidth: 0.6,
        wrap: 1.2,
      },
      { gloves: 'starch-shade' },
      { shoes: 'black', sole: 'sole' },
      { hair: 'auburn', style: 'bob' },
      { cap: 'cap-white', style: 'nurse', mark: 'cross' },
      { mark: 'badge', colour: 'badge', side: 'R' },
      { eyes: 'eye-dark', lids: 'lid', brows: 'brow' },
    ],
  },
  {
    name: 'model-apron-neck',
    sliders: MODEL,
    skin: 'fair',
    garments: [
      { top: 'cream', sleeves: 'none' },
      { trousers: 'denim' },
      { apron: 'rag', shade: 'wood', length: 0.4, bib: true, straps: 'neck' },
      { coat: 'maroon', length: 0.3, collar: 'mauve' },
      { shoes: 'rubber-brown' },
      { hair: 'brown', style: 'choppy-layers' },
      eyes,
    ],
  },
  {
    name: 'model-braids',
    sliders: MODEL,
    skin: 'fair',
    garments: [
      { top: 'cream', sleeves: 'short', cuffs: 'starch' },
      { trousers: 'denim' },
      { shoes: 'cream', sole: 'midsole' },
      { hair: 'ink-black', style: 'box-braid-pony' },
      eyes,
    ],
  },
  {
    name: 'tall-fade',
    sliders: TALL,
    skin: 'auburn',
    garments: [
      { top: 'work-green', sleeves: 'long', cuffs: 'charcoal' },
      { trousers: 'tweed' },
      { shoes: 'black', sole: 'midsole' },
      { hair: 'ink-black', style: 'high-top-fade' },
      { cap: 'red-trim', style: 'fitted-back', mark: 'badge' },
      eyes,
    ],
  },
  {
    name: 'model-bun',
    sliders: MODEL,
    skin: 'pale',
    garments: [
      { top: 'charcoal', sleeves: 'short' },
      { trousers: 'work-green' },
      { shoes: 'starch' },
      { hair: 'auburn', style: 'sleek-bun' },
      eyes,
    ],
  },
  {
    name: 'tall-locs',
    sliders: TALL,
    skin: 'sallow',
    garments: [
      { top: 'starch', sleeves: 'long' },
      { trousers: 'navy' },
      { shoes: 'flat-grey' },
      { hair: 'ink-black', style: 'locs' },
      eyes,
    ],
  },
  {
    name: 'model-quiff',
    sliders: { ...MODEL, chunk: 0.4, head: 0.6 },
    skin: 'auburn',
    garments: [
      { top: 'navy', sleeves: 'long' },
      { trousers: 'charcoal' },
      { shoes: 'cream' },
      { hair: 'brown', style: 'quiff-fade' },
      eyes,
    ],
  },
  {
    name: 'model-short-fade',
    sliders: MODEL,
    skin: 'brown',
    garments: [
      { top: 'navy', sleeves: 'short' },
      { trousers: 'denim' },
      { hair: 'black', style: 'short-fade' },
      eyes,
    ],
  },
  {
    name: 'model-cornrows',
    sliders: { ...MODEL, height: 165, frame: 1 },
    skin: 'brown',
    garments: [
      { top: 'maroon', sleeves: 'short' },
      { trousers: 'tweed' },
      { hair: 'black', style: 'cornrows' },
      eyes,
    ],
  },
]
