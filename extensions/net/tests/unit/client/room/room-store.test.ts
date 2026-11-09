import { describe, expect, it } from 'vitest'
import type { ConnectionState } from '#src/features/client/room/net-room.ts'
import type { RoomInfo } from '#src/features/client/room/room-info.ts'
import { createRoomStore } from '#src/features/client/room/room-store.ts'
import { createWatchable } from '#src/shared/watchable.ts'

// The room store: a read-only mirror of the room.
// Two things are under test. The ordinary one: the store mirrors what the room last said. The load-bearing one: a
// mirror has no verbs, and the store must never grow one.

const LOBBY: RoomInfo = {
  code: 'ABC234',
  phase: 'lobby',
  seats: [{ seat: 0, name: 'Ada', ready: false, connected: true, bot: false }],
  you: 0,
  hostSeat: 0,
}

function setup(initial: { info?: RoomInfo; connection?: ConnectionState } = {}) {
  const info = createWatchable<RoomInfo | undefined>(initial.info)
  const connection = createWatchable<ConnectionState>(initial.connection ?? 'offline')
  const store = createRoomStore({ info: info.view, connection: connection.view })
  return { store, info, connection }
}

describe('the room store', () => {
  it('mirrors the newest room info', () => {
    const t = setup()
    t.info.set(LOBBY)
    expect(t.store.info).toEqual(LOBBY)
  })

  it('starts from what the room already holds', () => {
    // A store made mid-room must not show an empty room until the next change.
    const t = setup({ info: LOBBY, connection: 'connected' })
    expect(t.store.info).toEqual(LOBBY)
    expect(t.store.connection).toBe('connected')
  })

  it('mirrors the connection, and keeps the room info while reconnecting', () => {
    const t = setup({ info: LOBBY, connection: 'connected' })
    t.connection.set('reconnecting')
    expect(t.store.connection).toBe('reconnecting')
    expect(t.store.info).toEqual(LOBBY)
  })

  it('tells its subscribers of each change, until they unsubscribe', () => {
    const t = setup()
    let heard = 0
    const off = t.store.subscribe(() => {
      heard += 1
    })
    t.info.set(LOBBY)
    t.connection.set('connected')
    off()
    t.connection.set('offline')
    expect(heard).toBe(2)
  })

  it('stops mirroring when it is closed', () => {
    const t = setup({ info: LOBBY, connection: 'connected' })
    let heard = 0
    t.store.subscribe(() => {
      heard += 1
    })
    t.store.close()
    t.info.set(undefined)
    t.connection.set('offline')
    expect(heard).toBe(0)
    expect(t.store.info).toEqual(LOBBY)
    expect(t.store.connection).toBe('connected')
  })

  it('has no verbs: it reads, and never decides', () => {
    // A convenient derived value or action here would be a second implementation of the room's rules. The store
    // exposes the mirror, a subscription, closing, and nothing else.
    const t = setup()
    const names = Object.keys(Object.getOwnPropertyDescriptors(t.store)).sort()
    expect(names).toEqual(['close', 'connection', 'info', 'subscribe'])
    expect(Object.isFrozen(t.store)).toBe(true)
  })
})
