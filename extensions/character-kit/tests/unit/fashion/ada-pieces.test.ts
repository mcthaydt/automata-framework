// The pieces of a figure's clothes the generated images of Ada show and the kit's runway kinds did not draw, each an option of an
// existing kind that draws nothing different until it is named: a waistcoat's button row, jeans' outer seam, waistband and a cropped,
// turned-up hem, and a boot's heel block and toe cap. Counted in texels of a cloth no other part of the figure is, at density 8, where
// a head is about 95 texels and the pieces can be seen.
import { describe, expect, it, vi } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { BASE, type CharacterDef, type Material } from '#src/shared/figures/door.ts'
import { type PaintedCell, paintedCell, rowWidths, texelsOfSwatch } from '#src/testing/painted-cell.ts'

registerFashion()
vi.setConfig({ testTimeout: 180_000 })

const D8 = 8 as unknown as 1
const cloth = (ramp: number, base: number, paint: string[]): Material => ({ ramp, base, paint })
const SWATCHES: Record<string, Material> = {
  linen: cloth(1, 4, ['#fff3d6', '#eadbc9', '#ccc3b1', '#bbafa4']),
  vest: { ramp: 19, base: 1, lift: 0, paint: ['#904647', '#6e2434', '#492129', '#2e1026'] },
  brass: { ramp: 15, base: 5, flat: true, paint: ['#cca96e', '#b29062', '#997951', '#997951'] },
  denim: cloth(7, 1, ['#366b8a', '#25466b', '#23324d', '#181f2f']),
  seamCloth: cloth(20, 4, ['#b4aa33', '#969a26', '#7c831e', '#617308']),
  bandCloth: cloth(14, 4, ['#00bfa3', '#00a087', '#008279', '#006b6d']),
  turnCloth: cloth(9, 4, ['#ff7676', '#e45c5f', '#b63c35', '#82211d']),
  leather: cloth(24, 2, ['#945d4f', '#784c49', '#583126', '#372423']),
  toeCloth: cloth(5, 4, ['#c7d6ff', '#96b2d9', '#8690b2', '#7a7799']),
}

/** The base woman in a shirt, a waistcoat, jeans and boots, each with the options given. */
function dressed(parts: {
  vest?: Record<string, unknown>
  jeans?: Record<string, unknown>
  shoes?: Record<string, unknown>
}): CharacterDef {
  const base = (BASE[1] as { def: CharacterDef }).def
  return {
    ...base,
    swatches: { ...base.swatches, ...SWATCHES },
    default: 'test',
    outfits: {
      test: [
        { shirt: 'linen', sleeves: 'rolled' },
        {
          waistcoat: 'vest',
          fit: 1,
          length: 0.05,
          armhole: 1,
          open: 1,
          chest: 0.3,
          hem: 0.25,
          ...parts.vest,
        },
        { jeans: 'denim', taper: 1, ...parts.jeans },
        { shoes: 'leather', sole: 'soleBlack', boots: true, shaft: 0.2, ...parts.shoes },
      ],
    },
  } as unknown as CharacterDef
}
const count = (def: CharacterDef, swatch: string, direction = 0): number =>
  texelsOfSwatch(def, paintedCell(def, direction, D8), swatch)
const rows = (def: CharacterDef, swatch: string, direction = 0): number =>
  rowWidths(paintedCell(def, direction, D8) as PaintedCell, { def, swatch }).filter((w) => w > 0).length

describe('a waistcoat’s buttons', () => {
  it('are a row of brass on the front when asked for, and nothing without', () => {
    expect(count(dressed({}), 'brass')).toBe(0)
    expect(count(dressed({ vest: { buttons: 'brass' } }), 'brass')).toBeGreaterThan(12)
  })
})

describe('jeans', () => {
  it('have an outer seam in a cloth of its own, seen from the side, and none unless asked for', () => {
    expect(count(dressed({}), 'seamCloth', 2)).toBe(0)
    expect(count(dressed({ jeans: { seam: 'seamCloth' } }), 'seamCloth', 2)).toBeGreaterThan(80)
  })

  it('have a waistband, a belt’s width of its own cloth round the waist', () => {
    expect(count(dressed({}), 'bandCloth')).toBe(0)
    expect(count(dressed({ jeans: { waistband: 'bandCloth' } }), 'bandCloth')).toBeGreaterThan(100)
  })

  it('can be cropped above the boot’s top (a shaft of 0.2 of the shin), and turned up there in a cuff of their own cloth', () => {
    const plain = dressed({})
    const cropped = dressed({ jeans: { crop: 0.35 } })
    expect(rows(cropped, 'denim')).toBeLessThan(rows(plain, 'denim') - 8)
    expect(count(dressed({ jeans: { crop: 0.35, turn: 'turnCloth' } }), 'turnCloth')).toBeGreaterThan(40)
    // At the ankle the boot's shaft is over the turn-up: a turn-up wants a crop above the boot to show.
    expect(count(dressed({ jeans: { turn: 'turnCloth' } }), 'turnCloth')).toBeLessThan(40)
  })
})

describe('an ankle boot', () => {
  it('has a toe cap in a cloth of its own, and none unless asked for', () => {
    expect(count(dressed({}), 'toeCloth', 2)).toBe(0)
    expect(count(dressed({ shoes: { toe: 'toeCloth' } }), 'toeCloth', 2)).toBeGreaterThan(30)
  })

  it('has a heel block: a heel changes the leather seen from the side', () => {
    const flat = paintedCell(dressed({}), 2, D8).painted
    const heeled = paintedCell(dressed({ shoes: { heel: 1 } }), 2, D8).painted
    let differing = 0
    for (let i = 0; i < flat.length; i += 4)
      if (flat[i] !== heeled[i] || flat[i + 1] !== heeled[i + 1] || flat[i + 2] !== heeled[i + 2]) differing++
    expect(differing).toBeGreaterThan(150)
  })
})
