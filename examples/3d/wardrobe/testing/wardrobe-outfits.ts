// The outfits the wardrobe's geometry goldens (goldens/dress.json) are taken on: every streetwear garment on four
// bodies, with the hair styles and caps they were first worn with. scripts/record-goldens.ts dresses each one;
// tests/unit/outfits.test.ts dresses them again and compares part by part.

import type { GoldenOutfit } from '@automata/3d/testing'

const MODEL = {}
const TALL = { height: 197, fat: 1, muscle: 0.85, frame: 0.8 }
const eyes = { eyes: 'eye-dark' }

export const WARDROBE_OUTFITS: readonly GoldenOutfit[] = [
  {
    name: 'model-moto',
    sliders: MODEL,
    skin: 'fair',
    garments: [
      { tee: 'cream', rib: 'starch', fit: 1.02, length: 1.6, sleeves: false },
      { jacket: 'ink-black', zip: ['holo-cyan', 'holo-lilac', 'holo-violet'], hardware: 'chrome-dark' },
      { wideLegs: 'denim', stitch: 'topstitch', hardware: 'brass' },
      {
        sneakers: 'cream',
        mudguard: 'flat-grey',
        sole: 'midsole',
        outsole: 'outsole',
        laces: 'cord',
        court: true,
        tab: 'red-trim',
      },
      { chain: 'chrome', links: 'silver', drop: 0.12 },
      { hoops: 'brass', size: 0.3 },
      { shades: 'glass', frame: 'black', up: true },
      { hair: 'ink-black', style: 'box-braid-pony' },
      eyes,
    ],
  },
  {
    name: 'tall-hoodie',
    sliders: TALL,
    skin: 'auburn',
    garments: [
      { hoodie: 'work-green', rib: 'charcoal', inside: 'flat-grey', cords: 'cord', aglets: 'chrome' },
      { cargos: 'tweed', hardware: 'brass', cuff: true, stitch: 'stitch' },
      { sneakers: 'black', sole: 'midsole', outsole: 'outsole' },
      { shades: 'glass', frame: 'chrome-dark' },
      { hair: 'ink-black', style: 'high-top-fade' },
      { cap: 'red-trim', style: 'fitted-back', mark: 'badge' },
      eyes,
    ],
  },
  {
    name: 'model-puffer',
    sliders: MODEL,
    skin: 'pale',
    garments: [
      { tee: 'charcoal', sleeves: false, fit: 1, length: 0 },
      { puffer: 'maroon', trim: 'black', zip: 'chrome', length: 0.5, baffles: 5 },
      { cargos: 'work-green', width: 0.8 },
      { sneakers: 'starch', laces: 'cord' },
      { hoops: 'silver', size: 0.1 },
      { hair: 'auburn', style: 'sleek-bun' },
      eyes,
    ],
  },
  {
    name: 'tall-bomber',
    sliders: TALL,
    skin: 'sallow',
    garments: [
      { tee: 'starch', fit: 1.08, length: 1.2 },
      { bomber: 'rubber-brown', rib: 'black', hardware: 'brass', tipping: 'red-trim', zip: ['holo-cyan'] },
      { wideLegs: 'navy' },
      { sneakers: 'flat-grey', court: false },
      { chain: 'brass' },
      { hair: 'ink-black', style: 'locs' },
      eyes,
    ],
  },
  {
    name: 'model-hoodie-fades',
    sliders: { ...MODEL, chunk: 0.4, head: 0.6 },
    skin: 'auburn',
    garments: [
      { hoodie: 'navy' },
      { cargos: 'charcoal' },
      { sneakers: 'cream' },
      { hair: 'brown', style: 'quiff-fade' },
      eyes,
    ],
  },
  {
    name: 'model-short-fade',
    sliders: MODEL,
    skin: 'brown',
    garments: [{ tee: 'navy' }, { wideLegs: 'denim' }, { hair: 'black', style: 'short-fade' }, eyes],
  },
  {
    name: 'model-cornrows',
    sliders: { ...MODEL, height: 165, frame: 1 },
    skin: 'brown',
    garments: [{ tee: 'maroon' }, { cargos: 'tweed' }, { hair: 'black', style: 'cornrows' }, eyes],
  },
]
