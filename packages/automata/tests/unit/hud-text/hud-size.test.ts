import { describe, expect, it } from 'vitest'
import {
  HUD_TEXT_FLOOR,
  hudFontSize,
  shadowOffset,
  WORD_TEXT_FLOOR,
} from '#src/features/hud-text/hud-size.ts'

describe('hudFontSize', () => {
  it('raises a small size to the floor on a phone held upright', () => {
    // 10 logical px at 0.77 CSS px each is 7.7 CSS px; Feel's floor is 14.
    expect(hudFontSize(10, 14, { cssPerLogical: 0.77, devicePerCss: 3, hostScale: 1 })).toBeCloseTo(18.18, 2)
  })

  it('keeps the size when it already clears the floor', () => {
    expect(hudFontSize(10, 14, { cssPerLogical: 3.06, devicePerCss: 2, hostScale: 1 })).toBe(10)
  })

  it('grows the floor with the host scale hint (a TV)', () => {
    expect(hudFontSize(10, 14, { cssPerLogical: 1.69, devicePerCss: 1, hostScale: 1.333 })).toBeCloseTo(
      11.04,
      2,
    )
  })

  it('names the two floors', () => {
    expect(HUD_TEXT_FLOOR).toBe(12)
    expect(WORD_TEXT_FLOOR).toBe(14)
  })
})

describe('shadowOffset', () => {
  it('is 1.5 CSS px, in logical px', () => {
    expect(shadowOffset({ cssPerLogical: 1.5, devicePerCss: 2, hostScale: 1 })).toBe(1)
    expect(shadowOffset({ cssPerLogical: 0.75, devicePerCss: 2, hostScale: 1 })).toBe(2)
  })
})
