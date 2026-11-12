// A boot's shaft length as an option of the `shoes` garment: `shaft` is how far up the shin the leather rises (a share of the shin's length up from the ankle, 0.42 as it always was). The generated images' boots are ankle boots, a seventh of her height; the default draws as before.
import { describe, expect, it, vi } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { BASE, type CharacterDef, type Material } from '#src/shared/figures/door.ts'
import { paintedCell, rowWidths } from '#src/testing/painted-cell.ts'

registerFashion()
vi.setConfig({ testTimeout: 60_000 })

const leather: Material = {
  ramp: 24,
  base: 2,
  gloss: 0.93,
  paint: ['#945d4f', '#784c49', '#583126', '#372423'],
}

/** The base woman in a tee, jeans and boots with `shoes` as given. */
function booted(shoes: Record<string, unknown>): CharacterDef {
  const base = (BASE[1] as { def: CharacterDef }).def
  return {
    ...base,
    swatches: { ...base.swatches, leather },
    default: 'test',
    outfits: {
      test: [
        { tee: 'ribCream', sleeves: 'short' },
        { jeans: 'denim' },
        { shoes: 'leather', sole: 'soleBlack', boots: true, ...shoes },
      ],
    },
  } as unknown as CharacterDef
}

/** The rows the boot's leather covers in the front view at density 2, in the lowest third of the figure. */
function leatherRows(def: CharacterDef): number {
  const cell = paintedCell(def, 0, 2)
  const all = rowWidths(cell)
  const first = all.findIndex((w) => w > 0)
  const last = all.length - 1 - [...all].reverse().findIndex((w) => w > 0)
  const from = last - Math.round((last - first) * 0.33)
  return rowWidths(cell, { def, swatch: 'leather' }).filter((w, y) => y >= from && w > 0).length
}

describe('a boot’s shaft length', () => {
  it('is 0.42 of the shin by default: naming it draws the same boot', () => {
    expect(paintedCell(booted({ shaft: 0.42 }), 0, 2).painted).toEqual(paintedCell(booted({}), 0, 2).painted)
  })

  it('can be shorter: an ankle boot covers fewer rows than the default shaft', () => {
    expect(leatherRows(booted({ shaft: 0.2 }))).toBeLessThan(leatherRows(booted({})) - 3)
  })
})
