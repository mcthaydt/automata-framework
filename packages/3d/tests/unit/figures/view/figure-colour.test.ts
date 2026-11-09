import { DEFAULT_PALETTE } from '@automata/content'
import { describe, expect, it } from 'vitest'
import { materialColour } from '#src/features/figures/view/figure-colour.ts'

const palette = DEFAULT_PALETTE.colors

describe('materialColour', () => {
  it("draws a material in its palette colour (a palette's second colour)", () => {
    expect(materialColour({ colour: 1 }, palette)).toBe(0x222323)
  })

  it('steps a shade lighter or darker, capped at full channel', () => {
    const base = materialColour({ colour: 6 }, palette) // #cdd2da
    expect(base).toBe(0xcdd2da)
    expect(materialColour({ colour: 6, shade: 1 }, palette)).toBeGreaterThan(base)
    expect(materialColour({ colour: 6, shade: -1 }, palette)).toBeLessThan(base)
    expect(materialColour({ colour: 7, shade: 1 }, palette)).toBe(0xffffff)
  })

  it('refuses a colour the palette does not have', () => {
    expect(() => materialColour({ colour: 256 }, palette)).toThrow(/palette colour 256/)
  })
})
