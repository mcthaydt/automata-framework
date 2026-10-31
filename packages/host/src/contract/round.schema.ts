import { z } from 'zod'

/** How a round ended. */
export type RoundOutcome = 'complete' | 'fail' | 'quit'

/** Checks a round outcome. */
export const RoundOutcomeSchema: z.ZodType<RoundOutcome> = z.enum(['complete', 'fail', 'quit'])
