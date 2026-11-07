/**
 * What a room engine is given and what it tells: its clients, its options, and the room as clients see it.
 */

import type { NetConfig, ServerMessage } from '@automata/net'
import type { Sim } from '@automata/sim'
import type { ReplayCompression } from '@automata/sim/replay'
import type { Bucket, RoomLogEvent } from '../game/server-config'
import type { ServerDef } from '../game/server-game'
import type { LobbyState } from '../rooms/lobby-rules'
import type { SeatClient } from '../rooms/seat-registry'

/** A connected client as the room speaks to it: wire messages, binary and closing. */
export interface RoomClient extends SeatClient {
  send(message: ServerMessage): void
  sendBytes(bytes: Uint8Array): void
  /** Ends this client's connection (a `leave` request). */
  close(): void
}

/**
 * `drained`: a draining room has nothing left to finish. `abandoned`: nobody is left who could come back. `failed`:
 * the game's code threw on the tick and the room halted.
 */
export type CloseReason = 'drained' | 'abandoned' | 'failed'

export interface RoomEngineOptions {
  readonly def: ServerDef
  /** The room's sim, created from the game's plugins, content and the room seed. The engine disposes it. */
  readonly sim: Sim
  /** The room seed: the sim's, and the root of each bot's stream. */
  readonly seed: number
  readonly net: NetConfig
  readonly commandsPerSeat: Bucket
  /** The room clock, in milliseconds: the tick scheduler's. Pings are measured on it. */
  readonly now: () => number
  /** Read for `NODE_ENV`: a clock hold is refused in production. */
  readonly env: Readonly<Record<string, string | undefined>>
  readonly log?: ((event: RoomLogEvent) => void) | undefined
  readonly compression?: ReplayCompression | undefined
  /** The room has nothing left to do and should close. Called once. */
  readonly onClose: (reason: CloseReason) => void
}

/** What became of one command a seat submitted. */
export type SubmitOutcome =
  | 'accepted'
  | 'late'
  | 'phase'
  | 'type'
  | 'payload'
  | 'rate'
  | 'sequence'
  | 'lead'
  | 'full'

/** A seat as the room tells clients about it (net's `SeatInfo`). */
export interface SeatInfoView {
  readonly seat: number
  readonly name: string
  readonly ready: boolean
  readonly connected: boolean
  readonly bot: boolean
}

/** The room as clients see it (net's `RoomInfo`, without the code and `you`, which the adapter and `seated` give). */
export interface RoomInfoView {
  readonly phase: LobbyState['phase']
  readonly hostSeat: number | undefined
  readonly seats: readonly SeatInfoView[]
}
