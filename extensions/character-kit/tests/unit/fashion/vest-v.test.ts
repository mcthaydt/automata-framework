// The length of an open waistcoat's V of shirt: `vend` is how far down the vest, from the neck to its hem, the strip of shirt runs (1, the default, to the hem as it always
// did). The generated images' waistcoat shows a short V over the chest and two rows of buttons under it.
import { describe, expect, it, vi } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'
import { paintedCell } from '#src/testing/painted-cell.ts'

registerFashion()
vi.setConfig({ testTimeout: 60_000 })

/** The base woman in a cream tee under an open maroon waistcoat with `vest` options. */
function vested(vest: Record<string, unknown>): CharacterDef {
  const base = (BASE[1] as { def: CharacterDef }).def
  return {
    ...base,
    swatches: {
      ...base.swatches,
      maroon: { ramp: 19, base: 1, lift: 0, paint: ['#904647', '#6e2434', '#492129', '#2e1026'] },
    },
    default: 'test',
    outfits: {
      test: [
        { tee: 'ribCream', sleeves: 'short' },
        {
          waistcoat: 'maroon',
          fit: 1,
          length: 0.05,
          armhole: 1,
          open: 1,
          chest: 0.5,
          hem: 0.1,
          neckline: 0.5,
          ...vest,
        },
        { jeans: 'denim' },
      ],
    },
  } as unknown as CharacterDef
}

/** How many texels of the front view differ between two figures. */
function differing(a: CharacterDef, b: CharacterDef): number {
  const [x, y] = [paintedCell(a, 0, 2).painted, paintedCell(b, 0, 2).painted]
  let count = 0
  for (let i = 0; i < x.length; i += 4) if (x.slice(i, i + 4).join() !== y.slice(i, i + 4).join()) count++
  return count
}

describe('an open waistcoat’s V', () => {
  it('runs to the hem by default: naming 1 draws the same cells', () => {
    expect(paintedCell(vested({ vend: 1 }), 0, 2).painted).toEqual(paintedCell(vested({}), 0, 2).painted)
  })

  it('can end over the chest: a vend of .4 shows less shirt than the strip to the hem, and the vest closes over the rest', () => {
    expect(differing(vested({ vend: 0.4 }), vested({}))).toBeGreaterThan(12)
  })
})
