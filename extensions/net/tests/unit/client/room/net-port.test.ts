import type { Command } from '@automata/sim'
import { describe, expect, it } from 'vitest'
import { ColyseusTransport, type TransportEvents } from '#src/features/client/room/colyseus-transport.ts'
import { createClientPort } from '#src/features/client/room/net-port.ts'
import { createRequestIds } from '#src/features/client/room/request-ids.ts'
import { NET_CHANNEL } from '#src/shared/wire/room.ts'
import { fakeColyseus } from '#src/testing/fake-colyseus.ts'

// The client end of core's `NetworkPort` (PRODUCT.1; M7 spec §4.2): local commands out, authoritative snapshots in.
// It outlives any one room, so a reconnect keeps every listener.

const HASH = '0123456789abcdef'
const command: Command = { tick: 12, source: 3, seq: 4, type: 'move', payload: { dx: 1 } }

/** The room events the port does not take (`NetRoom` does). */
const quiet = { seated: () => undefined, state: () => undefined, closed: () => undefined }

function transportFor(portEvents: Omit<TransportEvents, keyof typeof quiet>) {
  const events: TransportEvents = { ...quiet, ...portEvents }
  const room = fakeColyseus().room()
  return {
    room,
    transport: new ColyseusTransport(room, { events, now: () => 0, requestIds: createRequestIds('l') }),
  }
}

describe('the client network port', () => {
  it('sends a local command on the current room, without its source: the room stamps the seat', () => {
    const hub = createClientPort()
    const { room, transport } = transportFor(hub.events)
    hub.attach(transport)
    hub.port.sendCommand(command)
    expect(room.sent).toEqual([
      {
        type: NET_CHANNEL,
        payload: JSON.stringify({ t: 'cmd', seq: 4, tick: 12, type: 'move', payload: { dx: 1 } }),
      },
    ])
  })

  it('drops a command with no room, and never throws', () => {
    const hub = createClientPort()
    expect(() => hub.port.sendCommand(command)).not.toThrow()
    expect(hub.port.ping(1)).toBeUndefined()
  })

  it('keeps its snapshot listeners across rooms, and an unsubscribed one hears nothing', () => {
    const hub = createClientPort()
    const ticks: number[] = []
    const gone: number[] = []
    hub.port.onSnapshot((snapshot) => ticks.push(snapshot.tick))
    const off = hub.port.onSnapshot((snapshot) => gone.push(snapshot.tick))
    const first = transportFor(hub.events)
    hub.attach(first.transport)
    first.room.message({ t: 'snap', tick: 3, hash: HASH, acks: {} })
    first.room.bytes(new Uint8Array([1]))
    off()
    const second = transportFor(hub.events)
    hub.attach(second.transport)
    second.room.message({ t: 'snap', tick: 6, hash: HASH, acks: {} })
    second.room.bytes(new Uint8Array([1]))
    expect(ticks).toEqual([3, 6])
    expect(gone).toEqual([3])
  })

  it('is a client end: it hears no remote commands and publishes nothing', () => {
    const hub = createClientPort()
    const { room, transport } = transportFor(hub.events)
    hub.attach(transport)
    const heard: Command[] = []
    hub.port.onRemoteCommand((remote) => heard.push(remote))
    hub.port.publishSnapshot({ tick: 1, bytes: new Uint8Array(), hash: HASH })
    expect(heard).toEqual([])
    expect(room.sent).toEqual([])
  })

  it('measures the round trip as the median of the last seven probes', () => {
    let time = 0
    const hub = createClientPort()
    const room = fakeColyseus().room()
    hub.attach(
      new ColyseusTransport(room, {
        events: { ...quiet, ...hub.events },
        now: () => time,
        requestIds: createRequestIds('l'),
      }),
    )
    expect(hub.port.roundTripMs()).toBeUndefined()
    const pongs: number[] = []
    hub.port.onPong((pong) => pongs.push(pong.rttMs))
    for (const rtt of [90, 10, 50, 20, 80, 30, 70, 60]) {
      const id = hub.port.ping(5) as number
      time += rtt
      room.message({ t: 'pong', id, slack: 0 })
    }
    expect(pongs).toHaveLength(8)
    // The first (90) has aged out: the median of 10, 50, 20, 80, 30, 70, 60.
    expect(hub.port.roundTripMs()).toBe(50)
  })

  it('counts every byte across rooms', () => {
    const hub = createClientPort()
    const first = transportFor(hub.events)
    hub.attach(first.transport)
    first.room.socketData('abcd')
    const second = transportFor(hub.events)
    hub.attach(second.transport)
    second.room.socketData(new Uint8Array(6))
    expect(hub.port.bytesIn()).toBe(10)
  })

  it('hands on the replay', () => {
    const hub = createClientPort()
    const { room, transport } = transportFor(hub.events)
    hub.attach(transport)
    const replays: Uint8Array[] = []
    hub.port.onReplay((bytes) => replays.push(bytes))
    room.message({ t: 'replay' })
    room.bytes(new Uint8Array([9]))
    expect(replays).toEqual([new Uint8Array([9])])
  })

  it('once closed, tells no listener anything and takes no new one', () => {
    const hub = createClientPort()
    const { room, transport } = transportFor(hub.events)
    hub.attach(transport)
    const early: number[] = []
    hub.port.onSnapshot((snapshot) => early.push(snapshot.tick))
    hub.close()
    const late: number[] = []
    hub.port.onSnapshot((snapshot) => late.push(snapshot.tick))
    hub.events.snapshot({ tick: 9, hash: HASH, acks: {}, bytes: new Uint8Array() })
    hub.port.sendCommand(command)
    expect(early).toEqual([])
    expect(late).toEqual([])
    expect(room.sent).toEqual([])
  })
})
