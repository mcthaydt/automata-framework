import type { FormFactor } from '@mcthaydt/automata-ui'

export const MAX_RESOLUTION = 2

/**
 * Calculates device pixels per CSS pixel for the canvas.
 *
 * Capped at 2 on phones and desktop. A tablet held upright draws at 1x
 * because its large CSS area would exceed the mobile fragment fill budget at 2x.
 */
export function canvasResolutionFor(formFactor: FormFactor, devicePixelRatio: number): number {
  if (formFactor === 'tablet-portrait') return 1
  return Math.min(devicePixelRatio || 1, MAX_RESOLUTION)
}
