/**
 * How a refusal reaches a player (M7 spec §4.2 `NetError`, §6; FloorFifty `colyseus-network.ts` `refusalCode`).
 *
 * Every refusal Plus's server writes, from the room (`onAuth`, a refused request) or from a gate in front of
 * Colyseus, leads with net's code: `RATE_LIMITED: too many requests, try again shortly`. So the code is read, and the
 * words, which are for the log, never decide it. Colyseus's own matchmaking errors carry no code of ours and are read
 * by their fixed wording, and a request that never reached a server is `OFFLINE`.
 */

import { type Cause, Data } from 'effect'
import { NET_ERROR_CODES, type NetErrorCode } from '../wire/server-message.schema'

interface NetErrorFields {
  readonly code: NetErrorCode
  readonly operation: string
}

// `isolatedDeclarations` forbids `extends Data.TaggedError(…)` directly, so the base is typed first (as `server` does).
const NetErrorBase: new (
  fields: NetErrorFields,
) => Cause.YieldableError & { readonly _tag: 'NetError' } & Readonly<NetErrorFields> =
  Data.TaggedError('NetError')

/** A `NetRoom` call that failed: net's code, and which call it was (`create`, `join`, `setReady`, …). */
export class NetError extends NetErrorBase {}

const LEADING_CODE = /^([A-Z_]+): /
const isNetErrorCode = (value: string): value is NetErrorCode =>
  (NET_ERROR_CODES as readonly string[]).includes(value)

/** Socket-level failures Node and browsers report when no server answered. */
const UNREACHABLE = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
])

function unreachable(error: unknown): boolean {
  // `fetch` rejects with a TypeError when the request never got an answer (browsers and Node alike).
  if (error instanceof TypeError) return true
  const code = (error as { code?: unknown } | undefined)?.code
  return typeof code === 'string' && UNREACHABLE.has(code)
}

export function refusalCode(error: unknown): NetErrorCode {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const leading = LEADING_CODE.exec(message)?.[1]
  if (leading !== undefined) return isNetErrorCode(leading) ? leading : 'REFUSED'
  // Colyseus's matchmaker (`MatchMaker.ts`, 0.18): `room "X" not found` and `room "X" is locked` (full or started).
  if (/^room ".*" not found$/.test(message)) return 'ROOM_NOT_FOUND'
  if (/^room ".*" is locked$/.test(message)) return 'ROOM_FULL'
  if (unreachable(error)) return 'OFFLINE'
  return 'REFUSED'
}
