/**
 * `NetRoom`: the room API (create, join, quick match, ready, bots, leave, resume) and the reconnection behind it.
 *
 * Plain promises and values. Every call rejects with `NetError`, time comes from the `Clock` the caller hands in
 * (a fake one in tests), and `close()` closes the socket, the probe and any reconnect in flight. The per-message paths
 * (the transport, the port) are plain code too; a promise is made per call, per state change and per retry.
 *
 * **One intent owns its handshakes.** Each create, join, quick match, resume and leave starts a new generation.
 * Anything an older generation started (a handshake still in flight, a backoff, a room's queued callbacks) checks its
 * generation before it acts: a room that arrives for a retired generation is retired (`retire`: left, consented,
 * unless it is the seat this client still holds), and its failure is nobody's. That is what keeps a slow handshake
 * from adopting a room the player already walked away from.
 *
 * **Drops.** A close the server did not mean as an ending (1006 above all) is a drop: `reconnecting`, then the stored
 * token is presented again after `reconnectDelay` (250 ms doubling to 2 s, spread) until it works or
 * `reconnectGraceSeconds` have passed, and then the seat is lost (`ended: seat-lost`). Consented (4000) and normal
 * (1000) closes end the room (`closed`); 4001 is the server draining or shutting down (`server-updating`); 4002 is a
 * room that failed (`failed`). None of those is retried: the server holds no seat for them.
 *
 * **Giving up a call.** `create`, `join`, `quickMatch` and `resume` take an `AbortSignal`: aborting it gives up the
 * intent (the room goes `offline`, and a room that still arrives is left) and rejects the call with the signal's reason.
 */

import type { Clock } from '@automata/framework'
import { createWatchable } from '../../../shared/watchable'
import { type JoinOptions, joinOptionsSchema } from '../../../shared/wire/join-options.schema'
import { PROTOCOL_VERSION } from '../../../shared/wire/limits'
import { ROOM_NAME } from '../../../shared/wire/room'
import type { NetErrorCode } from '../../../shared/wire/server-message.schema'
import { ColyseusTransport, type RoomRequest } from './colyseus-transport'
import { NetError, refusalCode } from './net-error'
import { type ClientNetworkPort, createClientPort } from './net-port'
import { reconnectDelay } from './reconnect-delay'
import { createRequestIds, newLoadToken } from './request-ids'
import type {
  ConnectionState,
  IntentOptions,
  NetRoom,
  NetRoomOptions,
  ResumeOutcome,
  RoomEnd,
} from './room-api'
import { abortable, endOf, NO_ANSWER, quietly, within } from './room-helpers'
import { type RoomInfo, roomInfoOf, sameRoomInfo } from './room-info'
import { colyseusClient, type NetSdkClient, type NetSdkRoom } from './sdk'
import { createSeatTokenStore, sessionSeatStorage } from './seat-token'
import { createStopper, type Stopper } from './stopper'

export type {
  ConnectionState,
  IntentOptions,
  NetRoom,
  NetRoomOptions,
  ResumeOutcome,
  RoomEnd,
} from './room-api'

/** How often a connected room is probed, so the round trip is known before play needs it. */
const PROBE_EVERY_MS = 1_000

/** The longest one reconnect attempt may take before the next is tried. */
const ATTEMPT_TIMEOUT_MS = 5_000

/** Quick match tries once more when the room it was offered filled, went or started meanwhile. */
const QUICK_MATCH_RETRY: readonly NetErrorCode[] = ['ROOM_FULL', 'ROOM_NOT_FOUND', 'REFUSED']

/** A resume that failed for these is not an expired seat: the token is kept for the next page load. */
const RESUME_KEEPS_TOKEN: readonly NetErrorCode[] = ['OFFLINE', 'RATE_LIMITED']

/**
 * Makes the player's side of a room. It reconnects after a drop for as long as the grace allows,
 * and keeps the seat so a reload can take it back.
 */
export function createNetRoom(options: NetRoomOptions): NetRoom {
  const { clock } = options
  const connectionState = createWatchable<ConnectionState>('offline')
  const infoState = createWatchable<RoomInfo | undefined>(undefined)
  const endedState = createWatchable<RoomEnd | undefined>(undefined)

  const tokens = createSeatTokenStore(
    options.storage === null ? undefined : (options.storage ?? sessionSeatStorage()),
    {
      url: options.url,
      schemaHash: options.version.schemaHash,
      contentHash: options.version.contentHash,
    },
  )
  const hub = createClientPort()
  const requestIds = createRequestIds(options.loadToken ?? newLoadToken())
  const makeClient = options.client ?? colyseusClient
  const random = options.random ?? Math.random
  const graceMs = options.reconnectGraceSeconds * 1000

  let generation = 0
  let disposed = false
  let transport: ColyseusTransport | undefined
  let you: number | undefined
  let retry: Stopper | undefined
  let resumeUsed = false
  let lastPingAt = Number.NEGATIVE_INFINITY

  // The diagnostics' mark: shown instead of `connected` while it is set, and forgotten when the connection goes offline.
  let degradedMark = false
  const setConnection = (next: ConnectionState): void => {
    if (next === 'offline') degradedMark = false
    connectionState.set(next === 'connected' && degradedMark ? 'degraded' : next)
  }
  const setInfo = (next: RoomInfo | undefined): void => {
    if (sameRoomInfo(infoState.get(), next)) return
    infoState.set(next)
  }
  const setEnded = (next: RoomEnd | undefined): void => endedState.set(next)
  const isUp = (): boolean => connectionState.get() === 'connected' || connectionState.get() === 'degraded'

  const current = (gen: number): boolean => !disposed && gen === generation

  /** Lets go of the current room's transport; the room itself is the caller's to leave or close. */
  const detach = (): NetSdkRoom | undefined => {
    const room = transport?.room
    transport?.detach()
    transport = undefined
    hub.attach(undefined)
    return room
  }

  /** Retires every older generation: its backoff stops, its room's callbacks go quiet. */
  const invalidate = (): number => {
    generation += 1
    retry?.stop()
    retry = undefined
    return generation
  }

  /** Re-reads the room info; an unreadable state (before the first patch) keeps what was shown. */
  const project = (): void => {
    if (transport === undefined) return
    const next = roomInfoOf(transport.room.state, you)
    if (next !== undefined) setInfo(next)
  }

  /** The room is gone for good: nothing to reclaim. */
  const endRoom = (reason: RoomEnd['reason'] | undefined): void => {
    invalidate()
    quietly(detach())
    tokens.forget()
    you = undefined
    setInfo(undefined)
    setConnection('offline')
    setEnded(reason === undefined ? undefined : { reason })
  }

  /** A new intent: the previous room is left (consented) and forgotten. */
  const beginIntent = (keepToken: boolean, state: 'connecting' | 'reconnecting'): number => {
    const previous = detach()
    const gen = invalidate()
    if (!keepToken) tokens.forget()
    you = undefined
    setInfo(undefined)
    setEnded(undefined)
    quietly(previous)
    setConnection(state)
    return gen
  }

  /** The caller gave up the intent `gen`: it stops, and the room goes offline, unless a newer intent has replaced it. */
  const giveUp = (gen: number): void => {
    if (!current(gen)) return
    invalidate()
    setConnection('offline')
  }

  /**
   * One reconnect attempt, bounded by `ms`. The SDK's request and handshake have no time limit of their own, so one
   * that hangs (a phone moving from Wi-Fi to cellular) must not hold back the next. Once given up it is abandoned: the
   * attempt is marked dead the moment the limit (or a stop) fires, so a handshake that settles in the same tick finds
   * itself abandoned and retires its room instead of adopting it.
   */
  const attempt = (
    stopper: Stopper,
    gen: number,
    seat: { readonly token: string },
    ms: number,
  ): Promise<'settled' | 'failed' | 'gave-up'> =>
    new Promise((resolve) => {
      const live = { value: true }
      const cancel = stopper.after(ms, () => {
        live.value = false
        resolve('gave-up')
      })
      makeClient(options.url)
        .reconnect(seat.token)
        .then((room) => adopt(room, gen, { presented: seat.token, live: () => live.value }))
        .then(
          () => {
            cancel()
            resolve('settled')
          },
          () => {
            cancel()
            resolve('failed')
          },
        )
    })

  const reconnectLoop = async (gen: number, stopper: Stopper): Promise<void> => {
    const deadline = clock.now() + graceMs
    let tries = 0
    while (current(gen) && !stopper.stopped && clock.now() < deadline) {
      const seat = tokens.read()
      if (seat === undefined) break
      const outcome = await attempt(
        stopper,
        gen,
        seat,
        Math.min(Math.max(0, deadline - clock.now()), ATTEMPT_TIMEOUT_MS),
      )
      // A room taken by this attempt, whatever the timer said, ends the loop.
      if (outcome === 'settled' || !current(gen) || transport !== undefined) return
      await stopper.sleep(Math.max(0, Math.min(reconnectDelay(tries, random), deadline - clock.now())))
      tries += 1
    }
    if (current(gen)) endRoom('seat-lost')
  }

  const onClosed = (code: number, gen: number): void => {
    if (!current(gen)) return
    const reason = endOf(code)
    if (reason !== undefined) {
      endRoom(reason)
      return
    }
    // A drop: the seat is held for the grace, so the token is presented again until it works or the grace ends.
    detach()
    const next = invalidate()
    setConnection('reconnecting')
    const stopper = createStopper(clock)
    retry = stopper
    void reconnectLoop(next, stopper)
  }

  /**
   * A room that arrived for a retired intent or an abandoned attempt. It is kept only when it is a reconnect of the
   * seat this client still holds and nothing has replaced it: no room is current, and the stored token is exactly
   * the one the handshake presented (the room closed, or a resume or an attempt timed out, mid-handshake). Then the
   * rotated token is stored and the socket closed without consent, so the server holds the seat for its grace.
   * Anything else is left, consented, so its seat is freed: a fresh create or join (a double-tapped Join of the
   * same code), and a reconnect overtaken by a newer room. Keeping those would leave a ghost seat, and point the
   * stored token at it.
   */
  function retire(room: NetSdkRoom, presented: string | undefined): void {
    if (presented !== undefined && transport === undefined && tokens.read()?.token === presented) {
      tokens.write({ code: room.roomId, token: room.reconnectionToken })
      // The SDK would read the close as a drop and retry by itself (only its minUptime stops it): switched off.
      room.reconnection.enabled = false
      room.connection.close()
      return
    }
    quietly(room)
  }

  /**
   * Takes `room` as the current room if `gen` is still the current intent (and, for a reconnect attempt, the attempt
   * was not given up); otherwise retires it. `presented` is the token a reconnect handshake presented.
   */
  function adopt(
    room: NetSdkRoom,
    gen: number,
    reconnect?: { readonly presented: string; readonly live: () => boolean },
  ): boolean {
    if (!current(gen) || (reconnect !== undefined && !reconnect.live())) {
      retire(room, reconnect?.presented)
      return false
    }
    detach()
    transport = new ColyseusTransport(room, {
      events: {
        ...hub.events,
        seated: (seat) => {
          you = seat
          project()
        },
        state: project,
        closed: (code) => onClosed(code, gen),
      },
      now: clock.now,
      requestIds,
    })
    hub.attach(transport)
    // Written before `connected` is announced: the handshake rotated the token, and a drop or reload in the gap
    // before `seated` must present the new one.
    tokens.write({ code: room.roomId, token: room.reconnectionToken })
    setConnection('connected')
    project()
    return true
  }

  const joinOptions = (name: string): JoinOptions | undefined => {
    const session = options.session?.()
    const parsed = joinOptionsSchema.safeParse({
      protocol: PROTOCOL_VERSION,
      schemaHash: options.version.schemaHash,
      contentHash: options.version.contentHash,
      name,
      ...(session === undefined ? {} : { session }),
    })
    return parsed.success ? parsed.data : undefined
  }

  /**
   * One matchmaking intent. Options that fail the wire's schema (a name outside its alphabet) are refused here,
   * before the current room is touched; anything the server refuses is read by its code.
   */
  const enter = async (
    operation: string,
    { name, signal }: IntentOptions,
    handshake: (client: NetSdkClient, options: JoinOptions, gen: number) => Promise<NetSdkRoom>,
  ): Promise<void> => {
    signal?.throwIfAborted()
    const join = joinOptions(name)
    if (join === undefined) throw new NetError({ code: 'REFUSED', operation })
    const gen = beginIntent(false, 'connecting')
    const client = makeClient(options.url)
    try {
      // A caller that gives up on its join gives up the intent; a room that still arrives is left by `adopt`.
      await abortable(
        signal,
        handshake(client, join, gen).then((room) => adopt(room, gen)),
        () => giveUp(gen),
      )
    } catch (error) {
      if (signal?.aborted) throw error
      if (!current(gen)) return
      setConnection('offline')
      throw new NetError({ code: refusalCode(error), operation })
    }
  }

  const request = (operation: string, message: RoomRequest): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (transport === undefined || !isUp()) {
        reject(new NetError({ code: 'OFFLINE', operation }))
        return
      }
      transport.request(message, (error) => {
        if (error === undefined) resolve()
        else reject(new NetError({ code: error, operation }))
      })
    })

  const leave = async (): Promise<void> => {
    const room = detach()
    invalidate()
    tokens.forget()
    you = undefined
    setInfo(undefined)
    setEnded(undefined)
    setConnection('offline')
    if (room !== undefined) await room.leave(true).catch(() => 0)
  }

  const resume = async (resumeOptions?: {
    readonly signal?: AbortSignal | undefined
  }): Promise<ResumeOutcome> => {
    const signal = resumeOptions?.signal
    signal?.throwIfAborted()
    if (resumeUsed) return 'none'
    resumeUsed = true
    const seat = tokens.read()
    if (seat === undefined) return 'none'
    const gen = beginIntent(true, 'reconnecting')
    try {
      // Bounded like a reconnect attempt: a server that never answers is offline, and the seat is kept (`retire`
      // keeps a room that still arrives).
      const adopted = await abortable(
        signal,
        within(
          clock,
          makeClient(options.url)
            .reconnect(seat.token)
            .then((room) => adopt(room, gen, { presented: seat.token, live: () => true })),
          graceMs,
        ),
        () => giveUp(gen),
      )
      return adopted ? 'resumed' : 'none'
    } catch (error) {
      if (signal?.aborted) throw error
      if (!current(gen)) return 'none'
      invalidate()
      setConnection('offline')
      const code = error === NO_ANSWER ? 'OFFLINE' : refusalCode(error)
      if (RESUME_KEEPS_TOKEN.includes(code)) throw new NetError({ code, operation: 'resume' })
      tokens.forget()
      return 'expired'
    }
  }

  // The port as the room hands it out: a probe sent by anyone counts for the background probe's pace.
  const port: ClientNetworkPort = {
    ...hub.port,
    ping: (tick) => {
      const id = hub.port.ping(tick)
      if (id !== undefined) lastPingAt = clock.now()
      return id
    },
  }

  // A probe a second while connected, skipped while play is already probing.
  let probe: ReturnType<Clock['setTimeout']> | undefined
  const probeLater = (): void => {
    probe = clock.setTimeout(() => {
      if (isUp() && clock.now() - lastPingAt >= PROBE_EVERY_MS) port.ping(-1)
      probeLater()
    }, PROBE_EVERY_MS)
  }
  probeLater()

  return {
    create: (intent) => enter('create', intent, (client, join) => client.create(ROOM_NAME, join)),
    join: (code, intent) => enter('join', intent, (client, join) => client.joinById(code, join)),
    quickMatch: (intent) =>
      enter('quickMatch', intent, async (client, join, gen) => {
        try {
          return await client.joinOrCreate(ROOM_NAME, join)
        } catch (error) {
          // Once more if the offered room filled, went or started between being offered and being joined: by
          // then it is no longer offered, so the second try finds another room or opens one. Never a third.
          if (!current(gen) || !QUICK_MATCH_RETRY.includes(refusalCode(error))) throw error
          return client.joinOrCreate(ROOM_NAME, join)
        }
      }),
    setReady: (ready) => request('setReady', { t: 'ready', ready }),
    addBot: () => request('addBot', { t: 'bot.add' }),
    removeBot: (seat) => request('removeBot', { t: 'bot.remove', seat }),
    leave,
    markDegraded: (degraded) => {
      degradedMark = degraded
      if (isUp()) setConnection('connected')
    },
    resume,
    info: infoState.view,
    connection: connectionState.view,
    ended: endedState.view,
    port,
    close() {
      if (disposed) return
      // Closing does not give up the seat: the stored token stays for the next page load's `resume`.
      disposed = true
      clock.clearTimeout(probe)
      invalidate()
      const room = detach()
      hub.close()
      room?.connection.close()
      setConnection('offline')
    },
  }
}
