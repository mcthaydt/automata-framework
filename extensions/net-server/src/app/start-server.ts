/**
 * The server process, on Effect.
 *
 * `createServerRuntime` acquires the HTTP server and the Colyseus transport in the caller's scope, defines the one
 * room type with its context bound in, and listens. Closing the scope shuts Colyseus down (every room disposes)
 * and closes the listener. `startServer` is that runtime plus the drain on the first SIGTERM, and never returns.
 *
 * Effect runs the process (ADR 0003): services, the scope, the clock and errors. The per-tick path is the room's
 * plain code, driven by a tick clock that reads Effect's `Clock`.
 *
 * The gates in front of Colyseus wrap
 * this listener's `request` and `upgrade` handlers (`installGates`).
 *
 * Operations: the runtime refuses a test switch in production (`process-safety.ts`), gives Colyseus a logger
 * that writes no text, puts `/health`, `/ready` and security.txt in front of Colyseus's router (`probes.ts`), and is
 * ready only once the game's content has loaded: it listens first, so `/health` answers while it loads, and beside
 * the listener reads the game's version from one throwaway sim (`gameVersionOf`), then logs `server.started`. Until
 * then matchmaking is refused `SERVER_UPDATING`, since no join can be checked against a version not yet read. Each
 * room verifies a joining player's session with `config.verifier`.
 */

import { randomInt } from 'node:crypto'
import { createServer, type Server as HttpServer } from 'node:http'
import { MAX_MESSAGE_BYTES, ROOM_NAME } from '@automata/net'
import { Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { type Cause, type Clock, Data, Effect, type Scope } from 'effect'
import { createMatchmakeGate } from '../features/gates/matchmake-gate'
import { type OriginPolicy, originPolicy } from '../features/gates/origins'
import { installGates } from '../features/gates/server-gates'
import { createSocketGate, type SocketGate, socketTotal } from '../features/gates/socket-gate'
import { createUpgradeGate } from '../features/gates/upgrade-gate'
import { DRAIN_MAX_MS, type DrainResult, drainOnSigterm, drainRooms } from '../features/operations/drain'
import { colyseusLogger } from '../features/operations/log-writer'
import { installProbes, type Readiness } from '../features/operations/probes'
import { testSwitchesSet } from '../features/operations/process-safety'
import { type AutomataRoom, roomClassFor } from '../features/room/engine/automata-room'
import { LiveRooms } from '../features/room/rules/live-rooms'
import type { TickClock } from '../features/room/rules/tick-scheduler'
import type { ServerConfig } from '../shared/game/server-config'
import type { ServerDef } from '../shared/game/server-game'
import { type GameVersion, gameVersionOf } from '../shared/game-version'
import { anonymousVerifier, type SessionVerifier } from '../shared/session-verifier'

type TaggedErrorClass<Tag extends string, Fields> = new (
  fields: Fields,
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<Fields>

const ServerStartErrorBase: TaggedErrorClass<
  'ServerStartError',
  { readonly reason: string; readonly cause?: unknown }
> = Data.TaggedError('ServerStartError')

/** The server could not start: a config no server can run with, or a listener that could not bind. */
export class ServerStartError extends ServerStartErrorBase {}

export interface ServerRuntime {
  /** The port the listener bound: the one asked for, or the operating system's choice for port 0. */
  readonly port: number
  /** The address the listener bound: the configured host, or Node's wildcard (`::` or `0.0.0.0`) with none. */
  readonly host: string
  readonly gameServer: Server
  readonly rooms: LiveRooms<AutomataRoom>
  readonly draining: boolean
  /** What `/ready` reports: `ready` once the content has loaded, `full` at the room cap, `draining` after SIGTERM. */
  readonly readiness: Readiness
  /** The origin list every route answers with. */
  readonly origins: OriginPolicy
  /** The protocol and hashes a client must match to join; undefined until read. */
  readonly version: GameVersion | undefined
  /** The open sockets the gates count, per address and in all. */
  readonly sockets: Pick<SocketGate, 'open' | 'addresses'>
  /**
   * Opens no room and seats nobody new, tells every room, waits for them to finish (at most the cap), then shuts
   * Colyseus down. Runs once: a second run returns the first result.
   */
  readonly drain: Effect.Effect<DrainResult>
}

/**
 * The room's tick clock on Effect's `Clock`: time is the clock's (TestClock in a test), and the wake-up is a Node
 * timer, which the clock does not own. A test that needs exact ticks stops the room's clock and steps it by hand.
 */
export function tickClockFrom(clock: Clock.Clock): TickClock {
  return {
    now: () => clock.unsafeCurrentTimeMillis(),
    setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }
}

/**
 * A WebSocket frame may be this much larger than `maxMessageBytes`: Colyseus's envelope (its protocol byte and the
 * channel name) around net's text. A message within the cap reaches the room, which drops one past it before
 * parsing; a frame far past it is closed by the transport, so no frame is ever buffered unbounded.
 */
const WS_ENVELOPE_BYTES = 1_024

const isBucket = (bucket: { readonly burst: number; readonly perSecond: number } | undefined): boolean =>
  bucket !== undefined && bucket.burst > 0 && bucket.perSecond >= 0

/** The limits no server can run without. */
function configProblem(config: ServerConfig): string | undefined {
  const { limits } = config
  if (!Number.isInteger(limits.maxRooms) || limits.maxRooms < 1)
    return 'maxRooms must be a whole number from 1'
  if (
    !Array.isArray(limits.allowedOrigins) ||
    !limits.allowedOrigins.every((origin) => typeof origin === 'string')
  )
    return 'allowedOrigins must be a list of origins'
  try {
    originPolicy(limits.allowedOrigins)
  } catch (error) {
    return (error as Error).message
  }
  if (
    !Number.isInteger(limits.maxMessageBytes) ||
    limits.maxMessageBytes < 1 ||
    limits.maxMessageBytes > MAX_MESSAGE_BYTES
  )
    return `maxMessageBytes must be a whole number from 1 to net's ${MAX_MESSAGE_BYTES}`
  if (!Number.isInteger(limits.socketsPerIp) || limits.socketsPerIp < 1)
    return 'socketsPerIp must be a whole number from 1'
  const perIp = limits.perIp as Partial<ServerConfig['limits']['perIp']> | undefined
  for (const name of ['create', 'join', 'quickMatch', 'reconnect'] as const)
    if (!isBucket(perIp?.[name])) return `perIp.${name} needs a burst above 0`
  const bucket = limits.commandsPerSeat
  if (!(bucket.burst > 0) || !(bucket.perSecond >= 0)) return 'commandsPerSeat needs a burst above 0'
  if (!Number.isInteger(config.port) || config.port < 0) return 'port must be a whole number from 0'
  if (config.host !== undefined && (typeof config.host !== 'string' || config.host.trim() === ''))
    return 'host must be an address, or unset'
  return undefined
}

/**
 * Whether a session token verifies, on the server's clock. A verifier that fails in any other way than refusing the
 * token refuses it too: a join is never seated because verification broke.
 */
function sessionCheck(verifier: SessionVerifier, clock: Clock.Clock): (token: string) => Promise<boolean> {
  return (token) =>
    Effect.runPromise(
      verifier.verify(token).pipe(
        Effect.withClock(clock),
        Effect.as(true),
        Effect.catchAllCause(() => Effect.succeed(false)),
      ),
    )
}

const close = (http: HttpServer): Promise<void> =>
  new Promise((resolve) => {
    http.closeAllConnections()
    http.close(() => resolve())
  })

export function createServerRuntime(
  def: ServerDef,
  config: ServerConfig,
): Effect.Effect<ServerRuntime, ServerStartError, Scope.Scope> {
  return Effect.gen(function* () {
    const problem = configProblem(config)
    if (problem !== undefined) return yield* new ServerStartError({ reason: problem })
    const env = config.env ?? process.env
    // The process's own environment is read too: a config's `env` can say `test` on a production box.
    const switches = testSwitchesSet(config, env, process.env)
    if (switches.length > 0)
      return yield* new ServerStartError({
        reason: `refusing to start in production with ${switches.join(', ')} set`,
      })

    const clock = yield* Effect.clock
    const rooms = new LiveRooms<AutomataRoom>()
    const log = config.log ?? (() => undefined)
    let draining = false
    // Read beside the listener (below): until then the server is `starting` and refuses matchmaking.
    let version: GameVersion | undefined
    const origins = originPolicy(config.limits.allowedOrigins)

    const http = createServer()
    const gameServer = new Server({
      transport: new WebSocketTransport({
        server: http,
        // Pinned from the limit, so a library upgrade cannot move it.
        maxPayload: config.limits.maxMessageBytes + WS_ENVELOPE_BYTES,
      }),
      // Colyseus would otherwise take SIGTERM itself and disconnect every room at once, ending the games a drain
      // exists to let finish. `startServer` owns the signal.
      gracefullyShutdown: false,
      greet: false,
      logger: colyseusLogger(log),
    })
    gameServer.define(
      ROOM_NAME,
      roomClassFor({
        def,
        net: config.net,
        maxRooms: config.limits.maxRooms,
        commandsPerSeat: config.limits.commandsPerSeat,
        maxMessageBytes: config.limits.maxMessageBytes,
        version: () => version,
        rooms,
        clock: tickClockFrom(clock),
        isDraining: () => draining,
        randomInt: (max) => randomInt(max),
        roomSeed: () => config.seed ?? randomInt(2 ** 32),
        env,
        log,
        manualClock: config.manualClock === true,
        verifySession: sessionCheck(config.verifier ?? anonymousVerifier, clock),
      }),
    )

    let shutDown: Promise<void> | undefined
    const shutdown = (): Promise<void> => {
      shutDown ??= gameServer.gracefullyShutdown(false).then(() => close(http))
      return shutDown
    }
    yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => gameServer.listen(config.port, config.host),
        catch: (cause) => new ServerStartError({ reason: `could not listen on port ${config.port}`, cause }),
      }),
      () => Effect.promise(shutdown),
    )
    const address = http.address()
    const port = typeof address === 'object' && address !== null ? address.port : config.port
    const host = typeof address === 'object' && address !== null ? address.address : (config.host ?? '')

    // Colyseus bound its listeners at `listen()`; the gates go in front of them.
    const refused = (code: string): void => log({ event: 'refused', code })
    const sockets = createSocketGate({
      maxPerIp: config.limits.socketsPerIp,
      maxTotal: socketTotal(config.limits.maxRooms, def.game.seats.max),
    })
    const removeGates = installGates(http, {
      origins,
      matchmake: createMatchmakeGate({
        origins,
        isDraining: () => draining,
        perIp: config.limits.perIp,
        maxBodyBytes: config.limits.maxMessageBytes,
        version: () => version,
        now: () => clock.unsafeCurrentTimeMillis(),
        onRefused: refused,
      }),
      upgrade: createUpgradeGate({
        origins,
        sockets,
        onRefused: refused,
      }),
    })
    yield* Effect.addFinalizer(() => Effect.sync(removeGates))
    // Colyseus keeps the port it was asked for; a client built from it (the SDK, @colyseus/testing) needs the real one.
    ;(gameServer as unknown as { port: number }).port = port
    // Ready means a new room would open: content loaded, not draining, and under the room cap.
    const readiness = (): Readiness => {
      if (draining) return 'draining'
      if (version === undefined) return 'starting'
      return rooms.size >= config.limits.maxRooms ? 'full' : 'ready'
    }
    installProbes(http, { readiness, securityTxt: config.securityTxt })

    // The game's version (its schema and content hashes) is read from one throwaway sim of it, which is also the proof
    // that its content loads. The read runs beside the server rather than ahead of it: `/health` answers meanwhile,
    // matchmaking is refused `SERVER_UPDATING`, and a plugin whose engine takes its time holds up readiness, not the
    // process. Content that cannot build a sim leaves the server alive and never ready, which a deploy reads as a
    // build that must not go live; the line names the cause by kind only.
    yield* Effect.forkScoped(
      Effect.tryPromise(() => gameVersionOf(def)).pipe(
        Effect.match({
          onFailure: () => log({ event: 'start.refused', code: 'content' }),
          onSuccess: (read) => {
            version = read
            log({ event: 'server.started' })
          },
        }),
      ),
    )

    const drain = yield* Effect.cached(
      Effect.gen(function* () {
        draining = true
        log({ event: 'drain.started', count: rooms.size })
        // Every room hears it once. One that cannot hear it never keeps the rest from hearing.
        for (const room of [...rooms]) {
          try {
            room.beginDrain()
          } catch {
            log({ event: 'refused', code: 'drain' })
          }
        }
        const result = yield* drainRooms(rooms, { capMs: config.drainCapMs ?? DRAIN_MAX_MS })
        yield* Effect.promise(shutdown)
        log({ event: 'drain.done', code: result })
        return result
      }),
    )

    return {
      port,
      host,
      gameServer,
      rooms,
      get draining() {
        return draining
      },
      get readiness() {
        return readiness()
      },
      origins,
      get version() {
        return version
      },
      sockets,
      drain,
    }
  })
}

/**
 * Starts the server and keeps it: listens, then drains on the first SIGTERM and exits (0 drained, 1 failed). Fails
 * with `ServerStartError` before listening when the config cannot run. Closing the scope shuts it down.
 */
export function startServer(
  def: ServerDef,
  config: ServerConfig,
): Effect.Effect<never, ServerStartError, Scope.Scope> {
  return Effect.gen(function* () {
    const runtime = yield* createServerRuntime(def, config)
    return yield* drainOnSigterm(
      config.signals ?? process,
      runtime.drain,
      config.exit ?? ((code) => process.exit(code)),
    )
  })
}
