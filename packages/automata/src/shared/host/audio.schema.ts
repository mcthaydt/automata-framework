import { z } from 'zod'

/** The host's audio state: focus (an ad or overlay may duck or mute the game), the master volume, and the gain. */
export interface AudioChange {
  focus: { state: 'full' | 'ducked' | 'muted'; reason: 'ad' | 'hidden' | 'host-overlay' | 'system' }
  master: { volume: number; muted: boolean }
  /** 0..1: multiply the game's own mix by this. */
  gain: number
}

/** Checks an audio change. */
export const AudioChangeSchema: z.ZodType<AudioChange> = z.object({
  focus: z.object({
    state: z.enum(['full', 'ducked', 'muted']),
    reason: z.enum(['ad', 'hidden', 'host-overlay', 'system']),
  }),
  master: z.object({ volume: z.number(), muted: z.boolean() }),
  gain: z.number(),
})
