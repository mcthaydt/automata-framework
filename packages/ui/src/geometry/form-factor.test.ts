import { describe, expect, test } from 'vitest'
import { classifyFormFactor, PHONE_LANDSCAPE_MAX_HEIGHT, PHONE_PORTRAIT_MAX_WIDTH } from './form-factor'

describe('classifyFormFactor (FloorFifty thresholds, M1.6 spec §3.1)', () => {
  test.each([
    [599, 900, 'phone-portrait'],
    [600, 900, 'tablet-portrait'],
    [360, 640, 'phone-portrait'],
    [820, 1180, 'tablet-portrait'],
    [900, 499, 'phone-landscape'],
    [900, 500, 'desktop'],
    [780, 270, 'phone-landscape'],
    [1280, 720, 'desktop'],
    // Square is not taller than wide, so it is landscape.
    [400, 400, 'phone-landscape'],
  ] as const)('%d x %d is %s', (width, height, expected) => {
    expect(classifyFormFactor(width, height)).toBe(expected)
  })

  test('the thresholds are 600 px portrait and 500 px landscape', () => {
    expect(PHONE_PORTRAIT_MAX_WIDTH).toBe(600)
    expect(PHONE_LANDSCAPE_MAX_HEIGHT).toBe(500)
  })
})
