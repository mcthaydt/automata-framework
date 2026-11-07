/**
 * The room store (M7 spec §3, §7; FloorFifty `ui/store/room-store.svelte.ts`).
 *
 * A synchronous mirror of what the room last said, for the kit's lobby, room-code, ready-room and results screens
 * (PRODUCT.6), which read plain values and re-render on a callback. It holds no rule: it never decides who is host,
 * who is ready or whether a game may start, and it has no verbs (a screen acts through `NetRoom`). FloorFifty's
 * comment holds here too: a convenient derived value added to a store is how a second implementation of the room's
 * rules grows without anyone deciding to write one, so the test names exactly what the store may expose.
 */

import { Effect, type Scope, Stream } from 'effect'
import type { ConnectionState, NetRoom } from './net-room'
import type { RoomInfo } from './room-info'

export interface RoomStore {
  readonly info: RoomInfo | undefined
  readonly connection: ConnectionState
  /** Called after each change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void
}

export function makeRoomStore(
  room: Pick<NetRoom, 'info' | 'connection'>,
): Effect.Effect<RoomStore, never, Scope.Scope> {
  return Effect.gen(function* () {
    // Seeded from the room, so a store made mid-room shows the room at once.
    let info = yield* room.info.get
    let connection = yield* room.connection.get
    const listeners = new Set<() => void>()
    const tell = (): void => {
      for (const listener of [...listeners]) listener()
    }
    yield* Effect.forkScoped(
      Stream.runForEach(room.info.changes, (next) =>
        Effect.sync(() => {
          if (next === info) return
          info = next
          tell()
        }),
      ),
    )
    yield* Effect.forkScoped(
      Stream.runForEach(room.connection.changes, (next) =>
        Effect.sync(() => {
          if (next === connection) return
          connection = next
          tell()
        }),
      ),
    )
    yield* Effect.addFinalizer(() => Effect.sync(() => listeners.clear()))
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
    })
  })
}
