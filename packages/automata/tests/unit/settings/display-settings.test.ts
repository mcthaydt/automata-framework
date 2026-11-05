import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUALITY,
  displaySettingsSchema,
  QUALITY_TIERS,
  qualityTierSchema,
} from '#src/features/settings/display-settings.schema.ts'

// The graphics quality setting (M4 spec §4.11, M4-D6): one owner for the tier, `display.quality` in a game's
// settings, `high` until PRODUCT.7 has measured the phone profiles.
describe('display settings', () => {
  it('defaults the quality to high', () => {
    expect(DEFAULT_QUALITY).toBe('high')
    expect(displaySettingsSchema.parse({})).toEqual({ quality: 'high' })
  })

  it('reads an unknown tier as the default, as every settings field falls back', () => {
    expect(displaySettingsSchema.parse({ quality: 'ultra' })).toEqual({ quality: 'high' })
  })

  it('keeps each tier', () => {
    expect(QUALITY_TIERS).toEqual(['high', 'medium', 'low'])
    for (const tier of QUALITY_TIERS) expect(qualityTierSchema.parse(tier)).toBe(tier)
  })
})
