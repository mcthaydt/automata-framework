// The stage contract this kit was written for (`extensions/figures/docs/contract.md`). A breaking bump of the builder's
// contract fails here first, by name, before it moves a pixel.
import { describe, expect, it } from 'vitest'
import { SPRITE_PITCH, STAGE_VERSION, TIE_BIAS } from '#src/shared/figures/door.ts'

describe('the stage contract', () => {
  it('is the contract this kit was written for', () => {
    expect(STAGE_VERSION).toBe(1)
    expect(SPRITE_PITCH).toBeCloseTo((18 * Math.PI) / 180, 12)
    expect(TIE_BIAS).toBe(0.001)
  })
})
