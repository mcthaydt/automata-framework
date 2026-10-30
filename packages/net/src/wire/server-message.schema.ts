import { z } from 'zod'
import { MAX_SEATS } from './limits'
import { hex16Schema, reqIdSchema, seatSchema, uintSchema } from './primitives.schema'

/** The codes a room answers a refused request with (M7 spec §4.2, `NetError`). */
export const NET_ERROR_CODES: readonly [
  'REFUSED',
  'VERSION_MISMATCH',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'SERVER_BUSY',
  'SERVER_UPDATING',
  'RATE_LIMITED',
  'UNVERIFIED',
  'OFFLINE',
] = [
  'REFUSED',
  'VERSION_MISMATCH',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'SERVER_BUSY',
  'SERVER_UPDATING',
  'RATE_LIMITED',
  'UNVERIFIED',
  'OFFLINE',
] as const
export type NetErrorCode = (typeof NET_ERROR_CODES)[number]

/** A seat as a JSON object key: "0" to MAX_SEATS - 1, no leading zero. */
const seatKey = z
  .string()
  .regex(/^(?:0|[1-9][0-9]?)$/)
  .refine((key) => Number(key) < MAX_SEATS)

// What the room sends (M7 spec §4.2). `snap` and `replay` are headers: the snapshot or the packed replay follows as
// a binary message.
const snap = z
  .object({ t: z.literal('snap'), tick: uintSchema, hash: hex16Schema, acks: z.record(seatKey, uintSchema) })
  .strict()
const seated = z.object({ t: z.literal('seated'), seat: seatSchema }).strict()
/** `slack`: how many ticks early (positive) or late (negative) the probe's tick arrived (FloorFifty input lead). */
const pong = z.object({ t: z.literal('pong'), id: uintSchema, slack: z.number().int() }).strict()
const answer = z
  .object({ t: z.literal('answer'), req: reqIdSchema, error: z.enum(NET_ERROR_CODES).optional() })
  .strict()
const replay = z.object({ t: z.literal('replay') }).strict()

export type ServerMessage =
  | {
      readonly t: 'snap'
      readonly tick: number
      readonly hash: string
      readonly acks: Record<string, number>
    }
  | { readonly t: 'seated'; readonly seat: number }
  | { readonly t: 'pong'; readonly id: number; readonly slack: number }
  | { readonly t: 'answer'; readonly req: string; readonly error?: NetErrorCode | undefined }
  | { readonly t: 'replay' }

export const serverMessageSchema: z.ZodType<ServerMessage> = z.discriminatedUnion('t', [
  snap,
  seated,
  pong,
  answer,
  replay,
])
