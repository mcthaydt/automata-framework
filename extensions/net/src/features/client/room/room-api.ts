/**
 * What a game and its UI see of an online room: the `NetRoom` interface, its options and the states it reports. The
 * implementation is `createNetRoom` (net-room.ts).
 */

import type { Clock } from '@automata/framework'
import type { Watchable } from '../../../shared/watchable'
import type { ClientNetworkPort } from './net-port'
import type { RoomInfo } from './room-info'
import type { NetSdkClient } from './sdk'
import type { SeatStorage } from './seat-token'

/**
 * Where the connection to the room is: offline, connecting, connected, reconnecting after a drop,
 * or degraded (up, but slow or silent).
 */
export type ConnectionState = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'degraded'

/** Why the room went without the player choosing to leave. */
export interface RoomEnd {
  readonly reason: 'seat-lost' | 'closed' | 'server-updating' | 'failed'
}

/**
 * What happened when a page tried to take its old seat back after a reload: it resumed, there was
 * nothing to resume, or the seat had expired.
 */
export type ResumeOutcome = 'resumed' | 'none' | 'expired'

/** What an intent that opens a room takes besides the player's name. */
export interface IntentOptions {
  readonly name: string
  /** Aborting it gives the call up: the room goes `offline` and the call rejects with the signal's reason. */
  readonly signal?: AbortSignal | undefined
}

/**
 * The player's side of an online room. Create, join or quick-match, get ready, add or remove a
 * bot, leave, and watch the connection, the room and why it ended.
 */
export interface NetRoom {
  create(options: IntentOptions): Promise<void>
  join(code: string, options: IntentOptions): Promise<void>
  /** Seats you in an open room in its lobby, or opens one. */
  quickMatch(options: IntentOptions): Promise<void>
  setReady(ready: boolean): Promise<void>
  /** Host seat only; the server's `BotPolicy` drives the bot. */
  addBot(): Promise<void>
  removeBot(seat: number): Promise<void>
  /** Leaves and forgets the seat, so no later reconnect or reload reclaims it. */
  leave(): Promise<void>
  /**
   * The session's diagnostics say the link is slow or silent: while the connection is up it reads `degraded` instead
   * of `connected`. A drop shows `reconnecting`, and going offline forgets the mark.
   */
  markDegraded(degraded: boolean): void
  /** Reclaims the stored seat after a reload, once: `expired` forgets the token and is never retried. */
  resume(options?: { readonly signal?: AbortSignal | undefined }): Promise<ResumeOutcome>
  readonly info: Watchable<RoomInfo | undefined>
  readonly connection: Watchable<ConnectionState>
  /** Set when the room ended without a leave; cleared by the next intent. */
  readonly ended: Watchable<RoomEnd | undefined>
  /** Core's `NetworkPort`, client end, for the session that predicts and reconciles. */
  readonly port: ClientNetworkPort
  /**
   * Closes the socket, the probe and any reconnect in flight, without giving up the seat: the stored token stays for
   * the next page load's `resume`. Pending requests reject as `OFFLINE`.
   */
  close(): void
}

/**
 * What `createNetRoom` needs: the server url, the client sim's hashes for the join check, the
 * reconnect grace, the game's clock and optionally the session token, the SDK client and where the
 * seat token is stored.
 */
export interface NetRoomOptions {
  /** The server: net.toml's `url`. */
  readonly url: string
  /** The client sim's hashes: the join check. */
  readonly version: { readonly schemaHash: string; readonly contentHash: string }
  readonly reconnectGraceSeconds: number
  /** Time for the probe, the round trips and the reconnection's waits: the game's clock, a fake one in tests. */
  readonly clock: Clock
  /** The host's session token, for the server's `SessionVerifier`; none for an anonymous server. */
  readonly session?: (() => string | undefined) | undefined
  /** The SDK client for `url`; the real one by default. */
  readonly client?: ((url: string) => NetSdkClient) | undefined
  /**
   * Where the reconnection token is written through to, for a reload's `resume`: this page's `sessionStorage` when
   * absent; `null` switches persistence off (the seat is still held in memory, so a drop reconnects).
   */
  readonly storage?: SeatStorage | null | undefined
  /** The backoff's spread, in [0, 1]; `Math.random` by default. */
  readonly random?: (() => number) | undefined
  /** The request ids' per-load prefix; drawn by default. */
  readonly loadToken?: string | undefined
}
