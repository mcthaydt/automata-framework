/**
 * Runs a `NetRoom` over `net/testing`'s fake SDK, on `TestClock`, in a scope a test closes. Nothing waits on a real
 * timer: time moves only by `advance`, and `settle` lets promise callbacks already resolved run.
 */

import { Effect, Exit, type Fiber, ManagedRuntime, Scope, Stream, TestClock, TestContext } from 'effect'
import type { ConnectionState, NetRoom, NetRoomOptions, RoomEnd } from '../client/net-room'
import { makeNetRoom } from '../client/net-room'
import type { RoomInfo } from '../client/room-info'
import { type SeatStorage, seatTokenKey } from '../client/seat-token'
import { type FakeColyseus, fakeColyseus } from '../testing/fake-colyseus'

export const HASH_A = '0123456789abcdef'
export const HASH_B = 'fedcba9876543210'
export const GRACE_SECONDS = 30
export const SERVER_URL = 'ws://server.test'
/** Where the harness's NetRoom keeps its seat. */
export const SEAT_KEY: string = seatTokenKey(SERVER_URL)

/** A seat record as a page of this game on `url` stores it. */
export function storedSeat(code: string, token: string, url: string = SERVER_URL): string {
  return JSON.stringify({ url, schemaHash: HASH_A, contentHash: HASH_B, code, token })
}

export function memoryStorage(): SeatStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

export interface Harness {
  readonly fake: FakeColyseus
  readonly room: NetRoom
  /** The memory storage's items (empty for another storage). */
  readonly items: Map<string, string>
  /** Every connection state, in order, starting with the first. */
  readonly states: ConnectionState[]
  connection(): ConnectionState
  info(): RoomInfo | undefined
  ended(): RoomEnd | undefined
  /** Runs an effect on the harness's runtime (its TestClock). */
  run<A, E>(effect: Effect.Effect<A, E>): Promise<A>
  /** Runs an effect and returns its exit, failures included. */
  exit<A, E>(effect: Effect.Effect<A, E>): Promise<Exit.Exit<A, E>>
  /** Starts an effect without waiting for it. */
  start<A, E>(effect: Effect.Effect<A, E>): Fiber.RuntimeFiber<A, E>
  /** Moves the TestClock on, letting every fiber and promise due run. */
  advance(ms: number): Promise<void>
  /** Lets resolved promises and ready fibers run. */
  settle(): Promise<void>
  /** Closes the room's scope. */
  close(): Promise<void>
}

export async function startHarness(
  overrides: Partial<Omit<NetRoomOptions, 'storage'>> & { readonly storage?: SeatStorage | undefined } = {},
): Promise<Harness> {
  const fake = fakeColyseus()
  const storage = 'storage' in overrides ? overrides.storage : memoryStorage()
  const items = (storage as { items?: Map<string, string> } | undefined)?.items ?? new Map<string, string>()
  const scope = Effect.runSync(Scope.make())
  // One TestClock for the whole harness: the room, the test's calls and `advance` share it.
  // (TestContext sets the default services, so `Clock` and `TestClock.adjust` reach the same clock.)
  const runtime = ManagedRuntime.make(TestContext.TestContext)
  const room = await runtime.runPromise(
    makeNetRoom({
      url: SERVER_URL,
      version: { schemaHash: HASH_A, contentHash: HASH_B },
      reconnectGraceSeconds: GRACE_SECONDS,
      client: () => fake.client,
      storage,
      random: () => 0.5,
      loadToken: 'load0001',
      ...overrides,
    }).pipe(Scope.extend(scope)),
  )
  const states: ConnectionState[] = []
  runtime.runFork(
    Stream.runForEach(room.connection.changes, (state) => Effect.sync(() => states.push(state))),
  )
  const read = <A>(subscribable: { readonly get: Effect.Effect<A> }) => runtime.runSync(subscribable.get)
  const settle = async () => {
    for (let round = 0; round < 20; round += 1) {
      await Promise.resolve()
    }
  }
  await settle()
  let closed = false
  return {
    fake,
    room,
    items,
    states,
    connection: () => read(room.connection),
    info: () => read(room.info),
    ended: () => read(room.ended),
    run: (effect) => runtime.runPromise(effect),
    exit: (effect) => runtime.runPromiseExit(effect),
    start: (effect) => runtime.runFork(effect),
    async advance(ms) {
      // In steps, letting promise callbacks run between them, so a retry that awaits the SDK sleeps again before
      // the clock passes its wake-up.
      const step = 125
      for (let moved = 0; moved < ms; moved += step) {
        await runtime.runPromise(TestClock.adjust(Math.min(step, ms - moved)))
        await settle()
      }
    },
    settle,
    async close() {
      if (closed) return
      closed = true
      await runtime.runPromise(Scope.close(scope, Exit.void))
      await runtime.dispose()
    },
  }
}
