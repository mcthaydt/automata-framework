// How bright a figure shows once the room lights it: the mean luma of the lit cell's opaque texels, which exposure holds against the floor.
import { describe, expect, it } from 'vitest'
import { shownLuma } from '#src/features/painted/lit-cells.ts'

const cell = (...texels: readonly (readonly [number, number, number, number])[]) => ({
  rgba: Uint8ClampedArray.from(texels.flat()),
})

describe('shownLuma', () => {
  it('is the mean of the opaque texels’ luma, 0 to 1: a white texel and a black one are half', () => {
    expect(shownLuma(cell([255, 255, 255, 255], [0, 0, 0, 255]))).toBeCloseTo(0.5, 6)
  })

  it('leaves out the empty texels, which carry no colour', () => {
    expect(shownLuma(cell([255, 255, 255, 255], [90, 90, 90, 0], [0, 0, 0, 0]))).toBeCloseTo(1, 6)
  })

  it('weighs the channels as the screen does: green counts most', () => {
    const [red, green] = [shownLuma(cell([255, 0, 0, 255])), shownLuma(cell([0, 255, 0, 255]))]
    expect(green as number).toBeGreaterThan((red as number) * 3)
  })

  it('is undefined for a cell with nothing opaque in it', () => {
    expect(shownLuma(cell([0, 0, 0, 0]))).toBeUndefined()
  })
})
