/**
 * How a refusal reaches a player.
 *
 * Every refusal the server writes, from the room (`onAuth`, a refused request) or from a gate in front of
 * Colyseus, leads with net's code: `RATE_LIMITED: too many requests, try again shortly`. So the code is read, and the
 * words, which are for the log, never decide it. Colyseus's own matchmaking errors carry no code of ours and are read
 * by their fixed wording, and a request that never reached a server is `OFFLINE`.
 */

import { NET_ERROR_CODES, type NetErrorCode } from '../../../shared/wire/server-message.schema'

/** A `NetRoom` call that failed: net's code, and which call it was (`create`, `join`, `setReady`, ...). */
export class NetError extends Error {
  override readonly name: 'NetError' = 'NetError'
  readonly code: NetErrorCode
  readonly operation: string

  constructor(fields: { readonly code: NetErrorCode; readonly operation: string }) {
    super(`${fields.operation} failed: ${fields.code}`)
    this.code = fields.code
    this.operation = fields.operation
  }
}

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

/**
 * How `fetch` says a request got no answer: Node "fetch failed", Chromium "Failed to fetch", Firefox "NetworkError
 * when attempting to fetch resource.", WebKit "Load failed". The real SDK never lets fetch's TypeError through: its
 * `HTTP.ts` rethrows it as a `ServerError`, and the client as a `MatchMakeError`, both with fetch's words and no code.
 * So the wording is matched on any Error; any other TypeError is a bug, never the network.
 */
const FETCH_FAILED =
  /^(?:fetch failed|Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/

/**
 * Numeric codes the SDK reports when no server of ours answered:
 * - 1005 and 1006, a socket that went without a close frame (`MatchMakeError('', 1006)`). A socket the server's gate
 *   refused before Colyseus (an address past its sockets) reaches the client this way too, and reads `OFFLINE`.
 * - 502, 503 and 504, a gateway answering for a server that is restarting (`MatchMakeError('', 502)`, its body not
 *   ours). The server's own refusals lead with a net code (`SERVER_UPDATING: …`), which is read before this.
 */
const SOCKET_LOST = new Set([1005, 1006, 502, 503, 504])

function unreachable(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (FETCH_FAILED.test(error.message)) return true
  const code = (error as { code?: unknown }).code
  if (typeof code === 'number') return SOCKET_LOST.has(code)
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
