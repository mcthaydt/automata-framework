// A peek held (the camera may lean and the far room shows) or ended.
import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

export interface PeekPayload {
  readonly portal: string
  readonly into: string
  /** True as the peek holds, false as a held peek ends. */
  readonly on: boolean
}
const peekSchema: z.ZodType<PeekPayload> = z.strictObject({
  portal: z.string(),
  into: z.string(),
  on: z.boolean(),
})
export const SystemsPeek: EventDef<z.ZodType<PeekPayload>> = defineEvent('systems.peek', peekSchema)
