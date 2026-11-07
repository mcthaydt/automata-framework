/**
 * How a room refuses a request, and how any failure reaches a player (FloorFifty `room-errors.ts`).
 *
 * A rule refuses by throwing `RoomCommandError`. The `CommandLedger` catches whatever a request throws and turns it
 * into the answer the player sees with `toServerError`, so the rules refuse without knowing Colyseus or the wire.
 * The codes are net's (`NetErrorCode`, the one owner); FloorFifty's `NOT_HOST`, `INVALID_ROOM` and
 * `MALFORMED_MESSAGE` all answer `REFUSED`, and the message says which.
 */

import type { NetErrorCode } from '@automata/net'

/** A refusal the client is expected to show the player, as opposed to a crash. */
export class RoomCommandError extends Error {
  readonly code: NetErrorCode

  constructor(code: NetErrorCode, message: string) {
    super(message)
    this.name = 'RoomCommandError'
    this.code = code
  }
}

/** What a player is told about a failure: a code from net's list and a sentence. */
export interface ServerError {
  readonly code: NetErrorCode
  readonly message: string
}

/**
 * Translates any thrown failure into something a client can render. A refusal keeps its own code and words.
 * Anything else is a bug on our side, so the player gets a generic sentence and never the bug's own text.
 */
export function toServerError(error: unknown): ServerError {
  if (error instanceof RoomCommandError) return { code: error.code, message: error.message }
  return { code: 'REFUSED', message: 'the server could not process that message' }
}
