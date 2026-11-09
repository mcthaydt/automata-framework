/**
 * A game's version, and the verdict on a client's.
 *
 * A version is net's `PROTOCOL_VERSION` with the game's sim schema hash and content hash: two builds that differ in
 * any of them never share a room. Every room of a server runs the server's one game, so the server's version is
 * each room's. The matchmaking gate and the room both check it.
 */

import { PROTOCOL_VERSION } from '@automata/net'
import { createSim } from '@automata/sim'
import type { ServerDef } from './game/server-game'

/**
 * What two builds must share to play in one room: the net protocol, the sim's schema hash and the
 * content hash.
 */
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
