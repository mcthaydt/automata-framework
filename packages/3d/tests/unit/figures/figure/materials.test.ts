import { describe, expect, it } from 'vitest'
import { type Made, resolveMaterials, variant } from '#src/features/figures/figure/materials.ts'

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
