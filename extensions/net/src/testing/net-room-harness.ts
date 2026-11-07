/**
 * Runs a `NetRoom` over `net/testing`'s fake SDK on a fake clock a test closes. Nothing waits on a real timer: time
 * moves only by `advance`, and `settle` lets promise callbacks already resolved run.
 */

import { type FakeClock, fakeClock } from '@automata/framework/testing'
import type { NetError } from '../features/client/room/net-error'
import type { ConnectionState, NetRoom, NetRoomOptions, RoomEnd } from '../features/client/room/net-room'
import { createNetRoom } from '../features/client/room/net-room'
import type { RoomInfo } from '../features/client/room/room-info'
import { type SeatStorage, seatTokenKey } from '../features/client/room/seat-token'
import { type FakeColyseus, fakeColyseus } from './fake-colyseus'

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

/** What a call that may fail came to, without a rejection nobody has caught yet. */
export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: unknown }

/** Starts waiting on a call, so a test can move time before it reads how the call ended. */
export function outcome<T>(call: Promise<T>): Promise<Outcome<T>> {
  return call.then(
    (value) => ({ ok: true, value }),
    (error: unknown) => ({ ok: false, error }),
  )
}

/** The error a started call was rejected with, or undefined if it succeeded. */
export const rejected = (result: Outcome<unknown>): unknown => (result.ok ? undefined : result.error)

/** The `NetError` a call rejects with; fails the test if the call succeeds or rejects with something else. */
export async function failure(call: Promise<unknown>): Promise<NetError> {
  const result = await outcome(call)
  if (result.ok) throw new Error('expected the call to fail, but it succeeded')
  if ((result.error as Error | undefined)?.name !== 'NetError') throw result.error
  return result.error as NetError
}

export interface Harness {
  readonly fake: FakeColyseus
  readonly room: NetRoom
  /** The clock the room runs on; `advance` moves it. */
  readonly clock: FakeClock
  /** The memory storage's items (empty for another storage). */
  readonly items: Map<string, string>
  /** Every connection state, in order, starting with the first. */
  readonly states: ConnectionState[]
  connection(): ConnectionState
  info(): RoomInfo | undefined
  ended(): RoomEnd | undefined
  /** Moves the clock on, letting every promise a timer resolves run before the next step. */
  advance(ms: number): Promise<void>
  /** Lets resolved promises run. */
  settle(): Promise<void>
  /** Closes the room (not leaving it). */
  close(): Promise<void>
}

export async function startHarness(
  overrides: Partial<Omit<NetRoomOptions, 'storage'>> & {
    readonly storage?: SeatStorage | null | undefined
  } = {},
): Promise<Harness> {
  const fake = fakeColyseus()
  const storage = overrides.storage === undefined ? memoryStorage() : overrides.storage
  const items = (storage as { items?: Map<string, string> } | undefined)?.items ?? new Map<string, string>()
  const clock = fakeClock()
  const room = createNetRoom({
    url: SERVER_URL,
    version: { schemaHash: HASH_A, contentHash: HASH_B },
    reconnectGraceSeconds: GRACE_SECONDS,
    clock,
    client: () => fake.client,
    storage,
    random: () => 0.5,
    loadToken: 'load0001',
    ...overrides,
  })
  const states: ConnectionState[] = [room.connection.get()]
  room.connection.subscribe((state) => states.push(state))
  const settle = async () => {
    for (let round = 0; round < 20; round += 1) {
      await Promise.resolve()
    }
  }
  await settle()
  return {
    fake,
    room,
    clock,
    items,
    states,
    connection: () => room.connection.get(),
    info: () => room.info.get(),
    ended: () => room.ended.get(),
    async advance(ms) {
      // In steps, letting promise callbacks run between them, so a retry that awaits the SDK sleeps again before
      // the clock passes its wake-up.
      const step = 125
      for (let moved = 0; moved < ms; moved += step) {
        clock.advance(Math.min(step, ms - moved))
        await settle()
      }
    },
    settle,
    async close() {
      room.close()
      await settle()
    },
  }
}
