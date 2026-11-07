import { describe, expect, it } from 'vitest'
import {
  ColyseusTransport,
  type NetSnapshot,
  type TransportEvents,
} from '#src/features/client/room/colyseus-transport.ts'
import { createRequestIds } from '#src/features/client/room/request-ids.ts'
import { NET_BYTES_CHANNEL, NET_CHANNEL } from '#src/shared/wire/room.ts'
import { fakeColyseus } from '#src/testing/fake-colyseus.ts'

// One SDK room on net's two channels (M7 spec §4.2 wire; FloorFifty `colyseus-network.ts` `adopt`, `command`,
// `sendPing`). The ported cases name their FloorFifty original.

const HASH = '0123456789abcdef'

function setup() {
  const fake = fakeColyseus()
  const room = fake.room()
  const seen = {
    seated: [] as number[],
    states: 0,
    snapshots: [] as NetSnapshot[],
    replays: [] as Uint8Array[],
    pongs: [] as { id: number; slack: number; rttMs: number }[],
    closed: [] as number[],
    bytes: 0,
  }
  const events: TransportEvents = {
    seated: (seat) => seen.seated.push(seat),
    state: () => {
      seen.states += 1
    },
    snapshot: (snapshot) => seen.snapshots.push(snapshot),
    replay: (bytes) => seen.replays.push(bytes),
    pong: (pong) => seen.pongs.push(pong),
    closed: (code) => seen.closed.push(code),
    bytes: (count) => {
      seen.bytes += count
    },
  }
  let time = 1_000
  const transport = new ColyseusTransport(room, {
    events,
    now: () => time,
    requestIds: createRequestIds('load'),
  })
  const sentOn = (channel: string) =>
    room.sent.filter((entry) => entry.type === channel).map((entry) => JSON.parse(entry.payload as string))
  return {
    room,
    transport,
    seen,
    sentOn,
    advance: (ms: number) => {
      time += ms
    },
  }
}

describe('the Colyseus transport', () => {
  it("turns off the SDK's own reconnect loop, so a drop reaches ours", () => {
    const { room } = setup()
    expect(room.reconnection.enabled).toBe(false)
  })

  it('sends a command fire and forget, as JSON text on net’s channel', () => {
    // FloorFifty "sends input fire-and-forget".
    const { transport, sentOn } = setup()
    transport.send({ t: 'cmd', seq: 1, tick: 40, type: 'move', payload: { dx: 1 } })
    expect(sentOn(NET_CHANNEL)).toEqual([{ t: 'cmd', seq: 1, tick: 40, type: 'move', payload: { dx: 1 } }])
  })

  it('resolves a correlated request only when its own answer arrives', () => {
    const { room, transport, sentOn } = setup()
    const results: (string | undefined)[] = []
    transport.request({ t: 'ready', ready: true }, (error) => results.push(error ?? 'ok'))
    const req = sentOn(NET_CHANNEL)[0].req as string
    room.message({ t: 'answer', req: 'someone-else' })
    expect(results).toEqual([])
    room.message({ t: 'answer', req })
    room.message({ t: 'answer', req })
    expect(results).toEqual(['ok'])
  })

  it('rejects a refused request with the room’s code', () => {
    // FloorFifty "rejects a refused command and reports the error to subscribers".
    const { room, transport, sentOn } = setup()
    const results: (string | undefined)[] = []
    transport.request({ t: 'bot.add' }, (error) => results.push(error))
    room.message({ t: 'answer', req: sentOn(NET_CHANNEL)[0].req, error: 'REFUSED' })
    expect(results).toEqual(['REFUSED'])
  })

  it('numbers each request afresh, and a cancelled request is never settled', () => {
    const { room, transport, sentOn } = setup()
    const results: (string | undefined)[] = []
    const cancel = transport.request({ t: 'bot.remove', seat: 2 }, (error) => results.push(error ?? 'ok'))
    transport.request({ t: 'leave' }, () => undefined)
    const [first, second] = sentOn(NET_CHANNEL)
    expect(first).toMatchObject({ t: 'bot.remove', seat: 2 })
    expect(first.req).not.toBe(second.req)
    cancel()
    room.message({ t: 'answer', req: first.req })
    expect(results).toEqual([])
  })

  it('settles every waiting request as offline when it detaches, so no caller hangs on a lost answer', () => {
    // FloorFifty "rejects a command whose answer was lost when the room is left" and "… on dispose".
    const { transport } = setup()
    const results: (string | undefined)[] = []
    transport.request({ t: 'ready', ready: false }, (error) => results.push(error))
    transport.detach()
    expect(results).toEqual(['OFFLINE'])
  })

  it('tells its seat from the seated message', () => {
    const { room, seen } = setup()
    room.message({ t: 'seated', seat: 2 })
    expect(seen.seated).toEqual([2])
  })

  it('delivers a snapshot header and the bytes after it as one snapshot, with the acks, the bytes copied', () => {
    const { room, seen } = setup()
    const bytes = new Uint8Array([1, 2, 3])
    room.message({ t: 'snap', tick: 30, hash: HASH, acks: { '0': 4 } })
    room.bytes(bytes)
    bytes[0] = 9
    expect(seen.snapshots).toEqual([
      { tick: 30, hash: HASH, acks: { '0': 4 }, bytes: new Uint8Array([1, 2, 3]) },
    ])
  })

  it('delivers nothing for bytes with no header before them', () => {
    const { room, seen } = setup()
    room.bytes(new Uint8Array([1]))
    room.message({ t: 'snap', tick: 30, hash: HASH, acks: {} })
    room.message({ t: 'snap', tick: 33, hash: HASH, acks: {} })
    room.bytes(new Uint8Array([2]))
    room.bytes(new Uint8Array([3]))
    // The second header replaced the first, whose bytes never came; the stray bytes are dropped.
    expect(seen.snapshots.map((snapshot) => snapshot.tick)).toEqual([33])
  })

  it('delivers the replay after its header', () => {
    const { room, seen } = setup()
    room.message({ t: 'replay' })
    room.bytes(new Uint8Array([7, 7]))
    expect(seen.replays).toEqual([new Uint8Array([7, 7])])
    expect(seen.snapshots).toEqual([])
  })

  it('ignores a message that fails the wire schema', () => {
    const { room, seen } = setup()
    room.message('{"t":"seated","seat":1,"extra":true}')
    room.message('{nope')
    room.message({ t: 'seated', seat: 1 })
    expect(seen.seated).toEqual([1])
  })

  it('probes the room, measures the round trip, and reports the room’s slack', () => {
    // FloorFifty "probes the room, measures the round trip, and reports the room's slack".
    const { room, transport, seen, sentOn, advance } = setup()
    const id = transport.ping(123.5)
    expect(sentOn(NET_CHANNEL)).toEqual([{ t: 'ping', id, tick: 123.5 }])
    advance(40)
    room.message({ t: 'pong', id, slack: 2 })
    expect(seen.pongs).toEqual([{ id, slack: 2, rttMs: 40 }])
    // An answer to a probe it never sent, or one already answered, is ignored.
    room.message({ t: 'pong', id, slack: 9 })
    room.message({ t: 'pong', id: 999, slack: 9 })
    expect(seen.pongs).toHaveLength(1)
  })

  it('sends a probe with no clock yet as -1', () => {
    const { transport, sentOn } = setup()
    transport.ping(Number.NaN)
    expect(sentOn(NET_CHANNEL)[0]).toMatchObject({ tick: -1 })
  })

  it('reports a state patch and a close', () => {
    const { room, seen } = setup()
    room.patch({})
    room.close(1006)
    expect(seen.states).toBe(1)
    expect(seen.closed).toEqual([1006])
  })

  it('counts every byte the socket delivers', () => {
    const { room, seen } = setup()
    room.socketData(new ArrayBuffer(10))
    room.socketData(new Uint8Array(5))
    room.socketData('abc')
    room.socketData(42)
    expect(seen.bytes).toBe(18)
  })

  it('ignores callbacks already queued by a room it detached from, and stops counting', () => {
    // FloorFifty "ignores callbacks already queued by a retired room, including command replies and close".
    const { room, transport, seen, sentOn } = setup()
    const results: (string | undefined)[] = []
    transport.request({ t: 'ready', ready: true }, (error) => results.push(error))
    const req = sentOn(NET_CHANNEL)[0].req
    transport.detach()
    expect(room.listening).toBe(false)
    room.queued(NET_CHANNEL, JSON.stringify({ t: 'answer', req }))
    room.queued(NET_CHANNEL, JSON.stringify({ t: 'seated', seat: 1 }))
    room.queued(NET_CHANNEL, JSON.stringify({ t: 'snap', tick: 3, hash: HASH, acks: {} }))
    room.queued(NET_BYTES_CHANNEL, new Uint8Array([1]))
    room.queued('state', {})
    room.queued('leave', 1006)
    room.socketData('abc')
    expect(seen).toMatchObject({ seated: [], snapshots: [], states: 0, closed: [], bytes: 0 })
    expect(results).toEqual(['OFFLINE'])
    transport.send({ t: 'ping', id: 1, tick: 1 })
    expect(sentOn(NET_CHANNEL)).toHaveLength(1)
  })
})
