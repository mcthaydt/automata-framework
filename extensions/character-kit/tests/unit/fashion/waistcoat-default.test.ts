// A generator gains options; it does not change what existing data draws. The painted waistcoat gained `fit`, `length` and `armhole`
// (cut.test.ts), and a waistcoat that names none of them draws as it did before: the figure builder's base pair in a cream tee, a
// waistcoat and jeans, eight views at density 2, each cell's SHA-1 (first 12 hex digits) recorded from the commit before the options
// (`a76c7863`), where the waistcoat was the torso grown a flat 1.6 clearances from the neck to the belt.
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { BASE } from '#src/shared/figure-builder/door.ts'
import { paintedStand } from '#src/testing/painted-cell.ts'

vi.setConfig({ testTimeout: 60_000 })

/** The cells of the pair, recorded before the waistcoat had options. */
const BEFORE: Readonly<Record<string, readonly string[]>> = {
  'base-m': [
    '4d4d0889492e',
    '73d86d1c23ca',
    '2c06656ce9d2',
    'ffa85ba0179f',
    '52650d4a085d',
    'e2d60c411cd1',
    '852ff41ed6ba',
    '373e8f1bb44d',
  ],
  'base-f': [
    '5bff45ea48eb',
    '23bdefa34d2b',
    '052c0014d24b',
    '3f7f8f698ef9',
    '301d93879f4e',
    '4df61777e1cc',
    'a7965f563ea9',
    'e94b7ed4f70e',
  ],
}

describe('a waistcoat that names no option', () => {
  for (const member of BASE) {
    it(`draws ${member.def.id} in eight views as it did before the options`, () => {
      const def = {
        ...member.def,
        swatches: {
          ...member.def.swatches,
          vestRed: { ramp: 19, base: 1, lift: 0, paint: ['#904647', '#6e2434', '#492129', '#2e1026'] },
        },
        default: 'vested',
        outfits: {
          vested: [
            { tee: 'ribCream', sleeves: 'short' },
            { waistcoat: 'vestRed' },
            { jeans: 'denim' },
            { eyes: 'eyeBrown' },
          ],
        },
      } as typeof member.def
      const cells = paintedStand(def, 2).map((cell) =>
        createHash('sha1').update(cell.painted).digest('hex').slice(0, 12),
      )
      expect(cells).toEqual(BEFORE[member.def.id])
    })
  }
})
