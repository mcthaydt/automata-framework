/**
 * The height tiers.
 *
 * The form factor says what shape a screen is; the tier says how much height it has to spend.
 * Two screens of the same form factor can need different answers: a 1280 x 720 desktop and a
 * 900 x 600 window are both desktop, and only one can afford a hero above the menu.
 *
 * Written to `<html data-height>` by the geometry owner. Tokens tighten under it, so every
 * primitive tightens at once. Targets never shrink with the tier; gutters and decoration do.
 */

export type HeightTier = 'short' | 'compact' | undefined

/** At or below this many CSS px of layout height, a screen is short. */
export const SHORT_MAX_HEIGHT = 600

/**
 * Below this, compact: what a browser leaves a sideways phone (780 x 270 Chrome on a Galaxy,
 * 667 x 320 Safari on an SE). 844 x 340, Safari on an iPhone 14, sits exactly on it and stays short.
 */
export const COMPACT_MAX_HEIGHT = 340

/**
 * The height tier of a layout height in CSS px: `compact` below 340, `short` up to 600, otherwise
 * `undefined`.
 */
export function classifyHeightTier(height: number): HeightTier {
  if (height < COMPACT_MAX_HEIGHT) return 'compact'
  if (height <= SHORT_MAX_HEIGHT) return 'short'
  return undefined
}
