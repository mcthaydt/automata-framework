import { describe, expect, it } from 'vitest'
import { glyphFamily } from '#src/input/gamepad/glyph-family.ts'

// Which labels a pad's buttons carry, sniffed from its `id` (M4 spec §4.2), from FloorFifty `ui/glyphs.ts` at
// `ac72660` and `tests/client/ui/glyphs.test.ts`.
describe('glyphFamily', () => {
  it('knows Xbox and PlayStation pads by id, and calls the rest generic', () => {
    expect(glyphFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')).toBe('xbox')
    expect(glyphFamily('xinput')).toBe('xbox')
    expect(glyphFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe(
      'playstation',
    )
    expect(glyphFamily('054c-09cc-Wireless Controller')).toBe('playstation')
    expect(glyphFamily('8BitDo Pro 2 (STANDARD GAMEPAD Vendor: 2dc8)')).toBe('generic')
  })
})
