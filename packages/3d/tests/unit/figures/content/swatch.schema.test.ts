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
  it("reads the painter's fields, and a swatch with none is unchanged", () => {
    const painter = {
      ramp: 'skin',
      step: 4,
      lift: 1,
      paint: ['#c7826c', '#ad6e51', '#885041', '#733d3b'],
      tones: [0.55, 0.04, -0.5],
      strands: true,
      sheen: true,
      streaks: 0.4,
      mix: {
        from: ['#ffffff', '#cccccc', '#999999', '#666666'],
        to: ['#eeeeee', '#bbbbbb', '#888888', '#555555'],
        at: 0.5,
      },
      stain: { paint: ['#111111', '#222222', '#333333', '#444444'], hem: 0.1, below: 0.6 },
      holo: 'mirror',
      see: true,
      fabric: 'weave',
    }
    expect(swatchSchema.parse(painter)).toEqual(painter)
    expect(swatchSchema.parse({ ...painter, holo: true }).holo).toBe(true)
    expect(swatchSchema.parse({ ramp: 'skin', step: 3 })).toEqual({ ramp: 'skin', step: 3 })
  })
  it('a bad paint ramp names the field', () => {
    for (const paint of [
      ['#ffffff', '#cccccc', '#999999'],
      ['#ffffff', '#cccccc', '#999999', 'red'],
    ]) {
      const result = swatchSchema.safeParse({ ramp: 'skin', step: 3, paint })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path[0]).toBe('paint')
    }
  })
  it('still refuses a field the painter does not have', () => {
    expect(swatchSchema.safeParse({ ramp: 'skin', step: 3, grain: 2 }).success).toBe(false)
  })
})
