/**
 * Two promises a production server keeps (M7 spec §4.3 process safety; FloorFifty `process-safety.ts`).
 *
 * - It refuses to start with a test switch set, naming each, so a test's config copied into a game's server entry
 *   cannot fix every room's seed, stop every room's clock or let a fake verifier accept made-up players. It also
 *   refuses an empty origin list, which no player could reach. The room cap and the list's presence are
 *   `startServer`'s own refusal; the environment file's `MAX_ROOMS` and `ALLOWED_ORIGINS` are `server-process.ts`'.
 * - It is not kept alive in an unknown state: an error nothing caught writes one `fatal` line, which stays in the
 *   box's journal, and the process exits 1 for systemd to restart. The line names the error's class only, since its
 *   message and stack can echo what a client sent (spec §4.5: no field holds a payload).
 *
 * FloorFifty's test switches were environment variables (a driver token, a seed, verbose telemetry); AF's are
 * `ServerConfig` fields, read with the environment the config carries (never `process.env` here).
 */

import type { RoomLogEvent, ServerConfig } from '../game/server-config'
import { isTestVerifier } from '../session/session-verifier'

/** Each test switch set, or a production limit missing, while `NODE_ENV` is `production`; empty elsewhere. */
export function testSwitchesSet(
  config: ServerConfig,
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  if (env.NODE_ENV !== 'production') return []
  const set: string[] = []
  if (config.seed !== undefined) set.push('seed')
  if (config.manualClock === true) set.push('manualClock')
  if (config.verifier !== undefined && isTestVerifier(config.verifier)) set.push('verifier (fake)')
  if (Array.isArray(config.limits.allowedOrigins) && config.limits.allowedOrigins.length === 0)
    set.push('allowedOrigins (empty)')
  return set
}

/** Where crashes are heard: `process` in production, an emitter in a test. */
export interface CrashTarget {
  on(event: 'unhandledRejection' | 'uncaughtException', handler: (error: unknown) => void): unknown
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.-]{0,47}$/

/** The error's class as the log line's `code`: `Error` for a thrown non-error or a class name that is not a name. */
function errorClass(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error'
  return IDENTIFIER.test(name) ? name : 'Error'
}

export function installCrashHandlers(
  target: CrashTarget,
  log: (event: RoomLogEvent) => void,
  exit: (code: number) => void,
): void {
  const fatal = (error: unknown): void => {
    log({ event: 'fatal', code: errorClass(error) })
    exit(1)
  }
  target.on('unhandledRejection', fatal)
  target.on('uncaughtException', fatal)
}
