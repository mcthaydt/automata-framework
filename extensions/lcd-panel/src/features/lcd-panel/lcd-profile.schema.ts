// The LCD panel's settings: one profile, Zod-checked, with the clinic's numbers as the defaults. Every length is in
// look-field pixels (the pixels the pixel-art look draws), and a "cell" is a block of them (`cell` a side).

import { z } from 'zod'

const unit = (message: string) => z.number().min(0, message).max(1, message)

export const lcdProfileSchema = z.strictObject({
  /** Mesh visibility, 0 to 1. 0 disables the mesh but not the stripes. */
  grid: unit('grid is 0 to 1').default(0.3),
  /** Share of the mesh given to rows, 0 to 1. 1 is horizontal lines only. */
  balance: unit('balance is 0 to 1').default(0.6),
  /** Shortest mesh period, in pixels. Below about 3 the mesh fades out (Nyquist). */
  minPitch: z.number().min(1, 'minPitch is at least 1 pixel').default(3),
  /** RGB stripe visibility, 0 to 1. 0 disables them. */
  subpixels: unit('subpixels is 0 to 1').default(0.3),
  /** Stripe order. */
  layout: z.enum(['rgb', 'bgr']).default('rgb'),
  /** Added to the row axis of the mesh, so it shares the mesh's pitch. */
  scanlines: unit('scanlines is 0 to 1').default(0.3),
  /** Red and blue split sideways, in cells. */
  aberration: z.number().min(0, 'aberration is 0 or more').default(0.25),
  /** Halation strength: a bright pixel lights the mesh round it. 0 disables it. */
  glow: z.number().min(0, 'glow is 0 or more').default(0.3),
  /** Luma, 0 to 1, above which halation is emitted. */
  glowThreshold: unit('glowThreshold is 0 to 1').default(0.55),
  /** Halation tap radius, in cells. */
  glowRadius: z.number().min(0, 'glowRadius is 0 or more').default(1.5),
  /** Output gain, under a square root in the shader: the mesh absorbs some light and this gives it back. 1 disables it. */
  brightness: z.number().positive('brightness is above 0').default(1.55),
  /** Output gamma. 1 disables it. */
  gamma: z.number().positive('gamma is above 0').default(1),
  /** Pixels a side of one cell. The mesh period is a whole number of cells. */
  cell: z.number().int('cell is a whole number of pixels').min(1, 'cell is at least 1 pixel').default(2),
  /** Crisp pixels: the colour split lands on whole pixels instead of blending two (a stronger fringe). */
  snap: z.boolean().default(false),
  /** The frame's outer vignette: an ellipse a little above the middle, clear inside, near black at the corners. */
  vignette: z.boolean().default(true),
})

export type LcdProfile = z.output<typeof lcdProfileSchema>

/** Reads a profile, filling what is left out with the clinic's numbers. Throws a `ZodError` naming the setting that is wrong. */
export const parseLcdProfile = (input: unknown): LcdProfile => lcdProfileSchema.parse(input)

/** The clinic's panel: every default. */
export const LCD_CLINIC: LcdProfile = parseLcdProfile({})

/** The panel switched off: every term that changes the picture zeroed. The vignette is the frame's, not the panel's, so it stays. */
export const LCD_OFF: LcdProfile = {
  ...LCD_CLINIC,
  grid: 0,
  subpixels: 0,
  scanlines: 0,
  aberration: 0,
  glow: 0,
  brightness: 1,
  gamma: 1,
}
