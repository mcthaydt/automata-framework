/**
 * Refuses a client on another version at its matchmaking request (FloorFifty `matchmake-version-gate.ts`; spec §4.2
 * join check, §6 "Schema or content hash differs from the room's: VERSION_MISMATCH", SV-h's last clause).
 *
 * A version is net's `PROTOCOL_VERSION` with the game's sim schema hash and content hash: two builds that differ in
 * any of them never share a room. Every room of a server runs the server's one game, so the server's version is
 * each room's. The room checks it too (`onAuth`), but Colyseus runs that only once the socket opens, after the
 * matchmaking reply; refused here, the client gets an HTTP error it can read and shows Reload.
 *
 * Plus has no build ids (M7.3b dropped FloorFifty's build facts), so FloorFifty's "a newer client should wait"
 * verdict is gone: every mismatch is `VERSION_MISMATCH`. A reconnect carries only its token, so it passes.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { PROTOCOL_VERSION } from '@mcthaydt/automata-net'
import { createSim } from '@mcthaydt/automata-sim'
import type { ServerDef } from '../game/server-game'
import type { OriginPolicy } from './origins'
import { writeRefusal } from './refusal'

export interface GameVersion {
  readonly protocol: number
  readonly schemaHash: string
  readonly contentHash: string
}

/** The game's version, read from a sim of it (seed 0: neither hash depends on the seed), then disposed. */
export async function gameVersionOf(def: ServerDef): Promise<GameVersion> {
  const sim = await createSim({ seed: 0, plugins: def.game.plugins, content: def.game.content })
  try {
    return {
      protocol: PROTOCOL_VERSION,
      schemaHash: sim.describeSnapshot().header.schemaHash,
      contentHash: sim.contentHash,
    }
  } finally {
    sim.dispose()
  }
}

/**
 * `same`, `mismatch`, or `unread` for options this gate cannot read, which are the room's to refuse (its strict
 * schema answers `REFUSED`). A protocol that differs is a mismatch whatever else the options hold: an old client may
 * send a shape this server does not know.
 */
export function versionVerdict(options: unknown, version: GameVersion): 'same' | 'mismatch' | 'unread' {
  if (typeof options !== 'object' || options === null) return 'unread'
  const { protocol, schemaHash, contentHash } = options as Record<string, unknown>
  if (typeof protocol !== 'number') return 'unread'
  if (protocol !== version.protocol) return 'mismatch'
  if (typeof schemaHash !== 'string' || typeof contentHash !== 'string') return 'unread'
  return schemaHash === version.schemaHash && contentHash === version.contentHash ? 'same' : 'mismatch'
}

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
