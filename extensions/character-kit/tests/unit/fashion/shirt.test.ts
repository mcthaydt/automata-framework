// A shirt: a collar with two leaves, sleeves long, short or rolled back to the elbow with a cuff fold, worn under a waistcoat so the V
// of the vest shows shirt and collar. The generated images' Ada wears one (ivory linen, a thick turned cuff, an open spread collar);
// the painter's own `top` draws a puffy ruff for a collar and a bandage for a cuff, so the kit has a kind of its own, drawn on the
// body-fitted shells of the runway's garments. Drawn at density 8, a head of about 95 texels, where the construction can be seen.
import { describe, expect, it, vi } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { BASE, type CharacterDef, type Material } from '#src/shared/figures/door.ts'
import { paintedCell, texelsOfSwatch } from '#src/testing/painted-cell.ts'

registerFashion()
vi.setConfig({ testTimeout: 120_000 })

const linen: Material = { ramp: 1, base: 4, paint: ['#fff3d6', '#eadbc9', '#ccc3b1', '#bbafa4'] }
/** Cloth in a colour no other of the figure's is, so its texels can be counted. */
const collarCloth: Material = { ramp: 12, base: 5, paint: ['#ddbf9a', '#c0a588', '#9e8a6e', '#7e6c54'] }
const cuffCloth: Material = { ramp: 25, base: 4, paint: ['#a9d1c1', '#87ae8e', '#71957d', '#5b7b69'] }
const vest: Material = { ramp: 19, base: 1, lift: 0, paint: ['#904647', '#6e2434', '#492129', '#2e1026'] }

/** The base woman in a shirt with `shirt` as given, and `more` worn over it. */
function shirted(shirt: Record<string, unknown>, more: Record<string, unknown>[] = []): CharacterDef {
  const base = (BASE[1] as { def: CharacterDef }).def
  return {
    ...base,
    swatches: { ...base.swatches, linen, collarCloth, cuffCloth, vest },
    default: 'test',
    outfits: { test: [{ shirt: 'linen', ...shirt }, ...more, { jeans: 'denim' }] },
  } as unknown as CharacterDef
}
const skinOf = (def: CharacterDef, cell: ReturnType<typeof paintedCell>) =>
  texelsOfSwatch(def, cell, (def as { skin?: string }).skin ?? 'skinWarm')
const D8 = 8 as unknown as 1

describe('a shirt', () => {
  it('is worn: its cloth is a good part of the figure at density 4', () => {
    const def = shirted({})
    expect(texelsOfSwatch(def, paintedCell(def, 0, 4), 'linen')).toBeGreaterThan(600)
  })

  it('has sleeves that run short of the wrist rolled, and a forearm of bare skin where they are rolled back', () => {
    const [short, rolled, long] = ['short', 'rolled', 'long'].map((sleeves) => {
      const def = shirted({ sleeves })
      const cell = paintedCell(def, 0, 4)
      return { cloth: texelsOfSwatch(def, cell, 'linen'), skin: skinOf(def, cell) }
    }) as [{ cloth: number; skin: number }, { cloth: number; skin: number }, { cloth: number; skin: number }]
    expect(short.cloth).toBeLessThan(rolled.cloth)
    expect(rolled.cloth).toBeLessThan(long.cloth)
    // The rolled sleeve ends at the elbow, a quarter of the upper arm past a short one's end and the whole forearm short of a long one (the
    // sheet at density 4 and 8 shows the end at the elbow; the share is texels of the front view, where the arm is foreshortened).
    const share = (rolled.cloth - short.cloth) / (long.cloth - short.cloth)
    expect(share).toBeGreaterThan(0.08)
    expect(share).toBeLessThan(0.5)
    expect(rolled.skin).toBeGreaterThan(long.skin + 40)
  })

  it('has a collar of two leaves in its own cloth, and none unless it is asked for', () => {
    const plain = shirted({})
    const collared = shirted({ collar: 'collarCloth' })
    expect(texelsOfSwatch(plain, paintedCell(plain, 0, D8), 'collarCloth')).toBe(0)
    const leaves = texelsOfSwatch(collared, paintedCell(collared, 0, D8), 'collarCloth')
    expect(leaves).toBeGreaterThan(60)
    // Both leaves: the collar is as wide as the neck and a leaf either side, so its widest row is wider than a neck of this head.
    const cell = paintedCell(collared, 0, D8)
    const wide = (cell: ReturnType<typeof paintedCell>) => {
      const [w, h] = cell.size
      let most = 0
      for (let y = 0; y < h; y++) {
        let n = 0
        for (let x = 0; x < w; x++)
          if (collarCloth.paint?.some((hex) => same(cell, (y * w + x) * 4, hex))) n++
        most = Math.max(most, n)
      }
      return most
    }
    expect(wide(cell)).toBeGreaterThan(24)
  })

  it('turns the sleeve back in a cuff fold in its own cloth, only when rolled', () => {
    const rolled = shirted({ sleeves: 'rolled', cuff: 'cuffCloth' })
    const long = shirted({ sleeves: 'long', cuff: 'cuffCloth' })
    expect(texelsOfSwatch(rolled, paintedCell(rolled, 0, D8), 'cuffCloth')).toBeGreaterThan(40)
    expect(texelsOfSwatch(long, paintedCell(long, 0, D8), 'cuffCloth')).toBe(0)
  })

  it('shows its cloth in the V of a waistcoat worn open, at density 8', () => {
    const vested = shirted({}, [
      { waistcoat: 'vest', fit: 1, length: 0.05, armhole: 1, open: 1, chest: 0.3, hem: 0.25, neckline: 0.6 },
    ])
    const closed = shirted({}, [{ waistcoat: 'vest', fit: 1, length: 0.05, armhole: 1 }])
    const open = texelsOfSwatch(vested, paintedCell(vested, 0, D8), 'linen')
    const shut = texelsOfSwatch(closed, paintedCell(closed, 0, D8), 'linen')
    expect(open).toBeGreaterThan(shut + 150)
  })
})

/** Whether the texel at byte `o` of the cell is the colour `hex`. */
function same(cell: ReturnType<typeof paintedCell>, o: number, hex: string): boolean {
  const n = Number.parseInt(hex.slice(1), 16)
  return (
    cell.painted[o + 3] !== 0 &&
    cell.painted[o] === ((n >> 16) & 255) &&
    cell.painted[o + 1] === ((n >> 8) & 255) &&
    cell.painted[o + 2] === (n & 255)
  )
}
