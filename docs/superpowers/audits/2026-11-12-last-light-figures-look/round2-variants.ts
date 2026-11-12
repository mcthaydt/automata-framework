// Round 2's variants: the kit's painted garments' new options (a waistcoat's `fit`, `length` and `armhole`, the legs' `taper`) as
// data over round 1's Ada, read by `figure-variants.ts` (`--export ada`).
import type { CharacterDef } from '../../../../extensions/character-kit/src/entries/index.ts'
import { ADA } from '../../../../games/the-last-light/src/features/figures/cast.ts'

interface Variant {
  readonly label: string
  readonly note: string
  readonly def: CharacterDef
}

/** Ada with her waistcoat and legs replaced by these items. */
const dressed = (waistcoat: Record<string, unknown>, legs: Record<string, unknown>): CharacterDef => ({
  ...ADA,
  outfits: {
    street: (ADA.outfits.street ?? []).map((item) =>
      'waistcoat' in item ? waistcoat : 'jeans' in item || 'trousers' in item ? legs : item,
    ) as never,
  },
})

export const ada: Variant[] = [
  {
    label: 'BEFORE',
    note: 'round 1: the old cut (a tube from shoulder to belt, a pipe to the cuff)',
    def: dressed({ waistcoat: 'maroon', fit: 0, length: 0.35, armhole: 0 }, { jeans: 'denim' }),
  },
  {
    label: 'A',
    note: 'the waistcoat fitted and cropped at the waist, jeans tapered',
    def: dressed({ waistcoat: 'maroon', fit: 1, length: 0.05 }, { jeans: 'denim', taper: 0.7 }),
  },
  {
    label: 'B (ADOPTED)',
    note: 'A with an armhole: the shirt shows at the shoulder',
    def: dressed({ waistcoat: 'maroon', fit: 1, length: 0.05, armhole: 1 }, { jeans: 'denim', taper: 0.7 }),
  },
  {
    label: 'D',
    note: 'B with a brown belt at the waist (an outfit choice: the old street outfit has none)',
    def: {
      ...dressed({ waistcoat: 'maroon', fit: 1, length: 0.05, armhole: 1 }, { jeans: 'denim', taper: 0.7 }),
      outfits: {
        street: [
          ...((dressed(
            { waistcoat: 'maroon', fit: 1, length: 0.05, armhole: 1 },
            { jeans: 'denim', taper: 0.7 },
          ).outfits.street ?? []) as never[]),
          { belt: 'bootBrown' },
        ],
      },
    },
  },
  {
    label: 'C',
    note: 'B with the vest to the hip (length 0.6)',
    def: dressed({ waistcoat: 'maroon', fit: 1, length: 0.6, armhole: 1 }, { jeans: 'denim', taper: 1 }),
  },
]
