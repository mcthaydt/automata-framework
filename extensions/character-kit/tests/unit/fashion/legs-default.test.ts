// A generator gains options; it does not change what existing data draws. The painted trousers and jeans gained `gap` (cut.test.ts), and
// legs that name none draw as they did before: the figure builder's base pair in a cream tee and each cut of legs, eight views at density
// 2, each cell's SHA-1 (first 12 hex digits) recorded from the commit before the option (`fc2cf92c` and its waistcoat's options).
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { BASE } from '#src/shared/figure-builder/door.ts'
import { paintedStand } from '#src/testing/painted-cell.ts'

vi.setConfig({ testTimeout: 60_000 })

/** What each cut draws, by the pair's member: trousers as the kit has them, wide and tapered ones, and jeans tapered. */
const BEFORE: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  trousers: {
    'base-m': [
      '7eee865fb1d9',
      '4b9e8d42cbbb',
      'ec825085464d',
      '79c62f9ae3f6',
      '58800a09a54b',
      'ec507cd4ccff',
      '505d085b0738',
      'b23d6ce3c3f8',
    ],
    'base-f': [
      '825ff5dbc569',
      '836340c696e7',
      '95746e0de064',
      '4478bfe1dc80',
      '7989a66d97b7',
      '6e73a576eaa3',
      '1c50a4c32d49',
      'af87dc074ced',
    ],
  },
  'trousers wide': {
    'base-m': [
      '082633330913',
      '750ae53fc321',
      'fefe4aa0fd67',
      '5c9aa4261176',
      'aca426ff9fbd',
      'b9553181ff6f',
      '57877c697c9a',
      '54f804b10058',
    ],
    'base-f': [
      '3dba15cbd6e1',
      'e964d6eac696',
      '4b2ed56278cd',
      'cc997ceb820e',
      'c6a320f040c5',
      '380621bf7ef2',
      '5ccb58af6c7b',
      'd0984f75ab0e',
    ],
  },
  'jeans tapered': {
    'base-m': [
      'dc4d2eb16262',
      'b81850d1aec6',
      'fc9a27d3bbd5',
      '2676528977e7',
      '1d12a8033eb7',
      'bf90ab86d8ce',
      'dc4104180880',
      '90d79743f94a',
    ],
    'base-f': [
      'e90b9aaaa543',
      '461bdda1413d',
      '9837d50af481',
      '045e1cf2d5eb',
      '4f3596f9638a',
      '725e9f9e4a14',
      '1d28aec9b889',
      'b9ab2a6f2baa',
    ],
  },
}

const CUTS: Readonly<Record<string, object>> = {
  trousers: { trousers: 'denim' },
  'trousers wide': { trousers: 'denim', wide: 1.3, taper: 0.5 },
  'jeans tapered': { jeans: 'denim', taper: 0.7 },
}

describe('legs that name no gap', () => {
  for (const [cut, legs] of Object.entries(CUTS))
    for (const member of BASE) {
      it(`draw ${cut} on ${member.def.id} in eight views as they did before the option`, () => {
        const def = {
          ...member.def,
          default: 'legged',
          outfits: {
            legged: [{ tee: 'ribCream', sleeves: 'short' }, legs, { eyes: 'eyeBrown' }],
          },
        } as typeof member.def
        const cells = paintedStand(def, 2).map((cell) =>
          createHash('sha1').update(cell.painted).digest('hex').slice(0, 12),
        )
        expect(cells).toEqual(BEFORE[cut]?.[member.def.id])
      })
    }
})
