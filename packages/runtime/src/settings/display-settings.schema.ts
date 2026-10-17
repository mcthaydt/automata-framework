import { z } from 'zod'

/**
 * Graphics quality (M4 spec §4.11). A lower tier caps the canvas resolution and leaves out the post-filter owners
 * registered for a higher one; it never drops the art direction. The one owner of the tier: render-pixi and the
 * Settings screen's Display section read it from here.
 */
export const QUALITY_TIERS = ['high', 'medium', 'low'] as const
export type QualityTier = (typeof QUALITY_TIERS)[number]

/** `high` until PRODUCT.7 has measured the phone profiles (M4-D6); no device auto-detection. */
export const DEFAULT_QUALITY: QualityTier = 'high'

/** A tier; an unknown saved value reads as the default, as every settings field falls back. */
export const qualityTierSchema: z.ZodType<QualityTier, unknown> = z.enum(QUALITY_TIERS).catch(DEFAULT_QUALITY)

/** The core display settings a game's settings carry as `display`: `{ display: displaySettingsSchema }`. */
export interface DisplaySettings {
  readonly quality: QualityTier
}
export const displaySettingsSchema: z.ZodType<DisplaySettings, { quality?: unknown }> = z.object({
  quality: qualityTierSchema.default(DEFAULT_QUALITY),
})
