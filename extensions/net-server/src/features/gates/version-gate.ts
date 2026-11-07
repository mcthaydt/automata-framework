/**
 * Refuses a client on another version at its matchmaking request.
 *
 * The room checks the version too (`onAuth`), but Colyseus runs that only once the socket opens, after the
 * matchmaking reply; refused here, the client gets an HTTP error it can read and shows Reload.
 *
 * There are no build ids to order, so there is no "a newer client should wait" verdict: every mismatch is
 * `VERSION_MISMATCH`. A reconnect carries only its token, so it passes.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { type GameVersion, versionVerdict } from '../../shared/game-version'
import type { OriginPolicy } from './origins'
import { writeRefusal } from './refusal'

/** The matchmaking calls whose options carry the client's version. */
const VERSIONED = /^\/matchmake\/(create|join|joinById|joinOrCreate)\//

function parsed(body: string): unknown {
  try {
    return JSON.parse(body) as unknown
  } catch {
    return undefined
  }
}

/** Answers a versioned matchmaking request (`path`, as Colyseus routes it) from another version, and says whether it did. */
export function refuseStaleVersion(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  body: string,
  version: GameVersion,
  origins: OriginPolicy,
): boolean {
  if (!VERSIONED.test(path)) return false
  if (versionVerdict(parsed(body), version) !== 'mismatch') return false
  return writeRefusal(request, response, 400, 'VERSION_MISMATCH', origins)
}
