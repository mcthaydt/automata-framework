/**
 * net's wire over a seeded link, so a room and its clients run on a fake clock with every delay, loss, duplicate and
 * reorder drawn from a seed.
 *
 * The client end is the real client: `ColyseusTransport` and the client port, over an SDK room whose messages come
 * from the link. The room end has the shape of `server`'s `RoomClient` (`send`, `sendBytes`, `close`), so the room
 * engine sends to it as to a socket. A `snap` or `replay` header and the bytes after it cross the link as one frame:
 * a socket delivers both or neither, in order, and the link's loss and reorder model whole frames.
 *
 * Test support, not a client: the headless client is a separate piece.
 */

import { ColyseusTransport } from '../features/client/room/colyseus-transport'
import { type ClientNetworkPort, createClientPort } from '../features/client/room/net-port'
import { createRequestIds } from '../features/client/room/request-ids'
import type { NetSdkRoom } from '../features/client/room/sdk'
import { NET_BYTES_CHANNEL, NET_CHANNEL } from '../shared/wire/room'
import type { ServerMessage } from '../shared/wire/server-message.schema'
import type { Transport, WireData } from './link'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** One frame: a 4-byte big-endian header length, the header's JSON, then the bytes. */
function frame(header: string, bytes: Uint8Array): Uint8Array {
  const text = encoder.encode(header)
  const out = new Uint8Array(4 + text.length + bytes.length)
  new DataView(out.buffer).setUint32(0, text.length)
  out.set(text, 4)
  out.set(bytes, 4 + text.length)
  return out
}

function unframe(data: Uint8Array): { readonly header: string; readonly bytes: Uint8Array } | undefined {
  if (data.length < 4) return undefined
  const length = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0)
  if (4 + length > data.length) return undefined
  return { header: decoder.decode(data.subarray(4, 4 + length)), bytes: data.subarray(4 + length) }
}

export interface LinkClient {
  /** The client port, kept across `attach`, as `NetRoom`'s is across a reconnect. */
  readonly port: ClientNetworkPort
  /** The seat the room's last `seated` said. */
  seat(): number | undefined
  /** Talks over another link from now on (a reconnect), keeping every listener. */
  attach(transport: Transport): void
  /** Talks over no link: commands are dropped and nothing arrives (a drop). */
  detach(): void
}

/** An SDK room whose messages come from `transport`, for `ColyseusTransport`. */
function linkSdkRoom(transport: Transport): NetSdkRoom {
  const handlers = new Map<string, (payload: unknown) => void>()
  let off: (() => void) | undefined = transport.onMessage((data: WireData) => {
    if (typeof data === 'string') {
      handlers.get(NET_CHANNEL)?.(data)
      return
    }
    const parts = unframe(data)
    if (parts === undefined) return
    handlers.get(NET_CHANNEL)?.(parts.header)
    handlers.get(NET_BYTES_CHANNEL)?.(parts.bytes)
  })
  return {
    roomId: 'LINK00',
    reconnectionToken: '',
    reconnection: { enabled: false },
    state: undefined,
    connection: { close: () => undefined },
    onMessage(type, handler) {
      handlers.set(type, handler)
    },
    onStateChange: () => undefined,
    onLeave: () => undefined,
    send(_type, payload) {
      if (off !== undefined && typeof payload === 'string') transport.send(payload)
    },
    leave: () => Promise.resolve(4000),
    removeAllListeners() {
      handlers.clear()
      off?.()
      off = undefined
    },
  }
}

export function linkClient(transport: Transport, options: { readonly now: () => number }): LinkClient {
  const hub = createClientPort()
  const requestIds = createRequestIds('link0001')
  let seat: number | undefined
  let current: ColyseusTransport | undefined
  const attach = (next: Transport): void => {
    current?.detach()
    current = new ColyseusTransport(linkSdkRoom(next), {
      events: {
        ...hub.events,
        seated: (value) => {
          seat = value
        },
        state: () => undefined,
        closed: () => undefined,
      },
      now: options.now,
      requestIds,
    })
    hub.attach(current)
  }
  attach(transport)
  return {
    port: hub.port,
    seat: () => seat,
    attach,
    detach() {
      current?.detach()
      current = undefined
      hub.attach(undefined)
    },
  }
}

export interface LinkRoomClient {
  send(message: ServerMessage): void
  sendBytes(bytes: Uint8Array): void
  /** Ends the connection: nothing more is sent. */
  close(): void
  readonly closed: boolean
}

/** The room's end of a link, in the shape of `server`'s `RoomClient`. */
export function linkRoomClient(transport: Transport): LinkRoomClient {
  let header: string | undefined
  let closed = false
  return {
    send(message) {
      if (closed) return
      const text = JSON.stringify(message)
      if (message.t === 'snap' || message.t === 'replay') header = text
      else transport.send(text)
    },
    sendBytes(bytes) {
      const held = header
      header = undefined
      if (closed || held === undefined) return
      transport.send(frame(held, bytes))
    },
    close() {
      closed = true
    },
    get closed() {
      return closed
    },
  }
}
