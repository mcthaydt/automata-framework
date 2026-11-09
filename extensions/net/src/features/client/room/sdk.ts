/**
 * The slice of the Colyseus 0.18 SDK the net client uses (`@colyseus/sdk` 0.18.5).
 *
 * Structural, so a test hands in `net/testing`'s fake and the client never depends on more of the SDK than it reads.
 * `colyseusClient` is the one place the real SDK is constructed.
 */

import { Client } from '@colyseus/sdk'

/**
 * The part of the Colyseus SDK's room that `net` uses. The real SDK room fits it, and so does the
 * fake in `@automata/net/testing`.
 */
export interface NetSdkRoom {
  /** The room code. */
  readonly roomId: string
  /** Rotated by every reconnect handshake. */
  readonly reconnectionToken: string
  /** The SDK's own reconnect loop: switched off, because ours survives a reload too. */
  readonly reconnection: { enabled: boolean }
  /** The room-info schema, decoded by the SDK. */
  readonly state: unknown
  readonly connection: { close(code?: number, reason?: string): void; readonly transport?: unknown }
  onMessage(type: string, handler: (payload: unknown) => void): unknown
  onStateChange(handler: (state: unknown) => void): unknown
  onLeave(handler: (code: number) => void): unknown
  send(type: string, payload: unknown): void
  /** A consented leave frees the seat at once; the SDK resolves with the close code. */
  leave(consented?: boolean): Promise<number>
  removeAllListeners(): void
}

/**
 * The part of the Colyseus SDK's client that `net` uses: create, join by code, join or create, and
 * reconnect with a token.
 */
export interface NetSdkClient {
  create(roomName: string, options: unknown): Promise<NetSdkRoom>
  joinById(code: string, options: unknown): Promise<NetSdkRoom>
  joinOrCreate(roomName: string, options: unknown): Promise<NetSdkRoom>
  reconnect(token: string): Promise<NetSdkRoom>
}

/** The real SDK client for a server at `url` (net.toml's `url`). */
export function colyseusClient(url: string): NetSdkClient {
  return new Client(url) as unknown as NetSdkClient
}
