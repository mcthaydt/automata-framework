/**
 * A `NetSession` wired to a `NetRoom` (M7 spec §4.2, §5 "per client frame" and "drop and reconnect").
 *
 * The room's port brings snapshots and pongs; the room's info says the seat (`you`, from the server's `seated` only)
 * and the phase; its connection says whether anything sent arrives. Input is taken while the room counts down or
 * plays and the connection is up; when a dropped connection comes back, the commands the room has not acked are sent
 * again. Time is Effect's `Clock`, read synchronously, so `TestClock` drives the session in tests.
 *
 * Effect is only here, at the edges: snapshots and pongs reach the session through the port's plain callbacks, and
 * the game calls `session.frame` from its loop (ADR 0003: no Effect per frame). Closing the scope releases every
 * listener; the sim stays the caller's.
 */

import type { Sim } from '@mcthaydt/automata-sim'
import { Effect, type Scope, Stream, type Subscribable, SubscriptionRef } from 'effect'
import type { ConnectionState, NetRoom } from '../client/net-room'
import type { RoomInfo } from '../client/room-info'
import { NetSession, type SessionEnd } from './net-session'

export interface MakeNetSessionOptions {
  readonly room: Pick<NetRoom, 'port' | 'info' | 'connection'>
  /** The client's sim: the game's plugins and content, as the room runs them. */
  readonly sim: Sim
  /** net.toml's `maxLeadTicks` [60]. */
  readonly maxLeadTicks?: number | undefined
}

export interface NetSessionHandle {
  /** The game's loop calls `session.frame` once per rendered frame. */
  readonly session: NetSession
  /** Why the session ended (a desync), once it has. */
  readonly ended: Subscribable.Subscribable<SessionEnd | undefined>
}

const takesInput = (info: RoomInfo | undefined, connection: ConnectionState): boolean =>
  info !== undefined &&
  (info.phase === 'countdown' || info.phase === 'playing') &&
  (connection === 'connected' || connection === 'degraded')

export function makeNetSession(
  options: MakeNetSessionOptions,
): Effect.Effect<NetSessionHandle, never, Scope.Scope> {
  return Effect.gen(function* () {
    const clock = yield* Effect.clock
    const now = (): number => clock.unsafeCurrentTimeMillis()
    const { port } = options.room
    const ended = yield* SubscriptionRef.make<SessionEnd | undefined>(undefined)
    const session = new NetSession({
      sim: options.sim,
      send: (command) => port.sendCommand(command),
      ping: (tick) => port.ping(tick),
      roundTripMs: port.roundTripMs(),
      maxLeadTicks: options.maxLeadTicks,
      now,
      // Once per session, never per frame.
      onEnd: (end) => Effect.runSync(SubscriptionRef.set(ended, end)),
    })

    let info = yield* options.room.info.get
    let connection = yield* options.room.connection.get
    const update = (): void =>
      session.setRoomState({ seat: info?.you, accepting: takesInput(info, connection) })
    update()

    const offSnapshot = port.onSnapshot((snapshot) => session.observe(snapshot, now()))
    const offPong = port.onPong((pong) => session.pong(pong))
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        offSnapshot()
        offPong()
        session.setRoomState({ seat: undefined, accepting: false })
      }),
    )
    yield* Effect.forkScoped(
      Stream.runForEach(options.room.info.changes, (next) =>
        Effect.sync(() => {
          info = next
          update()
        }),
      ),
    )
    yield* Effect.forkScoped(
      Stream.runForEach(options.room.connection.changes, (next) =>
        Effect.sync(() => {
          const was = connection
          connection = next
          update()
          if (was === 'reconnecting' && next === 'connected') session.resync()
        }),
      ),
    )
    return { session, ended }
  })
}
