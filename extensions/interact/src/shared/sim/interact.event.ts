// What a use of a hotspot came to: it is waiting for the walker, it was refused, or it was done.
import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

export interface InteractPendingPayload {
  readonly at: string
}
const pendingSchema: z.ZodType<InteractPendingPayload> = z.strictObject({ at: z.string() })
/** A use is waiting for the walker to come within reach. */
export const InteractPending: EventDef<z.ZodType<InteractPendingPayload>> = defineEvent(
  'interact.pending',
  pendingSchema,
)

export type RefusedReason = 'unknown' | 'unavailable' | 'unreachable'
export interface InteractRefusedPayload {
  readonly at: string
  readonly reason: RefusedReason
}
const refusedSchema: z.ZodType<InteractRefusedPayload> = z.strictObject({
  at: z.string(),
  reason: z.enum(['unknown', 'unavailable', 'unreachable']),
})
/** A use was refused or dropped: no such hotspot, its condition fails, or the walker found no way to it. */
export const InteractRefused: EventDef<z.ZodType<InteractRefusedPayload>> = defineEvent(
  'interact.refused',
  refusedSchema,
)

export interface InteractUsedPayload {
  readonly at: string
  readonly held?: string | undefined
  /** The walker hid instead of sending a verb. */
  readonly hid: boolean
}
const usedSchema: z.ZodType<InteractUsedPayload> = z.strictObject({
  at: z.string(),
  held: z.string().optional(),
  hid: z.boolean(),
})
/** A hotspot was used. */
export const InteractUsed: EventDef<z.ZodType<InteractUsedPayload>> = defineEvent('interact.used', usedSchema)
