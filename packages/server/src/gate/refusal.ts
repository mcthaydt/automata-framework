/**
 * A matchmaking refusal written before Colyseus sees the request (FloorFifty `matchmake-version-gate.ts`'
 * `writeRefusal`): the `{ code, error }` shape the Colyseus SDK reads from any failed matchmaking request, with the
 * net error code first in `error` (`RATE_LIMITED: …`), as the room's own refusals are (M7.3b), so a client reads
 * one shape whoever refused it. Its CORS is the origin list's, so a listed page can read why.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { ErrorCode } from '@colyseus/core'
import type { NetErrorCode } from '@mcthaydt/automata-net'
import type { OriginPolicy } from './origins'

/** What a player is told, by code. */
export const REFUSAL_WORDS: Readonly<Partial<Record<NetErrorCode, string>>> = {
  REFUSED: 'this page may not use the server',
  RATE_LIMITED: 'too many requests, try again shortly',
  SERVER_UPDATING: 'the server is updating',
  VERSION_MISMATCH: 'this game is out of date: reload to play',
}

export function writeRefusal(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  code: NetErrorCode,
  origins: OriginPolicy,
): true {
  response.writeHead(status, {
    ...origins.corsHeaders(request.headers.origin),
    'content-type': 'application/json',
  })
  response.end(
    JSON.stringify({ code: ErrorCode.AUTH_FAILED, error: `${code}: ${REFUSAL_WORDS[code] ?? code}` }),
  )
  return true
}
