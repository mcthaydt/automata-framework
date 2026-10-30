/**
 * The server process, on Effect (M7 spec §4.3 `startServer`, FloorFifty `colyseus-server.ts` and `main.ts` with the
 * race, the content route, telemetry and the gates left behind).
 *
 * `createServerRuntime` acquires the HTTP server and the Colyseus transport in the caller's scope, defines the one
 * room type with its context bound in, and listens. Closing the scope shuts Colyseus down (every room disposes)
 * and closes the listener. `startServer` is that runtime plus the drain on the first SIGTERM, and never returns.
 *
 * Effect runs the process (ADR 0003): services, the scope, the clock and errors. The per-tick path is the room's
 * plain code, driven by a tick clock that reads Effect's `Clock`.
 *
 * Operations (M7.4b): the runtime refuses a test switch in production (`process-safety.ts`), gives Colyseus a logger
 * that writes no text, puts `/health`, `/ready` and security.txt in front of Colyseus's router (`probes.ts`), and is
 * ready only once the game's content has loaded: it listens first, so `/health` answers while it loads, and beside
 * the server builds one throwaway sim from the game's plugins and content, then logs `server.started`. Each room verifies a joining
 * player's session with `config.verifier` (anonymous until R-13).
 *
 * Seam for M7.4a: the gates in front of Colyseus (origins, the size cap, per-IP buckets, sockets and the version
 * gate) wrap this listener's `request` and `upgrade` handlers as FloorFifty's do.
 */

import { randomInt } from 'node:crypto'
import { createServer, type Server as HttpServer } from 'node:http'
import { Server } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ROOM_NAME } from '@mcthaydt/automata-net'
import { createSim } from '@mcthaydt/automata-sim'
import { type Cause, type Clock, Data, Effect, type Scope } from 'effect'
import type { ServerConfig } from '../game/server-config'
import type { ServerDef } from '../game/server-game'
import { type AutomataRoom, roomClassFor } from '../room/automata-room'
import { LiveRooms } from '../rooms/live-rooms'
import type { TickClock } from '../rooms/tick-scheduler'
import { anonymousVerifier, type SessionVerifier } from '../session/session-verifier'
import { DRAIN_MAX_MS, type DrainResult, drainOnSigterm, drainRooms } from './drain'
import { colyseusLogger } from './log-writer'
import { installProbes, type Readiness } from './probes'
import { testSwitchesSet } from './process-safety'

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
  readonly gameServer: Server
  readonly rooms: LiveRooms<AutomataRoom>
  readonly draining: boolean
  /** What `/ready` reports: `ready` once the content has loaded, until a drain. */
  readonly readiness: Readiness
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

/** The limits no server can run without (spec §4.3: `startServer` refuses without the first two). */
function configProblem(config: ServerConfig): string | undefined {
  const { limits } = config
  if (!Number.isInteger(limits.maxRooms) || limits.maxRooms < 1)
    return 'maxRooms must be a whole number from 1'
  if (
    !Array.isArray(limits.allowedOrigins) ||
    !limits.allowedOrigins.every((origin) => typeof origin === 'string')
  )
    return 'allowedOrigins must be a list of origins'
  const bucket = limits.commandsPerSeat
  if (!(bucket.burst > 0) || !(bucket.perSecond >= 0)) return 'commandsPerSeat needs a burst above 0'
  if (!Number.isInteger(config.port) || config.port < 0) return 'port must be a whole number from 0'
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
    const switches = testSwitchesSet(config, env)
    if (switches.length > 0)
      return yield* new ServerStartError({
        reason: `refusing to start in production with ${switches.join(', ')} set`,
      })

    const clock = yield* Effect.clock
    const rooms = new LiveRooms<AutomataRoom>()
    const log = config.log ?? (() => undefined)
    let draining = false
    let loaded = false

    const http = createServer()
    const gameServer = new Server({
      transport: new WebSocketTransport({ server: http }),
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
        try: () => gameServer.listen(config.port),
        catch: (cause) => new ServerStartError({ reason: `could not listen on port ${config.port}`, cause }),
      }),
      () => Effect.promise(shutdown),
    )
    const address = http.address()
    const port = typeof address === 'object' && address !== null ? address.port : config.port
    // Colyseus keeps the port it was asked for; a client built from it (the SDK, @colyseus/testing) needs the real one.
    ;(gameServer as unknown as { port: number }).port = port
    const readiness = (): Readiness => (draining ? 'draining' : loaded ? 'ready' : 'starting')
    installProbes(http, { readiness, securityTxt: config.securityTxt })

    // Rooms build their sims from this content, so the server is ready once one throwaway sim has been built from it.
    // The load runs beside the server rather than ahead of it: `/health` answers meanwhile, and a plugin whose engine
    // takes its time holds up readiness, not the process. Content that cannot build a sim leaves the server never
    // ready, which a deploy reads as a build that must not go live; the line names the cause by kind only.
    yield* Effect.forkScoped(
      Effect.tryPromise(() =>
        createSim({ seed: 0, plugins: def.game.plugins, content: def.game.content }),
      ).pipe(
        Effect.match({
          onFailure: () => log({ event: 'start.refused', code: 'content' }),
          onSuccess: (sim) => {
            sim.dispose()
            loaded = true
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
      gameServer,
      rooms,
      get draining() {
        return draining
      },
      get readiness() {
        return readiness()
      },
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
