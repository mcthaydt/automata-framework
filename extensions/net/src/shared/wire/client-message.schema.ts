import { z } from 'zod'
import { commandTypeSchema, reqIdSchema, seatSchema, uintSchema } from './primitives.schema'

// What a client may send. Every object is strict. A command's payload is `unknown` here: the room
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

/**
 * A clock probe: `tick` is the client's fractional tick from 0, or -1 before it has a clock (the fraction is what lets the
 * room measure slack finer than a tick).
 */
const ping = z
  .object({
    t: z.literal('ping'),
    id: uintSchema,
    tick: z.union([z.literal(-1), z.number().finite().nonnegative()]),
  })
  .strict()

const ready = z.object({ t: z.literal('ready'), ready: z.boolean(), req: reqIdSchema }).strict()

const roomRequest = z.object({ t: z.enum(['bot.add', 'leave']), req: reqIdSchema }).strict()
const botRemove = z.object({ t: z.literal('bot.remove'), req: reqIdSchema, seat: seatSchema }).strict()

/**
 * Everything a client may send the room: a command, a clock probe, ready or not, add or remove a
 * bot, and leave.
 */
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
  | { readonly t: 'bot.add' | 'leave'; readonly req: string }
  | { readonly t: 'bot.remove'; readonly req: string; readonly seat: number }

/** The Zod schema of a client message. The room checks every message against it before it acts. */
export const clientMessageSchema: z.ZodType<ClientMessage> = z.discriminatedUnion('t', [
  command,
  ping,
  ready,
  roomRequest,
  botRemove,
])
