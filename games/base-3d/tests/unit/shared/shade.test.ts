import { describe, expect, it } from 'vitest'
import { shadeColour } from '#src/shared/shade.ts'

describe('shadeColour', () => {
  it('leaves a colour alone at 1 and scales each channel otherwise', () => {
    expect(shadeColour(0xcdd2da, 1)).toBe(0xcdd2da)
    expect(shadeColour(0x804020, 0.5)).toBe(0x402010)
    expect(shadeColour(0xffffff, 0)).toBe(0)
  })
})
