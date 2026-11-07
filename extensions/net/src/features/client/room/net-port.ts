/**
 * The client end of core's `NetworkPort`.
 *
 * This port has the four members of core's `NetworkPort` with core's exact signatures, so a game can hand it to
 * anything that takes one. A snapshot is core's `AuthoritativeSnapshot` with the acks beside it (`NetSnapshot`).
 *
 * The port outlives any one room: `NetRoom` attaches the current room's transport and detaches it on a drop, so a
 * reconnect keeps every listener. A client is not the authority: it hears no remote commands and publishes no
 * snapshot. Sends never throw; with no room a command is dropped (the next snapshot corrects the client).
 *
 * Plain callbacks, no Effect: commands and snapshots cross the port every tick (ADR 0003).
 */

import type { Command } from '@automata/sim'
import type { ColyseusTransport, NetSnapshot, Pong, TransportEvents } from './colyseus-transport'

/** Round trips remembered for the estimate; the median of these is the answer. */
const RTT_SAMPLES = 7

/**
 * The sim's link to the room on a client: it sends the player's commands and never hears remote
 * ones or publishes a snapshot, because the room is the authority.
 */
export interface ClientNetworkPort {
  /** A client hears no remote commands: the listener is never called. */
  onRemoteCommand(listener: (command: Command) => void): () => void
  /** Sends one local command to the room; `source` is not sent (the room stamps the seat). */
  sendCommand(command: Command): void
  /** A client publishes nothing: the authority is the room. */
  publishSnapshot(snapshot: {
    readonly tick: number
    readonly bytes: Uint8Array
    readonly hash: string
  }): void
  /** Each authoritative snapshot, in arrival order, with the per-seat acks. */
  onSnapshot(listener: (snapshot: NetSnapshot) => void): () => void
  /** A clock probe for `tick` (-1 with no clock); its id, or undefined with no room. */
  ping(tick: number): number | undefined
  onPong(listener: (pong: Pong) => void): () => void
  /** The median of the last seven round trips, in milliseconds; undefined before the first. */
  roundTripMs(): number | undefined
  /** Every byte the room sockets delivered, across reconnects. */
  bytesIn(): number
  /** The finished game's packed replay. */
  onReplay(listener: (bytes: Uint8Array) => void): () => void
}

export type PortEvents = Pick<TransportEvents, 'snapshot' | 'pong' | 'replay' | 'bytes'>

export interface ClientPortHub {
  readonly port: ClientNetworkPort
  /** What the current transport tells the port. */
  readonly events: PortEvents
  /** The room commands go to; undefined while there is none (dropped, left). */
  attach(transport: ColyseusTransport | undefined): void
  /** The port's scope closed: every listener goes, and none is taken after. */
  close(): void
}

function listeners<A>(isClosed: () => boolean) {
  const set = new Set<(value: A) => void>()
  return {
    add(listener: (value: A) => void): () => void {
      if (isClosed()) return () => undefined
      set.add(listener)
      return () => {
        set.delete(listener)
      }
    },
    emit(value: A): void {
      for (const listener of [...set]) listener(value)
    },
    clear: () => set.clear(),
  }
}

function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export function createClientPort(): ClientPortHub {
  let closed = false
  let transport: ColyseusTransport | undefined
  let bytes = 0
  const roundTrips: number[] = []
  const isClosed = () => closed
  const snapshots = listeners<NetSnapshot>(isClosed)
  const pongs = listeners<Pong>(isClosed)
  const replays = listeners<Uint8Array>(isClosed)

  const port: ClientNetworkPort = {
    onRemoteCommand: () => () => undefined,
    sendCommand(command) {
      transport?.send({
        t: 'cmd',
        seq: command.seq,
        tick: command.tick,
        type: command.type,
        payload: command.payload,
      })
    },
    publishSnapshot: () => undefined,
    onSnapshot: snapshots.add,
    ping: (tick) => transport?.ping(tick),
    onPong: pongs.add,
    roundTripMs: () => median(roundTrips),
    bytesIn: () => bytes,
    onReplay: replays.add,
  }

  return {
    port,
    events: {
      snapshot: (snapshot) => {
        if (!closed) snapshots.emit(snapshot)
      },
      pong: (pong) => {
        if (closed) return
        roundTrips.push(pong.rttMs)
        if (roundTrips.length > RTT_SAMPLES) roundTrips.shift()
        pongs.emit(pong)
      },
      replay: (replay) => {
        if (!closed) replays.emit(replay)
      },
      bytes: (count) => {
        bytes += count
      },
    },
    attach(next) {
      transport = closed ? undefined : next
    },
    close() {
      closed = true
      transport = undefined
      snapshots.clear()
      pongs.clear()
      replays.clear()
    },
  }
}
