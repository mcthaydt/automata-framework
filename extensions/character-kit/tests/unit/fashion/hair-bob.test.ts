// A bob with a fringe and volume at the ear, built from the builder's own pieces (a scalp shell, a fall), against the helmet bob it
// replaces on a character whose bob has body: the same head in the same cloth, the hair counted from the picture at the size a game
// plays a figure (density 1, 4 views) and measured at density 2 from the front (its widest row, how low the fringe comes).
import { describe, expect, it, vi } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { BASE, type CharacterDef, HAIR_STYLES, type Material, SWATCHES } from '#src/shared/figures/door.ts'
import { type PaintedCell, paintedCell, rowWidths, texelsOfSwatch } from '#src/testing/painted-cell.ts'

registerFashion()
vi.setConfig({ testTimeout: 60_000 })

/** A hair swatch of four colours the painter's DUEL palette holds (the old the figure's auburn), so its texels are its own. */
const auburn: Material = {
  ramp: 2,
  base: 2,
  gloss: 0.94,
  strands: true,
  paint: ['#885041', '#662b29', '#49251c', '#372423'],
}

/** A fair skin (the old the figure's), four DUEL colours that the auburn hair does not share, so the face's rows read apart from the hair's. */
const fair: Material = {
  ramp: 27,
  base: 5,
  lift: 0,
  paint: ['#ebbd9d', '#d5a39a', '#c17e7a', '#945d4f'],
  tones: [0.05, -0.55, -0.9],
}

/** The base woman, fair, in a tee and jeans with `style` in auburn. */
function bob(style: string): CharacterDef {
  const base = (BASE[1] as { def: CharacterDef }).def
  return {
    ...base,
    skin: 'fair',
    swatches: { ...base.swatches, auburn, fair },
    default: 'test',
    outfits: {
      test: [
        { tee: 'ribCream', sleeves: 'short' },
        { jeans: 'denim' },
        { eyes: 'eyeBrown' },
        { hair: 'auburn', style },
      ],
    },
  }
}

/** A cell with only the head's rows: a fifth of the cell's height from the figure's first opaque row (the DUEL palette shares its colours across
 *  cloths, so a hair colour is also found on a shoe or a hand; the head's rows are hair and skin). */
function headOf(def: CharacterDef, view: number, density: 1 | 2): PaintedCell {
  const cell = paintedCell(def, view, density)
  const [w, h] = cell.size
  const first = rowWidths(cell).findIndex((width) => width > 0)
  // The head and the fall of a chin-length bob: a fifth of the cell's height from the first opaque row.
  const keep = Math.round(h * 0.2)
  const painted = new Uint8ClampedArray(cell.painted)
  for (let y = first + keep; y < h; y++) painted.fill(0, y * w * 4, (y + 1) * w * 4)
  return { painted, size: cell.size }
}

/** The hair's texels in the head's rows over the front, a quarter turn, the back and the other quarter turn, at the play size. */
const playTexels = (def: CharacterDef): number =>
  [0, 2, 4, 6].reduce((sum, view) => sum + texelsOfSwatch(def, headOf(def, view, 1), 'auburn'), 0)

/** The hair at density 2 from the front: its widest row, and the first row of the face's skin over its middle (a fringe pushes it down). */
function front(def: CharacterDef) {
  const cell = headOf(def, 0, 2)
  const widest = Math.max(...rowWidths(cell, { def, swatch: 'auburn' }))
  const [w] = cell.size
  const skin = (def.swatches?.[def.skin]?.paint ?? SWATCHES[def.skin]?.paint ?? []).map((hex) =>
    [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)),
  )
  let forehead = -1
  for (let y = 0; y < cell.size[1] && forehead < 0; y++)
    for (let x = w / 2 - 3; x <= w / 2 + 3; x++) {
      const i = y * w + x
      if (
        skin.some(
          ([r, g, b]) =>
            r === cell.painted[i * 4] && g === cell.painted[i * 4 + 1] && b === cell.painted[i * 4 + 2],
        )
      )
        forehead = y
    }
  return { widest, forehead }
}

describe('a bob with a fringe', () => {
  const helmet = bob('smoothBob')

  for (const style of ['bobFringeEar', 'bobFringeFull', 'bobFringeShort']) {
    it(`${style} is a style of the painted wardrobe`, () => {
      expect(HAIR_STYLES[style]).toBeDefined()
    })
  }

  it('has more hair at the play size than the helmet bob (the old bob had twice the helmet’s texels)', () => {
    expect(playTexels(bob('bobFringeEar'))).toBeGreaterThan(playTexels(helmet) * 1.25)
  })

  it('has volume at the ear: its widest row is wider than the helmet’s', () => {
    expect(front(bob('bobFringeEar')).widest).toBeGreaterThanOrEqual(front(helmet).widest + 2)
  })

  it('has a fringe: the face’s skin starts lower, under the hair over the brow', () => {
    expect(front(bob('bobFringeEar')).forehead).toBeGreaterThanOrEqual(front(helmet).forehead + 2)
  })

  it('has a fuller version, with more hair than the plain one', () => {
    expect(playTexels(bob('bobFringeFull'))).toBeGreaterThan(playTexels(bob('bobFringeEar')))
  })
})

/** From the back at density 2, how many rows below the figure's top the last row of hair is (the fall's hem), looking at the first quarter of the cell's height, where a head's hair is. */
function backHem(def: CharacterDef): number {
  const cell = paintedCell(def, 4, 2)
  const first = rowWidths(cell).findIndex((width) => width > 0)
  const hair = rowWidths(cell, { def, swatch: 'auburn' }).slice(first, first + Math.round(cell.size[1] / 4))
  return hair.length - 1 - [...hair].reverse().findIndex((width) => width > 0)
}

describe('a bob with a blunt hem at the nape', () => {
  const full = bob('bobFringeFull')

  it('is a style of the painted wardrobe', () => {
    expect(HAIR_STYLES.bobFringeBlunt).toBeDefined()
  })

  it('ends higher on the back than the fuller bob, whose fall hangs below the nape in a tail', () => {
    expect(backHem(bob('bobFringeBlunt'))).toBeLessThanOrEqual(backHem(full) - 6)
  })

  it('keeps the bob’s mass at the ear: its widest row at density 2 is the fuller bob’s, give or take a texel', () => {
    expect(front(bob('bobFringeBlunt')).widest).toBeGreaterThanOrEqual(front(full).widest - 1)
  })
})

describe('hair that hangs over the face', () => {
  /** The skin the face shows from the front at the play size, in the head's rows. */
  const face = (def: CharacterDef): number => texelsOfSwatch(def, headOf(def, 0, 1), 'fair')

  it('is a style of the painted wardrobe', () => {
    expect(HAIR_STYLES.fallCurtain).toBeDefined()
  })

  it('hides the face: far less skin shows from the front than under the long fall that hangs behind', () => {
    expect(face(bob('fallCurtain'))).toBeLessThanOrEqual(face(bob('fallLong')) * 0.6)
  })

  it('is hair, not a hole: it has more hair from the front than the long fall', () => {
    const hair = (def: CharacterDef) => texelsOfSwatch(def, headOf(def, 0, 1), 'auburn')
    expect(hair(bob('fallCurtain'))).toBeGreaterThan(hair(bob('fallLong')))
  })
})

describe('hair that hangs loose down the back', () => {
  /** The hair's width at its widest in the rows below the head (a head is about 28 rows at density 2 from the figure's top), from `view`. */
  function below(style: string, view: number): number {
    const def = bob(style)
    const cell = paintedCell(def, view, 2)
    const first = rowWidths(cell).findIndex((width) => width > 0)
    return Math.max(...rowWidths(cell, { def, swatch: 'auburn' }).slice(first + 30, first + 46))
  }

  it('is a style of the painted wardrobe', () => {
    expect(HAIR_STYLES.curtainLoose).toBeDefined()
  })

  it('covers the back below the head, not a tied tail: its widest row there is twice the curtain’s tail', () => {
    expect(below('curtainLoose', 4)).toBeGreaterThanOrEqual(Math.max(18, below('fallCurtain', 4) * 2))
  })

  it('shows beside the neck from the front: there is hair below the head where the curtain’s tail was behind', () => {
    expect(below('curtainLoose', 0)).toBeGreaterThanOrEqual(Math.max(12, below('fallCurtain', 0) * 2))
  })

  it('still hides the face', () => {
    const face = (def: CharacterDef): number => texelsOfSwatch(def, headOf(def, 0, 1), 'fair')
    expect(face(bob('curtainLoose'))).toBeLessThanOrEqual(face(bob('fallLong')) * 0.6)
  })
})

describe('a bob with the forehead clear', () => {
  const full = bob('bobFringeFull')
  const open = bob('bobOpen')
  /** The face's skin from the front at density 2, in the head's rows. */
  const face = (def: CharacterDef): number => texelsOfSwatch(def, headOf(def, 0, 2), 'fair')

  it('is a style of the painted wardrobe', () => {
    expect(HAIR_STYLES.bobOpen).toBeDefined()
  })

  it('shows the forehead: the face’s skin starts at least two rows higher than under the fuller bob’s fringe', () => {
    expect(front(open).forehead).toBeLessThanOrEqual(front(full).forehead - 2)
  })

  it('shows more face: more skin from the front than the fuller bob, whose sides cover the cheeks', () => {
    expect(face(open)).toBeGreaterThan(face(full) + 10)
  })

  it('is still a bob: its hair reaches the jaw (more hair at the play size than the helmet bob)', () => {
    expect(playTexels(open)).toBeGreaterThan(playTexels(bob('smoothBob')))
  })
})
