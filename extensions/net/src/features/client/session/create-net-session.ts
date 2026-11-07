/**
 * A `NetSession` wired to a `NetRoom`.
 *
 * The room's port brings snapshots and pongs; the room's info says the seat (`you`, from the server's `seated` only)
 * and the phase; its connection says whether anything sent arrives. Input is taken while the room counts down or
 * plays and the connection is up; when a dropped connection comes back, the commands the room has not acked are sent
 * again; in another room, the session starts afresh. Time is the `Clock` the caller hands in, so a fake one drives the
 * session in tests.
 *
 * The room tells the session about changes through its watchable values, and snapshots and pongs reach it through the
 * port's plain callbacks; the game calls `session.frame` from its loop. `close()` releases every listener; the sim
 * stays the caller's.
 */

import type { Clock } from '@automata/framework'
import type { Sim } from '@automata/sim'
import { createWatchable, type Watchable } from '../../../shared/watchable'
import type { RemoteView } from '../interpolation/snapshot-buffer'
import type { ConnectionState, NetRoom } from '../room/net-room'
import type { RoomInfo } from '../room/room-info'
import { NetDiagnostics } from './net-diagnostics'
import { NetSession, type RemoteSource, type SessionEnd } from './net-session'

/**
 * What `createNetSession` needs: the room, the client sim, the game's clock, the largest lead in
 * ticks and how to draw the other players.
 */
export interface CreateNetSessionOptions<T = RemoteView> {
  readonly room: Pick<NetRoom, 'port' | 'info' | 'connection' | 'markDegraded'>
  /** The client's sim: the game's plugins and content, as the room runs them. */
  readonly sim: Sim
  /** Time for arrivals and probes: the game's clock, a fake one in tests. */
  readonly clock: Clock
  /** net.toml's `maxLeadTicks` [60]. */
  readonly maxLeadTicks?: number | undefined
  /** How the game draws the others from the authoritative states. */
  readonly remote?: RemoteSource<T> | undefined
  /** net.toml's `snapshotEvery`, `interpolationTicks`, `degradedRoundTripMs` and `degradedGapMs`; their defaults when absent. */
  readonly config?:
    | {
        readonly snapshotEvery?: number | undefined
        readonly interpolationTicks?: number | undefined
        readonly degradedRoundTripMs?: number | undefined
        readonly degradedGapMs?: number | undefined
      }
    | undefined
}

/**
 * A running session: the session to call once per frame, its measured diagnostics, why it ended
 * and a way to close it.
 */
export interface NetSessionHandle<T = RemoteView> {
  /** The game's loop calls `session.frame` once per rendered frame. */
  readonly session: NetSession<T>
  /** What the netcode is doing, measured; the connection reads `degraded` from it. */
  readonly diagnostics: NetDiagnostics
  /** Why the session ended (a desync), once it has. */
  readonly ended: Watchable<SessionEnd | undefined>
  /** Stops listening to the room and the port: no command and no probe goes out after it. */
  close(): void
}

const takesInput = (info: RoomInfo | undefined, connection: ConnectionState): boolean =>
  info !== undefined &&
  (info.phase === 'countdown' || info.phase === 'playing') &&
  (connection === 'connected' || connection === 'degraded')

/**
 * Joins a room's port to a client sim: it predicts the player's own commands, follows the room's
 * snapshots and measures the link. Close the handle when the game ends.
 */
export function createNetSession<T = RemoteView>(options: CreateNetSessionOptions<T>): NetSessionHandle<T> {
  const { clock } = options
  // `Clock.now` is steady (it does not step back when the system time is set), and an arrival stamped in the past
  // would move the authority clock.
  const now = (): number => clock.now()
  const { port } = options.room
  const ended = createWatchable<SessionEnd | undefined>(undefined)
  // Once closed, nothing more goes to the room: no command and no probe.
  let closed = false
  const { config } = options
  const diagnostics = new NetDiagnostics({
    now,
    thresholds: {
      roundTripMs: config?.degradedRoundTripMs ?? 1000,
      gapMs: config?.degradedGapMs ?? 1000,
    },
    onDegraded: (degraded) => options.room.markDegraded(degraded),
  })
  const session = new NetSession<T>({
    sim: options.sim,
    send: (command) => {
      if (!closed) port.sendCommand(command)
    },
    ping: (tick) => (closed ? undefined : port.ping(tick)),
    roundTripMs: port.roundTripMs(),
    maxLeadTicks: options.maxLeadTicks,
    remote: options.remote,
    snapshotTicks: config?.snapshotEvery,
    interpolationTicks: config?.interpolationTicks,
    diagnostics,
    now,
    // Once per session, never per frame.
    onEnd: (end) => ended.set(end),
  })

  let info = options.room.info.get()
  let connection = options.room.connection.get()
  // The room this session's game is in. Another room, or the same one joined again, is another sim timeline (its
  // ticks may be far behind) and another numbering, so the session forgets the old game. A reconnect keeps the
  // room's info, and so the game.
  let code = info?.code
  // A cleared session is a new game: a desync of the last one is over too.
  const clear = (): void => {
    session.clear()
    ended.set(undefined)
  }
  const update = (): void =>
    session.setRoomState({ seat: info?.you, accepting: takesInput(info, connection) })
  update()

  const offSnapshot = port.onSnapshot((snapshot) => session.observe(snapshot, now()))
  const offPong = port.onPong((pong) => session.pong(pong))
  const offInfo = options.room.info.subscribe((next) => {
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
  })
  const offConnection = options.room.connection.subscribe((next) => {
    const was = connection
    connection = next
    update()
    if (was === 'reconnecting' && (next === 'connected' || next === 'degraded')) session.resync()
  })
  return {
    session,
    diagnostics,
    ended: ended.view,
    close() {
      if (closed) return
      closed = true
      offSnapshot()
      offPong()
      offInfo()
      offConnection()
      session.setRoomState({ seat: undefined, accepting: false })
    },
  }
}
