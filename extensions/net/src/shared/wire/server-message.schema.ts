import { z } from 'zod'
import { MAX_SEATS } from './limits'
import { hex16Schema, reqIdSchema, seatSchema, uintSchema } from './primitives.schema'

/** The codes a room answers a refused request with. */
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
/**
 * Why a room refused a request: refused, the game versions differ, no such room, the room is full,
 * the server is busy or updating, too many requests, not verified, or offline.
 */
export type NetErrorCode = (typeof NET_ERROR_CODES)[number]

/** A seat as a JSON object key: "0" to MAX_SEATS - 1, no leading zero. */
const isSeatKey = (key: string): boolean => /^(?:0|[1-9][0-9]?)$/.test(key) && Number(key) < MAX_SEATS
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Per-seat acks. Zod's record drops an own `__proto__` key (which `JSON.parse` creates) without reporting it, so
 * every own key is checked before the record parses the values.
 */
const acks = z
  .custom<Record<string, unknown>>((value) => isPlainObject(value) && Object.keys(value).every(isSeatKey), {
    message: 'acks are keyed by seat',
  })
  .pipe(z.record(z.string(), uintSchema))

// What the room sends. `snap` and `replay` are headers: the snapshot or the packed replay follows as
// a binary message.
const snap = z.object({ t: z.literal('snap'), tick: uintSchema, hash: hex16Schema, acks }).strict()
const seated = z.object({ t: z.literal('seated'), seat: seatSchema }).strict()
/** `slack`: how many ticks early (positive) or late (negative) the probe's tick arrived. */
const pong = z.object({ t: z.literal('pong'), id: uintSchema, slack: z.number().int() }).strict()
const answer = z
  .object({ t: z.literal('answer'), req: reqIdSchema, error: z.enum(NET_ERROR_CODES).optional() })
  .strict()
const replay = z.object({ t: z.literal('replay') }).strict()

/**
 * Everything the room may send a client: a snapshot header, the seat you were given, a probe's
 * answer, the answer to a request (with an error code if it was refused) and a replay header.
 */
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

/** The Zod schema of a server message. */
export const serverMessageSchema: z.ZodType<ServerMessage> = z.discriminatedUnion('t', [
  snap,
  seated,
  pong,
  answer,
  replay,
])
