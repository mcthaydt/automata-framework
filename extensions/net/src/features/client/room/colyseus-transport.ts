/**
 * One Colyseus room on net's two channels.
 *
 * Everything a client says is JSON text on `NET_CHANNEL`; everything the room says is JSON text on the same channel,
 * and the snapshot or replay bytes that follow a `snap` or `replay` header arrive as binary on `NET_BYTES_CHANNEL`.
 * The transport pairs a header with the bytes after it, correlates requests with their answers, measures probes,
 * and counts bytes off the socket. It decides nothing about the room: `NetRoom` owns which room is current.
 *
 * A transport lives as long as one SDK room object. `detach` removes every listener and settles every waiting
 * request, and every handler checks `attached` first, because the SDK may already have queued a callback when the
 * room is retired (a reconnect produces a new room object, and the old one must not publish from a dead state).
 *
 * Per-message code is plain functions, no Effect (ADR 0003: a snapshot arrives 20 times a second).
 */

import type { ClientMessage } from '../../../shared/wire/client-message.schema'
import { parseServerMessage } from '../../../shared/wire/parse'
import { NET_BYTES_CHANNEL, NET_CHANNEL } from '../../../shared/wire/room'
import type { NetErrorCode } from '../../../shared/wire/server-message.schema'
import type { RequestIds } from './request-ids'
import type { NetSdkRoom } from './sdk'

/**
 * One authoritative snapshot as it arrived: core's `AuthoritativeSnapshot` (`tick`, `bytes`, `hash`), plus the
 * per-seat acks that ride beside it on net's wire (the last `seq` the room applied for each seat).
 */
export interface NetSnapshot {
  readonly tick: number
  readonly bytes: Uint8Array
  readonly hash: string
  readonly acks: Readonly<Record<string, number>>
}

/**
 * The answer to a clock probe: its id, how many ticks early (positive) or late (negative) the
 * probe arrived, and the round trip in milliseconds.
 */
export interface Pong {
  readonly id: number
  /** Ticks early (positive) or late (negative) the probe's tick arrived. */
  readonly slack: number
  readonly rttMs: number
}

export interface TransportEvents {
  seated(seat: number): void
  /** The room-info state changed; read it from the room. */
  state(): void
  snapshot(snapshot: NetSnapshot): void
  replay(bytes: Uint8Array): void
  pong(pong: Pong): void
  /** The socket closed with this code. */
  closed(code: number): void
  /** Bytes the socket delivered, Colyseus's framing and state patches included. */
  bytes(count: number): void
}

/** A correlated request without its id, which the transport assigns. */
export type RoomRequest =
  | { readonly t: 'ready'; readonly ready: boolean }
  | { readonly t: 'bot.add' | 'leave' }
  | { readonly t: 'bot.remove'; readonly seat: number }

export interface TransportOptions {
  readonly events: TransportEvents
  /** Milliseconds, for the round trip: Effect's `Clock`, read synchronously. */
  readonly now: () => number
  readonly requestIds: RequestIds
}

/** Probes still awaited past this are forgotten (a drop, a reconnect). */
const MAX_OUTSTANDING_PINGS = 16

type SocketListener = (event: { readonly data: unknown }) => void
interface CountableSocket {
  addEventListener(type: 'message', listener: SocketListener): void
  removeEventListener(type: 'message', listener: SocketListener): void
}

/** The SDK's WebSocket, where it has one: `room.connection.transport.ws` in 0.18. */
function socketOf(room: NetSdkRoom): CountableSocket | undefined {
  const ws = (room.connection.transport as { ws?: Partial<CountableSocket> } | undefined)?.ws
  return typeof ws?.addEventListener === 'function' && typeof ws.removeEventListener === 'function'
    ? (ws as CountableSocket)
    : undefined
}

function byteCount(data: unknown): number {
  if (data instanceof ArrayBuffer) return data.byteLength
  if (ArrayBuffer.isView(data)) return data.byteLength
  if (typeof data === 'string') return data.length
  return 0
}

export class ColyseusTransport {
  readonly room: NetSdkRoom
  private attached = true
  private readonly events: TransportEvents
  private readonly now: () => number
  private readonly requestIds: RequestIds
  private readonly waiting = new Map<string, (error: NetErrorCode | undefined) => void>()
  /** The header whose bytes come next, if any. */
  private header:
    | {
        readonly kind: 'snap'
        readonly tick: number
        readonly hash: string
        readonly acks: Readonly<Record<string, number>>
      }
    | { readonly kind: 'replay' }
    | undefined
  private pingId = 0
  private readonly pingsSent = new Map<number, number>()
  private readonly socket: CountableSocket | undefined
  private readonly countBytes: SocketListener

  constructor(room: NetSdkRoom, options: TransportOptions) {
    this.room = room
    this.events = options.events
    this.now = options.now
    this.requestIds = options.requestIds
    // The 0.18 SDK retries a dropped socket by itself; ours reconnects with the stored token, which also survives a
    // reload, so the SDK's loop stays off.
    room.reconnection.enabled = false
    room.onMessage(NET_CHANNEL, (payload) => {
      if (this.attached) this.receiveText(payload)
    })
    room.onMessage(NET_BYTES_CHANNEL, (payload) => {
      if (this.attached) this.receiveBytes(payload)
    })
    room.onStateChange(() => {
      if (this.attached) this.events.state()
    })
    room.onLeave((code) => {
      if (this.attached) this.events.closed(code)
    })
    // Counted off the socket itself: the SDK decodes a state patch before anything here sees it, and a decoded
    // schema has no size.
    this.countBytes = (event) => {
      if (this.attached) this.events.bytes(byteCount(event.data))
    }
    this.socket = socketOf(room)
    this.socket?.addEventListener('message', this.countBytes)
  }

  /** Fire and forget: a command or a probe is only worth anything on the tick it is sent for. */
  send(message: ClientMessage): void {
    if (!this.attached) return
    this.room.send(NET_CHANNEL, JSON.stringify(message))
  }

  /**
   * A correlated request: `done` is called once, with nothing when the room accepted it, the room's code when it
   * refused, or `OFFLINE` when the room went first. Returns the cancel, after which `done` is never called.
   */
  request(request: RoomRequest, done: (error: NetErrorCode | undefined) => void): () => void {
    if (!this.attached) {
      done('OFFLINE')
      return () => undefined
    }
    const req = this.requestIds.next()
    this.waiting.set(req, done)
    this.send({ ...request, req } as ClientMessage)
    return () => {
      this.waiting.delete(req)
    }
  }

  /** Sends a clock probe for `tick` (-1 with no clock yet) and returns its id. */
  ping(tick: number): number {
    this.pingId += 1
    const id = this.pingId
    this.pingsSent.set(id, this.now())
    if (this.pingsSent.size > MAX_OUTSTANDING_PINGS) {
      const oldest = this.pingsSent.keys().next().value
      if (oldest !== undefined) this.pingsSent.delete(oldest)
    }
    this.send({ t: 'ping', id, tick: Number.isFinite(tick) && tick >= 0 ? tick : -1 })
    return id
  }

  /** Lets go of the room: no listener stays, and every waiting request is settled `OFFLINE`. Idempotent. */
  detach(): void {
    if (!this.attached) return
    this.attached = false
    this.socket?.removeEventListener('message', this.countBytes)
    this.room.removeAllListeners()
    const waiting = [...this.waiting.values()]
    this.waiting.clear()
    for (const done of waiting) done('OFFLINE')
  }

  private receiveText(payload: unknown): void {
    if (typeof payload !== 'string') return
    const parsed = parseServerMessage(payload)
    if (!parsed.ok) return
    const message = parsed.message
    switch (message.t) {
      case 'seated':
        this.events.seated(message.seat)
        return
      case 'answer': {
        const done = this.waiting.get(message.req)
        if (done === undefined) return
        this.waiting.delete(message.req)
        done(message.error)
        return
      }
      case 'snap':
        this.header = { kind: 'snap', tick: message.tick, hash: message.hash, acks: message.acks }
        return
      case 'replay':
        this.header = { kind: 'replay' }
        return
      case 'pong': {
        const sentAt = this.pingsSent.get(message.id)
        if (sentAt === undefined) return
        this.pingsSent.delete(message.id)
        this.events.pong({ id: message.id, slack: message.slack, rttMs: this.now() - sentAt })
        return
      }
    }
  }

  private receiveBytes(payload: unknown): void {
    const header = this.header
    this.header = undefined
    if (header === undefined || !(payload instanceof Uint8Array)) return
    // Copied: the SDK hands a view into its receive buffer.
    const bytes = new Uint8Array(payload)
    if (header.kind === 'replay') this.events.replay(bytes)
    else this.events.snapshot({ tick: header.tick, hash: header.hash, acks: header.acks, bytes })
  }
}
