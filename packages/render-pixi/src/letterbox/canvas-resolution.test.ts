import { describe, expect, it } from 'vitest'
import { canvasResolutionFor, MAX_RESOLUTION } from './canvas-resolution.js'

describe('canvasResolutionFor', () => {
  it("keeps the device's density, capped at 2, on phones and desktop", () => {
    expect(canvasResolutionFor('phone-portrait', 3)).toBe(MAX_RESOLUTION)
    expect(canvasResolutionFor('phone-landscape', 2.625)).toBe(MAX_RESOLUTION)
    expect(canvasResolutionFor('desktop', 2)).toBe(2)
    expect(canvasResolutionFor('desktop', 1)).toBe(1)
    expect(canvasResolutionFor('desktop', 0)).toBe(1)
  })

  it('draws a tablet held upright at one device pixel per CSS pixel', () => {
    expect(canvasResolutionFor('tablet-portrait', 2)).toBe(1)
    expect(canvasResolutionFor('tablet-portrait', 1)).toBe(1)
  })
})
