import { Clock, type Effect, ManagedRuntime, TestClock, TestContext } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import type { NetSnapshot, Pong } from '../client/colyseus-transport'
import { parseClientMessage } from '../wire/parse'
import { createLink, type LinkOptions, type WireData } from './link'
import { linkClient, linkRoomClient } from './link-client'

// net's wire over a seeded link (M7 spec §4.7, §12 "deterministic network"): the client end is the real transport and
// client port over a link-backed SDK room, the room end is what `server`'s room engine sends to, and a snapshot header
// and its bytes cross the link as one frame.

const quiet: LinkOptions = { seed: 3, latencyMs: 50, jitterMs: 0, loss: 0, duplicate: 0, reorder: 0 }
let runtimes: ManagedRuntime.ManagedRuntime<never, never>[] = []
afterEach(async () => {
  for (const runtime of runtimes) await runtime.dispose()
  runtimes = []
})

function setup(options: LinkOptions = quiet) {
  const runtime = ManagedRuntime.make(TestContext.TestContext)
  runtimes.push(runtime)
  const run = (effect: Effect.Effect<void>): void => runtime.runSync(effect)
  const now = (): number => runtime.runSync(Clock.currentTimeMillis)
  const link = createLink(options)
  const client = linkClient(link.client, { run, now })
  const room = linkRoomClient(link.server, run)
  const atRoom: WireData[] = []
  link.server.onMessage((data) => atRoom.push(data))
  const advance = (ms: number) => runtime.runPromise(TestClock.adjust(ms))
  return { runtime, run, now, client, room, atRoom, advance }
}

describe('the link client', () => {
  it("delivers a room's snapshot header and bytes as one snapshot with its acks", async () => {
    const { client, room, advance } = setup()
    const got: NetSnapshot[] = []
    client.port.onSnapshot((snapshot) => got.push(snapshot))
    room.send({ t: 'snap', tick: 9, hash: '0123456789abcdef', acks: { '0': 4 } })
    room.sendBytes(new Uint8Array([1, 2, 3]))
    await advance(50)
    expect(got).toEqual([
      { tick: 9, hash: '0123456789abcdef', acks: { '0': 4 }, bytes: new Uint8Array([1, 2, 3]) },
    ])
  })

  it('delivers the replay that follows a replay header, and nothing for bytes without a header', async () => {
    const { client, room, advance } = setup()
    const replays: Uint8Array[] = []
    const snapshots: NetSnapshot[] = []
    client.port.onReplay((bytes) => replays.push(bytes))
    client.port.onSnapshot((snapshot) => snapshots.push(snapshot))
    room.sendBytes(new Uint8Array([7]))
    room.send({ t: 'replay' })
    room.sendBytes(new Uint8Array([8, 9]))
    await advance(50)
    expect(replays).toEqual([new Uint8Array([8, 9])])
    expect(snapshots).toEqual([])
  })

  it("learns its seat from the room, and measures a probe's round trip on the clock", async () => {
    const { client, room, atRoom, advance } = setup()
    room.send({ t: 'seated', seat: 1 })
    const id = client.port.ping(12.5) as number
    await advance(50)
    expect(client.seat()).toBe(1)
    expect(atRoom.map((data) => parseClientMessage(String(data)))).toEqual([
      { ok: true, message: { t: 'ping', id, tick: 12.5 } },
    ])

    const pongs: Pong[] = []
    client.port.onPong((pong) => pongs.push(pong))
    room.send({ t: 'pong', id, slack: 3 })
    await advance(50)
    expect(pongs).toEqual([{ id, slack: 3, rttMs: 100 }])
  })

  it('sends commands to the room as wire text, without their source', async () => {
    const { client, atRoom, advance } = setup()
    client.port.sendCommand({ tick: 20, source: 7, seq: 2, type: 'move', payload: { dx: 1 } })
    await advance(50)
    expect(atRoom.map((data) => JSON.parse(String(data)))).toEqual([
      { t: 'cmd', seq: 2, tick: 20, type: 'move', payload: { dx: 1 } },
    ])
  })

  it('drops everything while detached, and keeps its listeners on the next link', async () => {
    const { client, room, atRoom, advance, run } = setup()
    const got: NetSnapshot[] = []
    client.port.onSnapshot((snapshot) => got.push(snapshot))
    client.detach()
    client.port.sendCommand({ tick: 1, source: 0, seq: 0, type: 'move', payload: { dx: 1 } })
    room.send({ t: 'snap', tick: 3, hash: '0123456789abcdef', acks: {} })
    room.sendBytes(new Uint8Array([1]))
    await advance(50)
    expect(atRoom).toEqual([])
    expect(got).toEqual([])

    const next = createLink({ ...quiet, seed: 4 })
    const nextRoom = linkRoomClient(next.server, run)
    const nextAtRoom: WireData[] = []
    next.server.onMessage((data) => nextAtRoom.push(data))
    client.attach(next.client)
    client.port.sendCommand({ tick: 2, source: 0, seq: 1, type: 'move', payload: { dx: 1 } })
    nextRoom.send({ t: 'snap', tick: 6, hash: '0123456789abcdef', acks: {} })
    nextRoom.sendBytes(new Uint8Array([2]))
    await advance(50)
    expect(nextAtRoom).toHaveLength(1)
    expect(got.map((snapshot) => snapshot.tick)).toEqual([6])
  })

  it('closes: the room end sends nothing more', async () => {
    const { client, room, advance } = setup()
    const got: NetSnapshot[] = []
    client.port.onSnapshot((snapshot) => got.push(snapshot))
    room.close()
    expect(room.closed).toBe(true)
    room.send({ t: 'snap', tick: 3, hash: '0123456789abcdef', acks: {} })
    room.sendBytes(new Uint8Array([1]))
    await advance(50)
    expect(got).toEqual([])
  })
})
