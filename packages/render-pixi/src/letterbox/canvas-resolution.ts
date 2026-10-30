import type { QualityTier } from '@mcthaydt/automata-runtime'
import type { FormFactor } from '@mcthaydt/automata-ui'

/**
 * The highest canvas resolution (device pixels per CSS pixel) the renderer uses, at the `high` quality tier.
 */
export const MAX_RESOLUTION = 2

/** The canvas resolution each quality tier allows at most (M4 spec §4.11). */
export const RESOLUTION_CAPS: Readonly<Record<QualityTier, number>> = {
  low: 1,
  medium: 1.5,
  high: MAX_RESOLUTION,
}

/**
 * Calculates device pixels per CSS pixel for the canvas.
 *
 * Capped at 2 on phones and desktop, and lower at a lower quality tier. A tablet held upright draws at 1x
 * because its large CSS area would exceed the mobile fragment fill budget at 2x.
 */
export function canvasResolutionFor(
  formFactor: FormFactor,
  devicePixelRatio: number,
  tier: QualityTier = 'high',
): number {
  if (formFactor === 'tablet-portrait') return 1
  return Math.min(devicePixelRatio || 1, RESOLUTION_CAPS[tier])
}
