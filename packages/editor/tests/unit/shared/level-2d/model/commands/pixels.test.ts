import { describe, expect, it } from 'vitest'
import { wholePixels } from '#src/shared/level-2d/model/commands/pixels.ts'

describe('wholePixels', () => {
  it('rounds to the nearest pixel', () => {
    expect(wholePixels(10.4)).toBe(10)
    expect(wholePixels(10.6)).toBe(11)
  })

  it('never returns a negative zero', () => {
    expect(Object.is(wholePixels(-0.4), 0)).toBe(true)
    expect(Object.is(wholePixels(-0), 0)).toBe(true)
  })
})
