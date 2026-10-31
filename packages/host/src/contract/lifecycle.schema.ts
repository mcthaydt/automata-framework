import { z } from 'zod'

/** Whether the game pauses when it goes to the background; fixed for the game's whole life. */
export type PauseBehavior = 'pause' | 'continue'

/** Checks a pause behavior. */
export const PauseBehaviorSchema: z.ZodType<PauseBehavior> = z.enum(['pause', 'continue'])

/** Why the game is in the background. */
export type LifecycleReason = 'hidden' | 'blurred' | 'host-overlay' | 'ad' | 'offline-grace'

/** Whether the game is in front, and if not, why. */
export interface LifecyclePayload {
  state: 'active' | 'background'
  reasons: LifecycleReason[]
}

/** Checks a lifecycle change. */
export const LifecyclePayloadSchema: z.ZodType<LifecyclePayload> = z.object({
  state: z.enum(['active', 'background']),
  reasons: z.array(z.enum(['hidden', 'blurred', 'host-overlay', 'ad', 'offline-grace'])),
})
