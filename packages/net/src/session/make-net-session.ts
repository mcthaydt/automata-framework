/**
 * A `NetSession` wired to a `NetRoom` (M7 spec §4.2, §5 "per client frame" and "drop and reconnect").
 *
 * The room's port brings snapshots and pongs; the room's info says the seat (`you`, from the server's `seated` only)
 * and the phase; its connection says whether anything sent arrives. Input is taken while the room counts down or
 * plays and the connection is up; when a dropped connection comes back, the commands the room has not acked are sent
 * again; in another room, the session starts afresh. Time is Effect's `Clock`, read synchronously, so `TestClock` drives the session in tests.
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
    // Monotonic: the wall clock (`unsafeCurrentTimeMillis`) can step back when the system time is set, and an
    // arrival stamped in the past would move the authority clock.
    const now = (): number => Number(clock.unsafeCurrentTimeNanos()) / 1e6
    const { port } = options.room
    const ended = yield* SubscriptionRef.make<SessionEnd | undefined>(undefined)
    // Once the scope closes, nothing more goes to the room: no command and no probe.
    let closed = false
    const session = new NetSession({
      sim: options.sim,
      send: (command) => {
        if (!closed) port.sendCommand(command)
      },
      ping: (tick) => (closed ? undefined : port.ping(tick)),
      roundTripMs: port.roundTripMs(),
      maxLeadTicks: options.maxLeadTicks,
      now,
      // Once per session, never per frame.
      onEnd: (end) => Effect.runSync(SubscriptionRef.set(ended, end)),
    })

    let info = yield* options.room.info.get
    let connection = yield* options.room.connection.get
    // The room this session's game is in. Another room, or the same one joined again, is another sim timeline (its
    // ticks may be far behind) and another numbering, so the session forgets the old game. A reconnect keeps the
    // room's info, and so the game.
    let code = info?.code
    // A cleared session is a new game: a desync of the last one is over too.
    const clear = (): void => {
      session.clear()
      Effect.runSync(SubscriptionRef.set(ended, undefined))
    }
    const update = (): void =>
      session.setRoomState({ seat: info?.you, accepting: takesInput(info, connection) })
    update()

    const offSnapshot = port.onSnapshot((snapshot) => session.observe(snapshot, now()))
    const offPong = port.onPong((pong) => session.pong(pong))
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        closed = true
        offSnapshot()
        offPong()
        session.setRoomState({ seat: undefined, accepting: false })
      }),
    )
    yield* Effect.forkScoped(
      Stream.runForEach(options.room.info.changes, (next) =>
        Effect.sync(() => {
          info = next
          // Left (or the seat was lost): the game is over for this player, whichever room comes next.
          if (next === undefined && code !== undefined) {
            clear()
            code = undefined
          }
          // A room replaced by another without passing through none.
          if (next !== undefined && next.code !== code) {
            if (code !== undefined) clear()
            code = next.code
          }
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
