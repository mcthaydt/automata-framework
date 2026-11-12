// How bright a painted figure is before the room lights it: the mean luma of its opaque texels, which exposure holds against the floor.
import { describe, expect, it } from 'vitest'
import { paintedLuma } from '#src/features/painted/painted-view.ts'

const cell = (...texels: readonly (readonly [number, number, number, number])[]) => ({
  painted: Uint8ClampedArray.from(texels.flat()),
})

describe('paintedLuma', () => {
  it('is the mean of the opaque texels’ luma, 0 to 1: a white texel and a black one are half', () => {
    expect(paintedLuma(cell([255, 255, 255, 255], [0, 0, 0, 255]))).toBeCloseTo(0.5, 6)
  })

  it('leaves out the empty texels, which carry no colour', () => {
    expect(paintedLuma(cell([255, 255, 255, 255], [90, 90, 90, 0], [0, 0, 0, 0]))).toBeCloseTo(1, 6)
  })

  it('weighs the channels as the screen does: green counts most', () => {
    const [red, green] = [paintedLuma(cell([255, 0, 0, 255])), paintedLuma(cell([0, 255, 0, 255]))]
    expect(green as number).toBeGreaterThan((red as number) * 3)
  })

  it('is undefined for a cell with nothing opaque in it', () => {
    expect(paintedLuma(cell([0, 0, 0, 0]))).toBeUndefined()
  })
})
