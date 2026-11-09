import { describe, expect, it } from 'vitest'
import {
  type Made,
  painterMaterials,
  resolveMaterials,
  variant,
} from '#src/features/figures/figure/materials.ts'

describe('swatch variants', () => {
  it('registers a name once and returns it again for the same change', () => {
    const made: Made = {}
    expect(variant(made, 'navy', 'seam', { flat: true, shade: 1 })).toBe('navy@seam')
    expect(variant(made, 'navy', 'seam', { flat: true, shade: 1 })).toBe('navy@seam')
    expect(made['navy@seam']).toEqual({ of: 'navy', flat: true, shade: 1 })
  })
  it('refuses one name for two different changes, instead of the first silently winning', () => {
    const made: Made = {}
    variant(made, 'navy', 'seam', { flat: true, shade: 1 })
    expect(() => variant(made, 'navy', 'seam', { flat: true, shade: -1 })).toThrow(/navy@seam/)
  })
  it("a cap's seam and a jacket's seam on one swatch are two materials", () => {
    const made: Made = {}
    // The cap's (hair/cap.ts) and the wardrobe's jacket and bomber role names.
    const cap = variant(made, 'navy', 'cap-seam', { flat: true, shade: -1 })
    const jacket = variant(made, 'navy', 'seam', { flat: true, shade: 1 })
    const resolved = resolveMaterials([cap, jacket], made, { navy: { ramp: 'slate', step: 4 } })
    expect(resolved[cap]).toEqual({ colour: 84, flat: true, shade: -1 })
    expect(resolved[jacket]).toEqual({ colour: 84, flat: true, shade: 1 })
  })
})

describe("the painter reads a figure's materials", () => {
  const built = (materials: ReturnType<typeof resolveMaterials>) => ({ materials })

  it('a swatch with no painter field paints from its DUEL row', () => {
    const resolved = resolveMaterials(['navy'], {}, { navy: { ramp: 'slate', step: 4 } })
    expect(painterMaterials(built(resolved))).toEqual([{ ramp: 10, base: 4 }])
  })
  it('a variant moves the base along the row, and keeps gloss and flat', () => {
    const made: Made = {}
    const lined = variant(made, 'navy', 'lining', { shade: -1, flat: true })
    const resolved = resolveMaterials(['navy', lined], made, { navy: { ramp: 'slate', step: 4, gloss: 0.5 } })
    expect(painterMaterials(built(resolved))).toEqual([
      { ramp: 10, base: 4, gloss: 0.5 },
      { ramp: 10, base: 3, gloss: 0.5, flat: true },
    ])
  })
  it('the painter fields reach the material, in the order of the built materials', () => {
    const skin = {
      ramp: 'skin',
      step: 4,
      lift: 1,
      paint: ['#c7826c', '#ad6e51', '#885041', '#733d3b'],
      tones: [0.55, 0.04, -0.5],
      streaks: 0.3,
      holo: 'mirror',
      see: true,
      fabric: 'weave',
    } as const
    const resolved = resolveMaterials(['b', 'a'], {}, { a: { ramp: 'grey', step: 1 }, b: skin })
    expect(Object.keys(resolved)).toEqual(['a', 'b'])
    const [a, b] = painterMaterials(built(resolved))
    expect(a).toEqual({ ramp: 0, base: 1 })
    expect(b).toEqual({
      ramp: 2,
      base: 4,
      lift: 1,
      paint: skin.paint,
      tones: skin.tones,
      streaks: 0.3,
      holo: 'mirror',
      see: true,
      fabric: 'weave',
    })
  })
})
