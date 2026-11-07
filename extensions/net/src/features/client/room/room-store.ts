/**
 * The room store: a synchronous mirror of what the room last said, for the lobby, room-code, ready-room and results
 * screens, which read plain values and re-render on a callback. It holds no rule: it never decides who is host, who is
 * ready or whether a game may start, and it has no verbs (a screen acts through `NetRoom`). A convenient derived value
 * added to a store is how a second implementation of the room's rules grows without anyone deciding to write one, so
 * the test names exactly what the store may expose.
 */

import type { ConnectionState, NetRoom } from './net-room'
import type { RoomInfo } from './room-info'

export interface RoomStore {
  readonly info: RoomInfo | undefined
  readonly connection: ConnectionState
  /** Called after each change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void
  /** Stops mirroring and drops every subscriber; the store keeps what it last showed. */
  close(): void
}

export function createRoomStore(room: Pick<NetRoom, 'info' | 'connection'>): RoomStore {
  // Seeded from the room, so a store made mid-room shows the room at once.
  let info = room.info.get()
  let connection = room.connection.get()
  const listeners = new Set<() => void>()
  const tell = (): void => {
    for (const listener of [...listeners]) listener()
  }
  const stopInfo = room.info.subscribe((next) => {
    if (next === info) return
    info = next
    tell()
  })
  const stopConnection = room.connection.subscribe((next) => {
    if (next === connection) return
    connection = next
    tell()
  })
  return Object.freeze({
    get info() {
      return info
    },
    get connection() {
      return connection
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    close() {
      stopInfo()
      stopConnection()
      listeners.clear()
    },
  })
}
