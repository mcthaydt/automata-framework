/**
 * Two promises a production server keeps.
 *
 * - It refuses to start with a test switch set, naming each, so a test's config copied into a game's server entry
 *   cannot fix every room's seed, stop every room's clock or let a fake verifier accept made-up players. It also
 *   refuses an empty origin list, which no player could reach. The room cap and the list's presence are
 *   `startServer`'s own refusal; the environment file's `MAX_ROOMS` and `ALLOWED_ORIGINS` are `server-process.ts`'.
 * - It is not kept alive in an unknown state: an error nothing caught writes one `fatal` line, which stays in the
 *   box's journal, and the process exits 1 for systemd to restart. The line names the error's class only, since its
 *   message and stack can echo what a client sent.
 *
 * The test switches are `ServerConfig` fields, not environment variables. The caller passes every environment that could say production (the config's own and the
 * process's), never reading `process.env` here: any one saying so makes it production, so a test config copied onto
 * a production box cannot vouch for itself. `NODE_ENV` is read trimmed and in any case, so an env file with CRLF
 * endings still counts.
 *
 * `DEBUG` naming a Colyseus namespace is refused too: Colyseus's `debug` loggers print to the console directly
 * (`colyseus:errors` writes whole stacks with `console.error`, `colyseus:message` every payload), past the redacted
 * writer. The `debug` module reads `DEBUG` once, when Colyseus loads, so it is refused rather than turned off.
 */

import type { RoomLogEvent, ServerConfig } from '../../shared/game/server-config'
import { isTestVerifier } from '../../shared/session-verifier'

type Env = Readonly<Record<string, string | undefined>>

/** Whether an environment says production: `NODE_ENV`, trimmed and lowercased, is `production`. */
export function isProduction(env: Env): boolean {
  return env.NODE_ENV?.trim().toLowerCase() === 'production'
}

/** Colyseus's `debug` namespaces (`@colyseus/core` `Debug.ts`). */
const COLYSEUS_DEBUG_NAMESPACES: readonly string[] = [
  'connection',
  'driver',
  'matchmaking',
  'message',
  'patch',
  'presence',
  'errors',
  'devmode',
].map((name) => `colyseus:${name}`)

/** A `DEBUG` pattern as the `debug` module reads one: `*` matches anything, everything else is literal. */
function debugPattern(pattern: string): RegExp {
  const literal = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*?')
  return new RegExp(`^${literal}$`)
}

/**
 * Whether `DEBUG` turns on any Colyseus namespace, by the `debug` module's rule: patterns split on commas and
 * whitespace, and a `-` pattern turns a namespace off whatever else matches it.
 */
export function colyseusDebugEnabled(env: Env): boolean {
  const patterns = (env.DEBUG ?? '').split(/[\s,]+/).filter((pattern) => pattern !== '')
  const skips = patterns
    .filter((pattern) => pattern.startsWith('-'))
    .map((pattern) => debugPattern(pattern.slice(1)))
  const names = patterns.filter((pattern) => !pattern.startsWith('-')).map(debugPattern)
  return COLYSEUS_DEBUG_NAMESPACES.some(
    (namespace) => !skips.some((skip) => skip.test(namespace)) && names.some((name) => name.test(namespace)),
  )
}

/** Each test switch set, or a production limit missing, when any of `envs` says production; empty otherwise. */
export function testSwitchesSet(config: ServerConfig, ...envs: readonly Env[]): string[] {
  if (!envs.some(isProduction)) return []
  const set: string[] = []
  if (config.seed !== undefined) set.push('seed')
  if (config.manualClock === true) set.push('manualClock')
  if (config.verifier !== undefined && isTestVerifier(config.verifier)) set.push('verifier (fake)')
  if (Array.isArray(config.limits.allowedOrigins) && config.limits.allowedOrigins.length === 0)
    set.push('allowedOrigins (empty)')
  if (envs.some(colyseusDebugEnabled)) set.push('DEBUG (colyseus)')
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

/**
 * Makes an error nothing caught write one fatal log line, naming the error's class only, and end
 * the process with code 1 so the supervisor restarts it.
 */
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
