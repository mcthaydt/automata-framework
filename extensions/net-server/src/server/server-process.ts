/**
 * The production entry (M7 spec §4.3 process safety, §4.6's env file; FloorFifty `main.ts`).
 *
 * A game's `server.ts` calls `runServerProcess` with its `ServerDef`, its `net.toml` and the limits that are not the
 * environment's. The box's `/etc/<game>/env` gives `NODE_ENV=production`, `MAX_ROOMS` and `ALLOWED_ORIGINS` (and
 * `PORT`, and security.txt's `SECURITY_CONTACT` and `SECURITY_EXPIRES`); the server refuses to start without the
 * room cap and the origin list, naming each in a `start.refused` line. Then: crash handlers that write one `fatal`
 * line and exit 1, the redacted stdout writer as `log`, and `startServer`, which refuses a test switch in production
 * and drains on SIGTERM.
 *
 * The environment and the process are injected (`env`, `process`); only the defaults read Node's globals, here at
 * the edge and never inside the logic.
 */

import type { NetConfig } from '@automata/net'
import { Effect, type Scope } from 'effect'
import type { ServerConfig, ServerLimits, SignalSource } from '../game/server-config'
import type { ServerDef } from '../game/server-game'
import type { SessionVerifier } from '../session/session-verifier'
import { createLogWriter } from './log-writer'
import type { SecurityTxt } from './probes'
import { type CrashTarget, installCrashHandlers } from './process-safety'
import { ServerStartError, startServer } from './start-server'

type Env = Readonly<Record<string, string | undefined>>

/** What a game gives its server beside the environment's limits. */
export interface EnvServerBase {
  readonly net: NetConfig
  readonly limits: Omit<ServerLimits, 'maxRooms' | 'allowedOrigins'>
  /** [`anonymousVerifier`]; the Ruken verifier arrives with R-13. */
  readonly verifier?: SessionVerifier | undefined
}

/** The port when `PORT` is unset. */
const DEFAULT_PORT = 3000

export type EnvConfigResult =
  | { readonly ok: true; readonly config: ServerConfig }
  | { readonly ok: false; readonly problems: string[] }

/** The server's config from its environment, or the name of each variable that is missing or not valid. */
export function serverConfigFromEnv(env: Env, base: EnvServerBase): EnvConfigResult {
  const problems: string[] = []
  const port = env.PORT === undefined ? DEFAULT_PORT : Number(env.PORT)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) problems.push('PORT')
  const maxRooms = Number(env.MAX_ROOMS)
  if (!Number.isInteger(maxRooms) || maxRooms < 1) problems.push('MAX_ROOMS')
  // Exact origins, comma-separated; checking each one's shape is the origin gate's (M7.4a).
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
  if (allowedOrigins.length === 0) problems.push('ALLOWED_ORIGINS')
  if (problems.length > 0) return { ok: false, problems }

  const securityTxt: SecurityTxt | undefined =
    env.SECURITY_CONTACT !== undefined && env.SECURITY_EXPIRES !== undefined
      ? { contact: env.SECURITY_CONTACT, expires: env.SECURITY_EXPIRES }
      : undefined
  return {
    ok: true,
    config: {
      port,
      limits: { ...base.limits, maxRooms, allowedOrigins },
      net: base.net,
      env,
      verifier: base.verifier,
      securityTxt,
    },
  }
}

export interface ServerProcessOptions extends EnvServerBase {
  /** [`process.env`] */
  readonly env?: Env | undefined
  /** Where log lines go [`process.stdout.write`]. */
  readonly write?: ((line: string) => void) | undefined
  /** The log lines' clock, in epoch milliseconds [`Date.now`]. */
  readonly now?: (() => number) | undefined
  /** Crashes and SIGTERM [`process`]. */
  readonly process?: (CrashTarget & SignalSource) | undefined
  /** [`process.exit`] */
  readonly exit?: ((code: number) => void) | undefined
}

/**
 * Runs a game's server as a production process and never returns. Fails with `ServerStartError` (after one
 * `start.refused` line per problem) when the environment lacks what the server cannot run without.
 */
export function runServerProcess(
  def: ServerDef,
  options: ServerProcessOptions,
): Effect.Effect<never, ServerStartError, Scope.Scope> {
  return Effect.gen(function* () {
    const target = options.process ?? process
    const exit = options.exit ?? ((code: number) => process.exit(code))
    const log = createLogWriter({
      write: options.write ?? ((line) => process.stdout.write(line)),
      now: options.now ?? (() => Date.now()),
    })
    const result = serverConfigFromEnv(options.env ?? process.env, options)
    if (!result.ok) {
      for (const problem of result.problems) log({ event: 'start.refused', code: problem })
      return yield* new ServerStartError({
        reason: `refusing to start without ${result.problems.join(', ')}`,
      })
    }
    installCrashHandlers(target, log, exit)
    return yield* startServer(def, { ...result.config, log, signals: target, exit })
  })
}
