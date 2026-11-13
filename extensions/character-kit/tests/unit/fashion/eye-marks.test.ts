// The eyes of a face that is not drawn (the decal face the play size uses): the builder's own is one texel, two apart, which is a
// pair of dots; the kit's `eyeMarks` sets their size and how wide apart they sit, from the head's own width, so a game sets the old
// figures' eyes (two texels tall, four apart) as data. Read from the picture: the texels of the eyes' own colour, by eye.
import { describe, expect, it, vi } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { BASE, type CharacterDef, type Material } from '#src/shared/figures/door.ts'
import { paintedCell } from '#src/testing/painted-cell.ts'

vi.setConfig({ testTimeout: 60_000 })
registerFashion()

// Each of the swatch's four colours is one the painter's DUEL palette holds, so the eyes' texels are countable.
const IRIS = ['#e8cb82', '#cca96e', '#b29062', '#7e6144']
const EYE: Material = { ramp: 10, base: 0, flat: true, paint: IRIS } as Material
const WOMAN = (BASE[1] as { def: CharacterDef }).def

/** The base woman with her eyes replaced by `eyes` (a garment) and a bald, plain head, with the decal face. */
function wearing(eyes: object): CharacterDef {
  const outfit = (WOMAN.outfits[WOMAN.default] ?? []).filter(
    (g) => !('hair' in g) && !('eyes' in g) && !('lips' in g),
  )
  return {
    ...WOMAN,
    face: { ...WOMAN.face, drawn: false },
    swatches: { ...WOMAN.swatches, eye: EYE },
    outfits: { [WOMAN.default]: [...outfit, eyes as never] },
  }
}

/** The eyes in the front view at play size: the texels painted in the eye swatch, split into the left and right half, as boxes. */
function eyesOf(def: CharacterDef) {
  const cell = paintedCell(def, 0, 1)
  const [w, h] = cell.size
  const want = IRIS.map((hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)))
  const hits: [number, number][] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (cell.painted[i + 3] === 0) continue
      if (
        want.some(
          ([r, g, b]) => r === cell.painted[i] && g === cell.painted[i + 1] && b === cell.painted[i + 2],
        )
      )
        hits.push([x, y])
    }
  const xs = hits.map(([x]) => x).sort((a, b) => a - b)
  const middle = ((xs[0] ?? 0) + (xs[xs.length - 1] ?? 0)) / 2
  const box = (side: [number, number][]) => ({
    x: side.map(([x]) => x),
    rows: new Set(side.map(([, y]) => y)).size,
  })
  return {
    left: box(hits.filter(([x]) => x < middle)),
    right: box(hits.filter(([x]) => x >= middle)),
  }
}

describe('eyeMarks', () => {
  it('draws each eye two texels tall at the size the old figures drew them', () => {
    const { left, right } = eyesOf(wearing({ eyeMarks: 'eye' }))
    expect(left.rows).toBe(2)
    expect(right.rows).toBe(2)
  })

  it('sets the eyes four texels apart or more, as the old figures’ are, and further with `spread`', () => {
    const gap = (spread?: number) => {
      const { left, right } = eyesOf(
        wearing({ eyeMarks: 'eye', ...(spread === undefined ? {} : { spread }) }),
      )
      return Math.min(...right.x) - Math.max(...left.x)
    }
    expect(gap()).toBeGreaterThanOrEqual(4)
    expect(gap(0.9)).toBeGreaterThan(gap(0.4))
  })

  it('draws one texel each when asked for `size` 1 by 1', () => {
    const { left } = eyesOf(wearing({ eyeMarks: 'eye', size: [1, 1] }))
    expect(left.rows).toBe(1)
  })
})
