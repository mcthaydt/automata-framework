import { describe, expect, it } from 'vitest'
import { canvasResolutionFor, MAX_RESOLUTION, RESOLUTION_CAPS } from './canvas-resolution.js'

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

describe('canvasResolutionFor at a quality tier (M4 spec §4.11)', () => {
  it('caps low at 1, medium at 1.5 and high at 2', () => {
    expect(RESOLUTION_CAPS).toEqual({ low: 1, medium: 1.5, high: MAX_RESOLUTION })
    expect(canvasResolutionFor('phone-portrait', 3, 'low')).toBe(1)
    expect(canvasResolutionFor('phone-portrait', 3, 'medium')).toBe(1.5)
    expect(canvasResolutionFor('phone-portrait', 3, 'high')).toBe(2)
    expect(canvasResolutionFor('desktop', 1, 'medium')).toBe(1)
  })

  it('keeps a tablet held upright at 1 at every tier', () => {
    for (const tier of ['low', 'medium', 'high'] as const)
      expect(canvasResolutionFor('tablet-portrait', 3, tier)).toBe(1)
  })
})
