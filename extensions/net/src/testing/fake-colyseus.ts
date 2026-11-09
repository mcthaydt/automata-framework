/**
 * A scripted Colyseus SDK for the net client's tests.
 *
 * A fake room records what the client sends and lets a test play the room's side: a wire message, the bytes that
 * follow a header, a state patch, a close. The fake client answers each matchmaking call with the next scripted
 * outcome for that call, or by default with a fresh room. Nothing here waits on a timer.
 */

import type { NetSdkClient, NetSdkRoom } from '../features/client/room/sdk'
import { NET_BYTES_CHANNEL, NET_CHANNEL } from '../shared/wire/room'
import type { ServerMessage } from '../shared/wire/server-message.schema'

type Listener = (event: { readonly data: unknown }) => void

/** A socket stand-in the client may count bytes from, as it does the SDK's WebSocket. */
export interface FakeSocket {
  addEventListener(type: 'message', listener: Listener): void
  removeEventListener(type: 'message', listener: Listener): void
  readonly listeners: number
}

/**
 * A stand-in for the SDK's room. It records every send, leave and close, and lets a test push
 * messages and state to the client.
 */
export interface FakeRoom extends NetSdkRoom {
  roomId: string
  reconnectionToken: string
  /** Every `send`, in order: the type and the payload as sent. */
  readonly sent: { readonly type: string; readonly payload: unknown }[]
  /** Every `leave` call's `consented`. */
  readonly leaves: boolean[]
  /** Every `connection.close` call. */
  readonly closes: number
  readonly socket: FakeSocket
  /** Whether any handler is still attached. */
  readonly listening: boolean
  /** A wire message on net's channel, as the room sends it (JSON text), or raw text. */
  message(message: ServerMessage | string): void
  /** Binary on net's bytes channel. */
  bytes(bytes: Uint8Array): void
  /** Replaces the room-info state and announces the change. */
  patch(state: unknown): void
  /** The socket closes with `code`, as the SDK reports it to `onLeave`. */
  close(code: number): void
  /** Raw data on the socket, for the byte count. */
  socketData(data: unknown): void
  /**
   * A callback the SDK had already queued: runs the last handler registered for `channel` (`'leave'` for the close
   * handler) even if the client has since removed it.
   */
  queued(channel: string, payload: unknown): void
}

/** What a fake matchmaking call answers: a room, an error, or a promise of a room. */
export type FakeOutcome = FakeRoom | Error | Promise<FakeRoom>
type Method = 'create' | 'joinById' | 'joinOrCreate' | 'reconnect'

/**
 * A stand-in for the SDK client. It records every matchmaking call, hands out fake rooms, and lets
 * a test choose the next answer.
 */
export interface FakeColyseus {
  readonly client: NetSdkClient
  /** Every matchmaking call: the method and its arguments. */
  readonly calls: { readonly method: Method; readonly args: readonly unknown[] }[]
  /** Every room the fake client handed out, in order. */
  readonly rooms: FakeRoom[]
  /** A room the test may hand out itself. */
  room(code?: string): FakeRoom
  /** The next `method` call answers with `outcome`; queued in order. */
  respond(method: Method, outcome: FakeOutcome): void
  /** Every `method` call with nothing queued answers with `outcome`. */
  respondAlways(method: Method, outcome: FakeOutcome | undefined): void
  /** The room-info state a fresh room starts with. */
  state(code: string, extra?: Record<string, unknown>): Record<string, unknown>
}

let tokenSerial = 0

/** Makes a fake SDK client for tests, so `createNetRoom` runs without a network. */
export function fakeColyseus(): FakeColyseus {
  const calls: FakeColyseus['calls'] = []
  const rooms: FakeRoom[] = []
  const queued = new Map<Method, FakeOutcome[]>()
  const always = new Map<Method, FakeOutcome>()

  const state = (code: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    code,
    phase: 'lobby',
    hostSeat: 0,
    seats: [{ seat: 0, name: 'Ada', ready: false, connected: true, bot: false }],
    ...extra,
  })

  const room = (code = 'ABC234'): FakeRoom => {
    const messageHandlers = new Map<string, (payload: unknown) => void>()
    const stateHandlers: ((state: unknown) => void)[] = []
    const leaveHandlers: ((code: number) => void)[] = []
    const socketListeners = new Set<Listener>()
    const lastRegistered = new Map<string, (payload: never) => void>()
    let current: unknown = state(code)
    let closes = 0
    const socket: FakeSocket = {
      addEventListener: (_type, listener) => socketListeners.add(listener),
      removeEventListener: (_type, listener) => socketListeners.delete(listener),
      get listeners() {
        return socketListeners.size
      },
    }
    tokenSerial += 1
    const fake: FakeRoom = {
      roomId: code,
      reconnectionToken: `${code}:token-${tokenSerial}`,
      reconnection: { enabled: true },
      get state() {
        return current
      },
      connection: {
        close: () => {
          closes += 1
        },
        transport: { ws: socket },
      },
      sent: [],
      leaves: [],
      get closes() {
        return closes
      },
      socket,
      get listening() {
        return messageHandlers.size + stateHandlers.length + leaveHandlers.length + socketListeners.size > 0
      },
      onMessage(type, handler) {
        messageHandlers.set(type, handler)
        lastRegistered.set(type, handler)
      },
      onStateChange(handler) {
        stateHandlers.push(handler)
        lastRegistered.set('state', handler)
      },
      onLeave(handler) {
        leaveHandlers.push(handler)
        lastRegistered.set('leave', handler)
      },
      send(type, payload) {
        fake.sent.push({ type, payload })
      },
      // The SDK's own order: a leave calls every `onLeave` handler before its promise resolves.
      async leave(consented = true) {
        fake.leaves.push(consented)
        const closeCode = consented ? 4000 : 1006
        for (const handler of [...leaveHandlers]) handler(closeCode)
        return closeCode
      },
      removeAllListeners() {
        messageHandlers.clear()
        stateHandlers.length = 0
        leaveHandlers.length = 0
      },
      message(message) {
        messageHandlers.get(NET_CHANNEL)?.(typeof message === 'string' ? message : JSON.stringify(message))
      },
      bytes(bytes) {
        messageHandlers.get(NET_BYTES_CHANNEL)?.(bytes)
      },
      patch(next) {
        current = next
        for (const handler of [...stateHandlers]) handler(next)
      },
      close(closeCode) {
        for (const handler of [...leaveHandlers]) handler(closeCode)
      },
      queued(channel, payload) {
        lastRegistered.get(channel)?.(payload as never)
      },
      socketData(data) {
        for (const listener of [...socketListeners]) listener({ data })
      },
    }
    return fake
  }

  const answer = async (
    method: Method,
    args: readonly unknown[],
    fallback: () => FakeRoom,
  ): Promise<NetSdkRoom> => {
    calls.push({ method, args })
    const outcome = queued.get(method)?.shift() ?? always.get(method) ?? fallback()
    const settled = outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)
    const handed = await settled
    rooms.push(handed)
    return handed
  }

  const client: NetSdkClient = {
    create: (name, options) => answer('create', [name, options], () => room()),
    joinById: (code, options) => answer('joinById', [code, options], () => room(code)),
    joinOrCreate: (name, options) => answer('joinOrCreate', [name, options], () => room()),
    reconnect: (token) => answer('reconnect', [token], () => room(token.split(':')[0])),
  }

  return {
    client,
    calls,
    rooms,
    room,
    respond(method, outcome) {
      const list = queued.get(method) ?? []
      list.push(outcome)
      queued.set(method, list)
    },
    respondAlways(method, outcome) {
      if (outcome === undefined) always.delete(method)
      else always.set(method, outcome)
    },
    state,
  }
}
