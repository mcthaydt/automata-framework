import { z } from 'zod'
import { commandTypeSchema, reqIdSchema, seatSchema, uintSchema } from './primitives.schema'

// What a client may send (M7 spec §4.2). Every object is strict. A command's payload is `unknown` here: the room
// re-parses it with the sim's own command schema, which is its one owner.

const command = z
  .object({
    t: z.literal('cmd'),
    seq: uintSchema,
    tick: uintSchema,
    type: commandTypeSchema,
    payload: z.unknown(),
  })
  .strict()

/** A clock probe: `tick` is fractional, or -1 before the client has a clock (FloorFifty's `pingSchema`). */
const ping = z.object({ t: z.literal('ping'), id: uintSchema, tick: z.number().finite().min(-1) }).strict()

const ready = z.object({ t: z.literal('ready'), ready: z.boolean(), req: reqIdSchema }).strict()

const roomRequest = z
  .object({ t: z.enum(['bot.add', 'bot.remove', 'leave']), req: reqIdSchema, seat: seatSchema.optional() })
  .strict()

export type ClientMessage =
  | {
      readonly t: 'cmd'
      readonly seq: number
      readonly tick: number
      readonly type: string
      readonly payload: unknown
    }
  | { readonly t: 'ping'; readonly id: number; readonly tick: number }
  | { readonly t: 'ready'; readonly ready: boolean; readonly req: string }
  | {
      readonly t: 'bot.add' | 'bot.remove' | 'leave'
      readonly req: string
      readonly seat?: number | undefined
    }

export const clientMessageSchema: z.ZodType<ClientMessage> = z.discriminatedUnion('t', [
  command,
  ping,
  ready,
  roomRequest,
])
