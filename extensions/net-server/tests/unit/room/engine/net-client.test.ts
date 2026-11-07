/**
 * net's client against a real room: `NetRoom` over the real Colyseus SDK and real sockets, against the server on an
 * ephemeral port. Lives in `net-server` because `net-server` already depends on `net` and owns the Colyseus harness.
 *
 * The room's clock is the test's (it steps the room), so a grace runs out on ticks; the client runs on the live clock,
 * and every wait is on something arriving (`waitFor`), never a sleep.
 */

import { createServer } from 'node:http'
import { systemClock } from '@automata/framework'
import {
  createNetRoom,
  type NetRoom,
  type NetSdkClient,
  type NetSdkRoom,
  type SeatStorage,
  seatTokenKey,
} from '@automata/net'
import { Client } from '@colyseus/sdk'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer, TEST_ORIGIN, type TestServer, waitFor } from '#src/testing/colyseus-harness.ts'

function memoryStorage(): SeatStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

type Outcome<A> = { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: unknown }

const outcome = <A>(call: Promise<A>): Promise<Outcome<A>> =>
  call.then(
    (value) => ({ ok: true, value }) as const,
    (error: unknown) => ({ ok: false, error }) as const,
  )

interface Player {
  readonly room: NetRoom
  /** Every SDK room the client was handed, in order. */
  readonly sdkRooms: NetSdkRoom[]
  readonly storage: ReturnType<typeof memoryStorage>
  read<A>(watchable: { get(): A }): A
  /** How a call came out, so a test can read a refusal without a try block. */
  run<A>(call: Promise<A>): Promise<Outcome<A>>
  close(): Promise<void>
}

let server: TestServer
let players: Player[] = []

beforeEach(async () => {
  server = await startTestServer()
})

afterEach(async () => {
  for (const player of players) await player.close()
  players = []
  await server.close()
})

async function player(
  options: {
    storage?: ReturnType<typeof memoryStorage>
    contentHash?: string
    url?: string
    /** The client's grace, in its own wall-clock seconds; generous, so a loaded machine never runs it out. */
    graceSeconds?: number
  } = {},
): Promise<Player> {
  const version = server.runtime.version
  if (version === undefined) throw new Error('the server has no version yet')
  const sdkRooms: NetSdkRoom[] = []
  const storage = options.storage ?? memoryStorage()
  // The SDK, as a browser on the listed origin uses it, with each room it hands out recorded.
  const client = (url: string): NetSdkClient => {
    const sdk = new Client(url)
    ;(sdk.http as unknown as { options: { headers: Record<string, string> } }).options.headers = {
      origin: TEST_ORIGIN,
    }
    const record = async (room: Promise<unknown>) => {
      const handed = (await room) as NetSdkRoom
      sdkRooms.push(handed)
      return handed
    }
    return {
      create: (name, join) => record(sdk.create(name, join)),
      joinById: (code, join) => record(sdk.joinById(code, join)),
      joinOrCreate: (name, join) => record(sdk.joinOrCreate(name, join)),
      reconnect: (token) => record(sdk.reconnect(token)),
    }
  }
  const room = createNetRoom({
    url: options.url ?? server.base,
    version: { schemaHash: version.schemaHash, contentHash: options.contentHash ?? version.contentHash },
    reconnectGraceSeconds: options.graceSeconds ?? 30,
    clock: systemClock,
    client,
    storage,
  })
  let closed = false
  const made: Player = {
    room,
    sdkRooms,
    storage,
    read: (watchable) => watchable.get(),
    run: outcome,
    async close() {
      if (closed) return
      closed = true
      room.close()
    },
  }
  players.push(made)
  return made
}

const codeOf = (result: Outcome<unknown>) =>
  result.ok ? undefined : (result.error as { readonly code: string }).code

/** Steps the room one tick, so it says `seated`, and waits until the player knows its seat. */
async function seated(code: string, who: Player): Promise<void> {
  await server.step(code, 1)
  await waitFor(() => who.read(who.room.info)?.you !== undefined, 'the player never learned its seat')
}

describe('NetRoom against a real room', () => {
  it('creates and joins: both players see the room and their own seats', async () => {
    const ada = await player()
    const bo = await player()
    expect((await ada.run(ada.room.create({ name: 'Ada' }))).ok).toBe(true)
    const code = ada.read(ada.room.info)?.code ?? ada.sdkRooms[0]?.roomId
    if (code === undefined) throw new Error('no room code')
    await seated(code, ada)
    expect((await bo.run(bo.room.join(code, { name: 'Bo' }))).ok).toBe(true)
    await seated(code, bo)
    await server.step(code, 3)
    await waitFor(
      () => (ada.read(ada.room.info)?.seats.length ?? 0) === 2,
      'the host never saw the second seat',
    )
    expect(ada.read(ada.room.info)).toMatchObject({ code, phase: 'lobby', you: 0, hostSeat: 0 })
    expect(bo.read(bo.room.info)).toMatchObject({ code, you: 1, hostSeat: 0 })
    expect(bo.read(bo.room.info)?.seats.map((seat) => seat.name)).toEqual(['Ada', 'Bo'])
    expect(ada.read(ada.room.connection)).toBe('connected')
    // Bytes are counted off the SDK's own socket, state patches included.
    expect(ada.room.port.bytesIn()).toBeGreaterThan(0)
  })

  it('reads a full room, an unknown code and another build by their codes', async () => {
    const ada = await player()
    await ada.run(ada.room.create({ name: 'Ada' }))
    const code = ada.sdkRooms[0]?.roomId as string
    await seated(code, ada)
    const bo = await player()
    await bo.run(bo.room.join(code, { name: 'Bo' }))
    await seated(code, bo)
    const cy = await player()
    expect(codeOf(await cy.run(cy.room.join(code, { name: 'Cy' })))).toBe('ROOM_FULL')
    expect(codeOf(await cy.run(cy.room.join('ZZZZZZ', { name: 'Cy' })))).toBe('ROOM_NOT_FOUND')
    const stale = await player({ contentHash: 'ffffffffffffffff' })
    expect(codeOf(await stale.run(stale.room.create({ name: 'Old' })))).toBe('VERSION_MISMATCH')
    expect(stale.read(stale.room.connection)).toBe('offline')
  })

  it('has its ready answered by the room', async () => {
    const ada = await player()
    await ada.run(ada.room.create({ name: 'Ada' }))
    const code = ada.sdkRooms[0]?.roomId as string
    await seated(code, ada)
    const snapshots: { tick: number; hash: string; bytes: number }[] = []
    ada.room.port.onSnapshot((snapshot) =>
      snapshots.push({ tick: snapshot.tick, hash: snapshot.hash, bytes: snapshot.bytes.length }),
    )
    const ready = outcome(ada.room.setReady(true))
    await server.step(code, 1)
    expect((await ready).ok).toBe(true)
    await server.step(code, 3)
    await waitFor(
      () => ada.read(ada.room.info)?.seats[0]?.ready === true,
      'the room never showed the seat ready',
    )
  })

  it('reconnects a dropped socket into its seat', async () => {
    const ada = await player()
    await ada.run(ada.room.create({ name: 'Ada' }))
    const code = ada.sdkRooms[0]?.roomId as string
    await seated(code, ada)
    // The socket dies without a close frame from the client's side of the story: the server holds the seat.
    ada.sdkRooms[0]?.connection.close(4999, 'test drop')
    await waitFor(() => ada.sdkRooms.length === 2, 'the client never reconnected')
    await waitFor(() => ada.read(ada.room.connection) === 'connected', 'the client never came back')
    await seated(code, ada)
    expect(ada.read(ada.room.info)).toMatchObject({ code, you: 0 })
    expect(server.room(code).engine.info().seats).toHaveLength(1)
  })

  it('finds a room by quick match, and is told the server is updating when a drain closes its lobby', async () => {
    const ada = await player()
    expect((await ada.run(ada.room.quickMatch({ name: 'Ada' }))).ok).toBe(true)
    const code = ada.sdkRooms[0]?.roomId as string
    await seated(code, ada)
    const drained = Effect.runPromise(server.runtime.drain)
    await waitFor(() => ada.read(ada.room.ended) !== undefined, 'the client never heard the room end')
    expect(ada.read(ada.room.ended)).toEqual({ reason: 'server-updating' })
    expect(ada.read(ada.room.connection)).toBe('offline')
    expect(ada.storage.items.has(seatTokenKey(server.base))).toBe(false)
    await drained
  })

  it('a reload resumes into its seat once; an expired token reports expired and is forgotten', async () => {
    const storage = memoryStorage()
    const before = await player({ storage })
    await before.run(before.room.create({ name: 'Ada' }))
    const code = before.sdkRooms[0]?.roomId as string
    await seated(code, before)
    // The page reloads: the old page's socket closes without leaving, the new page resumes on the same storage.
    await before.close()
    await waitFor(
      () => server.room(code).engine.info().seats[0]?.connected === false,
      'the room never saw the drop',
    )
    const after = await player({ storage })
    const resumed = await after.run(after.room.resume())
    expect(resumed.ok && resumed.value).toBe('resumed')
    await seated(code, after)
    expect(after.read(after.room.info)).toMatchObject({ code, you: 0 })
    const again = await after.run(after.room.resume())
    expect(again.ok && again.value).toBe('none')

    // Reload again, and let the grace run out on room ticks (one second: 60 ticks) before the new page resumes.
    await after.close()
    await waitFor(
      () => server.room(code).engine.info().seats[0]?.connected === false,
      'the room never saw the drop',
    )
    await server.step(code, 61)
    const late = await player({ storage })
    const expired = await late.run(late.room.resume())
    expect(expired.ok && expired.value).toBe('expired')
    expect(storage.items.has(seatTokenKey(server.base))).toBe(false)
    expect(late.read(late.room.connection)).toBe('offline')
  })

  it('reads a server it cannot reach as offline, and a resume against it keeps the seat', async () => {
    // A port that was open a moment ago and is closed now: nothing answers there.
    const closed = createServer()
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve))
    const address = closed.address()
    if (address === null || typeof address === 'string') throw new Error('no port')
    await new Promise<void>((resolve) => closed.close(() => resolve()))
    const url = `http://127.0.0.1:${address.port}`
    const version = server.runtime.version
    if (version === undefined) throw new Error('no version')
    const storage = memoryStorage()
    const record = JSON.stringify({
      url,
      schemaHash: version.schemaHash,
      contentHash: version.contentHash,
      code: 'ABC234',
      token: 'ABC234:held',
    })
    storage.setItem(seatTokenKey(url), record)
    const away = await player({ url, storage })
    expect(codeOf(await away.run(away.room.resume()))).toBe('OFFLINE')
    expect(storage.items.get(seatTokenKey(url))).toBe(record)
    expect(codeOf(await away.run(away.room.create({ name: 'Ada' })))).toBe('OFFLINE')
  })
})
