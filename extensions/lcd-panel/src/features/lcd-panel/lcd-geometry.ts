// The panel's maths, on the CPU: the mesh's pitch, the vignette and the numbers the shader reads. Pure, so Node tests them.

import type { LcdProfile } from './lcd-profile.schema.ts'

/** GLSL's smoothstep, because the fade this returns is what the shader uses. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/**
 * The mesh's geometry: a whole number of cells per period, never shorter than `minPitch` pixels, so the pattern stays on
 * the field's own grid, and the Nyquist fade that period earns. The 1e-4 bias keeps a ratio of exactly 1 from rounding up to 2.
 */
export function derivePitch(
  cellSize: number,
  minPitch: number,
): { cells: number; cyclesPerPixel: number; fade: number } {
  const cells = Math.max(Math.ceil(minPitch / cellSize - 1e-4), 1)
  const cyclesPerPixel = 1 / (cells * cellSize)
  return { cells, cyclesPerPixel, fade: 1 - smoothstep(0.34, 0.5, cyclesPerPixel) }
}

/** How much the vignette darkens a pixel `edge` out from the ellipse's centre (1 is the ellipse's own edge at 0.82 of it). */
export function vignetteShade(edge: number): number {
  if (edge < 0.82) return 0.667 * smoothstep(0.52, 0.82, edge)
  const t = Math.min(1, Math.max(0, (edge - 0.82) / 0.18))
  return 0.667 + (0.933 - 0.667) * t
}

/** The uniform names, in the order the effect declares them. The two shaders must read every one (a test checks it). */
export const LCD_UNIFORMS = [
  'uCellSize',
  'uCells',
  'uCyclesPerPixel',
  'uFade',
  'uGrid',
  'uBalance',
  'uSubpixels',
  'uLayout',
  'uScanlines',
  'uAberration',
  'uGlow',
  'uGlowThreshold',
  'uGlowRadius',
  'uBrightness',
  'uGamma',
  'uSnap',
  'uVignette',
] as const

export type LcdUniformValues = Record<(typeof LCD_UNIFORMS)[number], number>

/** The shader's numbers for a profile. `scale` multiplies the cell (1 on a desktop-sized field, 2 on a coarser one). */
export function lcdUniformValues(profile: LcdProfile, scale: number): LcdUniformValues {
  const cellSize = profile.cell * scale
  const pitch = derivePitch(cellSize, profile.minPitch)
  return {
    uCellSize: cellSize,
    uCells: pitch.cells,
    uCyclesPerPixel: pitch.cyclesPerPixel,
    uFade: pitch.fade,
    uGrid: profile.grid,
    uBalance: profile.balance,
    uSubpixels: profile.subpixels,
    uLayout: profile.layout === 'bgr' ? 1 : 0,
    uScanlines: profile.scanlines,
    uAberration: profile.aberration,
    uGlow: profile.glow,
    uGlowThreshold: profile.glowThreshold,
    uGlowRadius: profile.glowRadius,
    uBrightness: profile.brightness,
    uGamma: profile.gamma,
    uSnap: profile.snap ? 1 : 0,
    uVignette: profile.vignette ? 1 : 0,
  }
}
