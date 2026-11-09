import { describe, expect, it } from 'vitest'
import { swatchSchema } from '#src/features/figures/content/swatch.schema.ts'

describe('a swatch names a DUEL ramp and step', () => {
  it('reads a ramp and a step, and the material fields a mesh uses', () => {
    expect(swatchSchema.parse({ ramp: 'skin', step: 5 })).toEqual({ ramp: 'skin', step: 5 })
    expect(
      swatchSchema.parse({ ramp: 'grey', step: 2, gloss: 0.9, flat: true, kind: 'metal', role: 'hardware' }),
    ).toMatchObject({ kind: 'metal' })
  })
  it('refuses a step past the ramp, with the range in the message', () => {
    for (const step of [8, -1, 1.5]) {
      const result = swatchSchema.safeParse({ ramp: 'skin', step })
      expect(result.success, `step ${step}`).toBe(false)
      expect(result.error?.issues[0]?.message).toBe('step is 0 to 7')
      expect(result.error?.issues[0]?.path).toEqual(['step'])
    }
  })
  it('refuses a ramp that DUEL does not have, and the old bare palette index', () => {
    expect(swatchSchema.safeParse({ ramp: 'purple', step: 1 }).success).toBe(false)
    expect(swatchSchema.safeParse({ colour: 22 }).success).toBe(false)
    expect(swatchSchema.safeParse({ ramp: 'skin' }).success).toBe(false)
  })
  it("refuses a painter's fields", () => {
    expect(swatchSchema.safeParse({ ramp: 'skin', step: 3, paint: ['#ffffff'] }).success).toBe(false)
  })
})
