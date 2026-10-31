import { z } from 'zod'

const insets = z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() })
const rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })

/**
 * The game's display: insets the game must keep clear, the area the host reserves for its own controls, and the
 * UI scale hint (1.333 on a TV: enlarge text and targets, never CSS zoom).
 */
export interface DisplayMetricsPayload {
  safeArea: { top: number; right: number; bottom: number; left: number }
  hostReserved: { edge: 'right' | 'left'; rect: { x: number; y: number; w: number; h: number } }
  orientation: 'portrait' | 'landscape'
  fullscreen: boolean
  scale: 1 | 1.333
}

/** Checks display metrics. */
export const DisplayMetricsPayloadSchema: z.ZodType<DisplayMetricsPayload> = z.object({
  safeArea: insets,
  hostReserved: z.object({ edge: z.enum(['right', 'left']), rect }),
  orientation: z.enum(['portrait', 'landscape']),
  fullscreen: z.boolean(),
  scale: z.union([z.literal(1), z.literal(1.333)]),
})

/** The answer to a fullscreen request: the new state, and how this device can go fullscreen at all. */
export interface FullscreenRes {
  fullscreen: boolean
  support: 'element' | 'ios-home-screen' | 'none'
}

/** Checks a fullscreen answer. */
export const FullscreenResSchema: z.ZodType<FullscreenRes> = z.object({
  fullscreen: z.boolean(),
  support: z.enum(['element', 'ios-home-screen', 'none']),
})
