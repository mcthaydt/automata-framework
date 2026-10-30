import { type Effect, Exit, ManagedRuntime, Scope, SubscriptionRef, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import type { ConnectionState, NetRoom } from './net-room'
import type { RoomInfo } from './room-info'
import { makeRoomStore } from './room-store'

// The room store (M7 spec §3: "a read-only mirror"; FloorFifty `tests/client/ui/room-store.test.ts` at 677d456).
// Two things are under test. The ordinary one: the store mirrors what the room last said. The load-bearing one: a
// mirror has no verbs, and the store must never grow one.

const LOBBY: RoomInfo = {
  code: 'ABC234',
  phase: 'lobby',
  seats: [{ seat: 0, name: 'Ada', ready: false, connected: true, bot: false }],
  you: 0,
  hostSeat: 0,
}

async function setup(initial: { info?: RoomInfo; connection?: ConnectionState } = {}) {
  const runtime = ManagedRuntime.make(TestContext.TestContext)
  const info = await runtime.runPromise(SubscriptionRef.make<RoomInfo | undefined>(initial.info))
  const connection = await runtime.runPromise(
    SubscriptionRef.make<ConnectionState>(initial.connection ?? 'offline'),
  )
  const room = { info, connection } as unknown as NetRoom
  const scope = await runtime.runPromise(Scope.make())
  const store = await runtime.runPromise(makeRoomStore(room).pipe(Scope.extend(scope)))
  const settle = async () => {
    for (let round = 0; round < 20; round += 1) await Promise.resolve()
  }
  await settle()
  return {
    store,
    set: async (effect: Effect.Effect<void>) => {
      await runtime.runPromise(effect)
      await settle()
    },
    info,
    connection,
    close: async () => {
      await runtime.runPromise(Scope.close(scope, Exit.void))
      await runtime.dispose()
    },
  }
}

describe('the room store', () => {
  it('mirrors the newest room info', async () => {
    const t = await setup()
    await t.set(SubscriptionRef.set(t.info, LOBBY))
    expect(t.store.info).toEqual(LOBBY)
    await t.close()
  })

  it('starts from what the room already holds', async () => {
    // A store made mid-room must not show an empty room until the next change.
    const t = await setup({ info: LOBBY, connection: 'connected' })
    expect(t.store.info).toEqual(LOBBY)
    expect(t.store.connection).toBe('connected')
    await t.close()
  })

  it('mirrors the connection, and keeps the room info while reconnecting', async () => {
    // reconnect.test "retains the last snapshot so the world stays on screen".
    const t = await setup({ info: LOBBY, connection: 'connected' })
    await t.set(SubscriptionRef.set(t.connection, 'reconnecting'))
    expect(t.store.connection).toBe('reconnecting')
    expect(t.store.info).toEqual(LOBBY)
    await t.close()
  })

  it('tells its subscribers of each change, until they unsubscribe', async () => {
    const t = await setup()
    let heard = 0
    const off = t.store.subscribe(() => {
      heard += 1
    })
    await t.set(SubscriptionRef.set(t.info, LOBBY))
    await t.set(SubscriptionRef.set(t.connection, 'connected'))
    off()
    await t.set(SubscriptionRef.set(t.connection, 'offline'))
    expect(heard).toBe(2)
    await t.close()
  })

  it('stops mirroring when its scope closes', async () => {
    const t = await setup()
    let heard = 0
    t.store.subscribe(() => {
      heard += 1
    })
    await t.close()
    expect(heard).toBe(0)
  })

  it('has no verbs: it reads, and never decides', async () => {
    // FloorFifty's load-bearing case: a convenient derived value or action here would be a second implementation of
    // the room's rules. The store exposes the mirror, a subscription, and nothing else.
    const t = await setup()
    const names = Object.keys(Object.getOwnPropertyDescriptors(t.store)).sort()
    expect(names).toEqual(['connection', 'info', 'subscribe'])
    expect(Object.isFrozen(t.store)).toBe(true)
    await t.close()
  })
})
