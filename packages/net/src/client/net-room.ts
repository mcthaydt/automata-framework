/**
 * `NetRoom`: the room API (M7 spec §4.2, §5, §6; FloorFifty `managers/network/colyseus-network.ts`, its room verbs
 * and its reconnection, with the race verbs left behind).
 *
 * An Effect service, scoped: every call fails with `NetError`, time is Effect's `Clock` (`TestClock` in tests), and
 * closing the scope closes the socket, the probe and any reconnect in flight. The per-message paths (the transport,
 * the port) are plain code; Effect runs only per call, per state change and per retry.
 *
 * **One intent owns its handshakes.** Each create, join, quick match, resume and leave starts a new generation.
 * Anything an older generation started (a handshake still in flight, a backoff, a room's queued callbacks) checks its
 * generation before it acts: a room that arrives for a retired generation is retired (`retire`: left, consented,
 * unless it is the seat this client still holds), and its failure is nobody's. This is FloorFifty's `generation`, and it is what keeps a slow handshake from adopting a room
 * the player already walked away from.
 *
 * **Drops.** A close the server did not mean as an ending (1006 above all) is a drop: `reconnecting`, then the stored
 * token is presented again after `reconnectDelay` (250 ms doubling to 2 s, spread) until it works or
 * `reconnectGraceSeconds` have passed, and then the seat is lost (`ended: seat-lost`). Consented (4000) and normal
 * (1000) closes end the room (`closed`); 4001 is the server draining or shutting down (`server-updating`); 4002 is a
 * room that failed (`failed`). None of those is retried: the server holds no seat for them.
 */

import {
  Clock,
  Context,
  Effect,
  Fiber,
  Layer,
  Runtime,
  Schedule,
  type Scope,
  type Subscribable,
  SubscriptionRef,
} from 'effect'
import { type JoinOptions, joinOptionsSchema } from '../wire/join-options.schema'
import { PROTOCOL_VERSION } from '../wire/limits'
import { ROOM_NAME } from '../wire/room'
import type { NetErrorCode } from '../wire/server-message.schema'
import { ColyseusTransport, type RoomRequest } from './colyseus-transport'
import { NetError, refusalCode } from './net-error'
import { type ClientNetworkPort, createClientPort } from './net-port'
import { reconnectDelay } from './reconnect-delay'
import { createRequestIds, newLoadToken } from './request-ids'
import { type RoomInfo, roomInfoOf, sameRoomInfo } from './room-info'
import { colyseusClient, type NetSdkClient, type NetSdkRoom } from './sdk'
import { createSeatTokenStore, type SeatStorage, sessionSeatStorage } from './seat-token'

export type ConnectionState = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'degraded'

/** Why the room went without the player choosing to leave. */
export interface RoomEnd {
  readonly reason: 'seat-lost' | 'closed' | 'server-updating' | 'failed'
}

export type ResumeOutcome = 'resumed' | 'none' | 'expired'

export interface NetRoom {
  create(options: { readonly name: string }): Effect.Effect<void, NetError>
  join(code: string, options: { readonly name: string }): Effect.Effect<void, NetError>
  /** Seats you in an open room in its lobby, or opens one. */
  quickMatch(options: { readonly name: string }): Effect.Effect<void, NetError>
  setReady(ready: boolean): Effect.Effect<void, NetError>
  /** Host seat only; the server's `BotPolicy` drives the bot. */
  addBot(): Effect.Effect<void, NetError>
  removeBot(seat: number): Effect.Effect<void, NetError>
  /** Leaves and forgets the seat, so no later reconnect or reload reclaims it. */
  readonly leave: Effect.Effect<void>
  /**
   * The session's diagnostics say the link is slow or silent (M7 spec §4.2 "Degraded"): while the connection is up it reads
   * `degraded` instead of `connected`. A drop shows `reconnecting`, and going offline forgets the mark.
   */
  markDegraded(degraded: boolean): void
  /** Reclaims the stored seat after a reload, once: `expired` forgets the token and is never retried. */
  readonly resume: Effect.Effect<ResumeOutcome, NetError>
  readonly info: Subscribable.Subscribable<RoomInfo | undefined>
  readonly connection: Subscribable.Subscribable<ConnectionState>
  /** Set when the room ended without a leave; cleared by the next intent. */
  readonly ended: Subscribable.Subscribable<RoomEnd | undefined>
  /** Core's `NetworkPort`, client end, for the session that predicts and reconciles (M7.5b). */
  readonly port: ClientNetworkPort
}

export const NetRoom: Context.Tag<NetRoom, NetRoom> = Context.GenericTag<NetRoom>(
  '@mcthaydt/automata-net/NetRoom',
)

export interface NetRoomOptions {
  /** The server: net.toml's `url`. */
  readonly url: string
  /** The client sim's hashes: the join check (M7 spec §4.2). */
  readonly version: { readonly schemaHash: string; readonly contentHash: string }
  readonly reconnectGraceSeconds: number
  /** The host's session token, for the server's `SessionVerifier` (M7.4b); none for an anonymous server. */
  readonly session?: (() => string | undefined) | undefined
  /** The SDK client for `url`; the real one by default. */
  readonly client?: ((url: string) => NetSdkClient) | undefined
  /**
   * Where the reconnection token is written through to, for a reload's `resume`: this page's `sessionStorage` when
   * absent; `null` switches persistence off (the seat is still held in memory, so a drop reconnects).
   */
  readonly storage?: SeatStorage | null | undefined
  /** The backoff's spread, in [0, 1]; `Math.random` by default. */
  readonly random?: (() => number) | undefined
  /** The request ids' per-load prefix; drawn by default. */
  readonly loadToken?: string | undefined
}

/** How often a connected room is probed, so the round trip is known before play needs it (FloorFifty). */
const PROBE_EVERY_MS = 1_000

/** The longest one reconnect attempt may take before the next is tried. */
const ATTEMPT_TIMEOUT_MS = 5_000

/** Quick match tries once more when the room it was offered filled, went or started meanwhile (FloorFifty). */
const QUICK_MATCH_RETRY: readonly NetErrorCode[] = ['ROOM_FULL', 'ROOM_NOT_FOUND', 'REFUSED']

/** A resume that failed for these is not an expired seat: the token is kept for the next page load. */
const RESUME_KEEPS_TOKEN: readonly NetErrorCode[] = ['OFFLINE', 'RATE_LIMITED']

/** A resume the server never answered within the grace: read as `OFFLINE`. */
const NO_ANSWER: unique symbol = Symbol('no answer')

/** What a close code means; undefined is a drop. */
function endOf(code: number): RoomEnd['reason'] | undefined {
  switch (code) {
    case 1000:
    case 4000:
      return 'closed'
    case 4001:
      return 'server-updating'
    case 4002:
      return 'failed'
    default:
      return undefined
  }
}

const quietly = (room: NetSdkRoom | undefined): void => {
  void room?.leave(true).catch(() => undefined)
}

export function makeNetRoom(options: NetRoomOptions): Effect.Effect<NetRoom, never, Scope.Scope> {
  return Effect.gen(function* () {
    const runtime = yield* Effect.runtime<never>()
    const clock = yield* Effect.clock
    const now = (): number => clock.unsafeCurrentTimeMillis()
    const run = Runtime.runSync(runtime)

    const connectionRef = yield* SubscriptionRef.make<ConnectionState>('offline')
    const infoRef = yield* SubscriptionRef.make<RoomInfo | undefined>(undefined)
    const endedRef = yield* SubscriptionRef.make<RoomEnd | undefined>(undefined)
    let connection: ConnectionState = 'offline'
    let info: RoomInfo | undefined
    let ended: RoomEnd | undefined

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
    let retry: Fiber.RuntimeFiber<void> | undefined
    let resumeUsed = false
    let lastPingAt = Number.NEGATIVE_INFINITY

    // The diagnostics' mark: shown instead of `connected` while it is set, and forgotten when the connection goes offline.
    let degradedMark = false
    const setConnection = (next: ConnectionState): void => {
      if (next === 'offline') degradedMark = false
      const shown = next === 'connected' && degradedMark ? 'degraded' : next
      if (connection === shown) return
      connection = shown
      run(SubscriptionRef.set(connectionRef, shown))
    }
    const setInfo = (next: RoomInfo | undefined): void => {
      if (sameRoomInfo(info, next)) return
      info = next
      run(SubscriptionRef.set(infoRef, next))
    }
    const setEnded = (next: RoomEnd | undefined): void => {
      if (ended === next) return
      ended = next
      run(SubscriptionRef.set(endedRef, next))
    }

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
      if (retry !== undefined) {
        const fiber = retry
        retry = undefined
        Runtime.runFork(runtime)(Fiber.interrupt(fiber))
      }
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

    const reconnectLoop = (gen: number): Effect.Effect<void> =>
      Effect.gen(function* () {
        const deadline = (yield* Clock.currentTimeMillis) + graceMs
        let attempt = 0
        while (current(gen) && (yield* Clock.currentTimeMillis) < deadline) {
          const seat = tokens.read()
          if (seat === undefined) break
          // The SDK's request and handshake have no timeout of their own. An attempt is bounded by 5 s (or the grace
          // left), so one that hangs (a phone moving from Wi-Fi to cellular) does not hold back the next; once given
          // up it is abandoned, and a room it still produces is retired by `adopt`, never taken.
          const remaining = Math.max(0, deadline - (yield* Clock.currentTimeMillis))
          const attemptLive = { live: true }
          const adopted = yield* Effect.either(
            Effect.tryPromise(() =>
              makeClient(options.url)
                .reconnect(seat.token)
                .then((room) => adopt(room, gen, { presented: seat.token, live: () => attemptLive.live })),
            ).pipe(
              // Given up the moment the cap interrupts it, inside the timed effect: a handshake that settles in the
              // same tick then finds itself abandoned and retires its room rather than adopting it.
              Effect.onInterrupt(() =>
                Effect.sync(() => {
                  attemptLive.live = false
                }),
              ),
              Effect.timeout(Math.min(remaining, ATTEMPT_TIMEOUT_MS)),
            ),
          )
          // A room taken by this attempt, whatever the timer said, ends the loop.
          if (adopted._tag === 'Right' || !current(gen) || transport !== undefined) return
          const left = deadline - (yield* Clock.currentTimeMillis)
          yield* Effect.sleep(Math.max(0, Math.min(reconnectDelay(attempt, random), left)))
          attempt += 1
        }
        if (current(gen)) endRoom('seat-lost')
      })

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
      retry = Runtime.runFork(runtime)(reconnectLoop(next))
    }

    /**
     * A room that arrived for a retired intent or an abandoned attempt. It is kept only when it is a reconnect of the
     * seat this client still holds and nothing has replaced it: no room is current, and the stored token is exactly
     * the one the handshake presented (the scope closed, or a resume or an attempt timed out, mid-handshake). Then the
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
        now,
        requestIds,
      })
      hub.attach(transport)
      // Written before `connected` is announced: the handshake rotated the token, and a drop or reload in the gap
      // before `seated` must present the new one (FloorFifty "persists a rotated token").
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
    const enter = (
      operation: string,
      name: string,
      handshake: (client: NetSdkClient, options: JoinOptions, gen: number) => Promise<NetSdkRoom>,
    ): Effect.Effect<void, NetError> =>
      Effect.suspend(() => {
        const join = joinOptions(name)
        if (join === undefined) return Effect.fail(new NetError({ code: 'REFUSED', operation }))
        const gen = beginIntent(false, 'connecting')
        const client = makeClient(options.url)
        return Effect.tryPromise({
          try: () => handshake(client, join, gen).then((room) => adopt(room, gen)),
          catch: (error) => error,
        }).pipe(
          Effect.asVoid,
          Effect.catchAll((error) => {
            if (!current(gen)) return Effect.void
            setConnection('offline')
            return Effect.fail(new NetError({ code: refusalCode(error), operation }))
          }),
          // A caller that gives up on its join gives up the intent; a room that still arrives is left by `adopt`.
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              if (!current(gen)) return
              invalidate()
              setConnection('offline')
            }),
          ),
        )
      })

    const request = (operation: string, message: RoomRequest): Effect.Effect<void, NetError> =>
      Effect.async<void, NetError>((resume) => {
        if (transport === undefined || (connection !== 'connected' && connection !== 'degraded')) {
          resume(Effect.fail(new NetError({ code: 'OFFLINE', operation })))
          return
        }
        const cancel = transport.request(message, (error) => {
          resume(error === undefined ? Effect.void : Effect.fail(new NetError({ code: error, operation })))
        })
        return Effect.sync(cancel)
      })

    const leave: Effect.Effect<void> = Effect.suspend(() => {
      const room = detach()
      invalidate()
      tokens.forget()
      you = undefined
      setInfo(undefined)
      setEnded(undefined)
      setConnection('offline')
      return room === undefined
        ? Effect.void
        : Effect.promise(() => room.leave(true).catch(() => 0)).pipe(Effect.asVoid)
    })

    const resume: Effect.Effect<ResumeOutcome, NetError> = Effect.suspend(() => {
      if (resumeUsed) return Effect.succeed('none' as const)
      resumeUsed = true
      const seat = tokens.read()
      if (seat === undefined) return Effect.succeed('none' as const)
      const gen = beginIntent(true, 'reconnecting')
      return Effect.tryPromise({
        try: () =>
          makeClient(options.url)
            .reconnect(seat.token)
            .then((room) => adopt(room, gen, { presented: seat.token, live: () => true })),
        catch: (error) => error,
      }).pipe(
        // Bounded like a reconnect attempt: a server that never answers is offline, and the seat is kept (`retire`
        // keeps a room that still arrives).
        Effect.timeoutFail({ duration: graceMs, onTimeout: () => NO_ANSWER }),
        Effect.map((adopted): ResumeOutcome => (adopted ? 'resumed' : 'none')),
        Effect.catchAll((error) => {
          if (!current(gen)) return Effect.succeed('none' as const)
          invalidate()
          setConnection('offline')
          const code = error === NO_ANSWER ? 'OFFLINE' : refusalCode(error)
          if (RESUME_KEEPS_TOKEN.includes(code))
            return Effect.fail(new NetError({ code, operation: 'resume' }))
          tokens.forget()
          return Effect.succeed('expired' as const)
        }),
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            if (!current(gen)) return
            invalidate()
            setConnection('offline')
          }),
        ),
      )
    })

    // The port as the room hands it out: a probe sent by anyone counts for the background probe's pace.
    const port: ClientNetworkPort = {
      ...hub.port,
      ping: (tick) => {
        const id = hub.port.ping(tick)
        if (id !== undefined) lastPingAt = now()
        return id
      },
    }

    // A probe a second while connected, skipped while play is already probing (FloorFifty `BACKGROUND_PING_MS`).
    yield* Effect.forkScoped(
      Effect.sync(() => {
        if ((connection === 'connected' || connection === 'degraded') && now() - lastPingAt >= PROBE_EVERY_MS)
          port.ping(-1)
      }).pipe(Effect.repeat(Schedule.spaced(PROBE_EVERY_MS))),
    )

    // Closing the scope closes the socket without giving up the seat: the stored token stays for the next page
    // load's `resume` (FloorFifty "disposes the transport without surrendering the reload seat").
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        disposed = true
        invalidate()
        const room = detach()
        hub.close()
        room?.connection.close()
        setConnection('offline')
      }),
    )

    const service: NetRoom = {
      create: ({ name }) => enter('create', name, (client, join) => client.create(ROOM_NAME, join)),
      join: (code, { name }) => enter('join', name, (client, join) => client.joinById(code, join)),
      quickMatch: ({ name }) =>
        enter('quickMatch', name, async (client, join, gen) => {
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
        if (connection === 'connected' || connection === 'degraded') setConnection('connected')
      },
      resume,
      info: infoRef,
      connection: connectionRef,
      ended: endedRef,
      port,
    }
    return service
  })
}

/** `NetRoom` as a scoped layer. */
export function netRoomLayer(options: NetRoomOptions): Layer.Layer<NetRoom> {
  return Layer.scoped(NetRoom, makeNetRoom(options))
}
