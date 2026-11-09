/**
 * From a log event to a log line.
 *
 * Redaction is by allowlist, not by search: a line is built from the schema's fields alone, so a token, session id,
 * authorization header, address, name, room code or payload that reached an event under any other key is never
 * copied. The line is then parsed by `serverLogLine`, whose narrowed `room` and `code` refuse an address, a bearer
 * header or a sentence. A line that fails is not written as it came, nor with the failing value: `log.invalid` is
 * written in its place, so the operator still sees that something was logged wrongly.
 */

import type { RoomLogEvent } from '../../shared/game/server-config'
import { type LogLevel, type ServerLogLine, serverLogLine } from './server-log-line.schema'

const FIELDS = ['room', 'seat', 'code', 'ms', 'count'] as const

const FATAL: ReadonlySet<string> = new Set(['fatal', 'start.refused'])
const WARN: ReadonlySet<string> = new Set([
  'refused',
  'tick.slow',
  'step.slow',
  'input.late',
  'room.error',
  'replay.failed',
  'log.invalid',
  'colyseus.warn',
  'colyseus.error',
])

/** A crash or a refusal to start is fatal; a refusal, a slow or late tick and a room's error warn; the rest inform. */
export function levelOf(event: string): LogLevel {
  if (FATAL.has(event)) return 'fatal'
  if (WARN.has(event)) return 'warn'
  return 'info'
}

/** The line an event becomes, with only the schema's fields copied. Not yet validated. */
export function toLogLine(event: { readonly event: string } & object, ts: number): ServerLogLine {
  const source = event as Readonly<Record<string, unknown>>
  const line: Record<string, unknown> = { ts, level: levelOf(event.event), event: event.event }
  for (const field of FIELDS) if (source[field] !== undefined) line[field] = source[field]
  return line as unknown as ServerLogLine
}

/** Where a finished log line is written and the clock that stamps it. */
export interface LogWriterOptions {
  /** Where a finished line goes, newline included [`process.stdout.write` in production]. */
  readonly write: (line: string) => void
  /** Milliseconds since the epoch, for `ts`. */
  readonly now: () => number
}

/** The server's `log`: each event becomes one validated JSON line. */
export function createLogWriter(options: LogWriterOptions): (event: RoomLogEvent) => void {
  return (event) => {
    const ts = Math.trunc(options.now())
    const parsed = serverLogLine.safeParse(toLogLine(event, ts))
    const line = parsed.success ? parsed.data : { ts, level: levelOf('log.invalid'), event: 'log.invalid' }
    options.write(`${JSON.stringify(line)}\n`)
  }
}

/** The logger Colyseus is given (`new Server({ logger })`). */
export interface ColyseusLogger {
  debug(...args: unknown[]): void
  error(...args: unknown[]): void
  info(...args: unknown[]): void
  trace(...args: unknown[]): void
  warn(...args: unknown[]): void
}

/**
 * Colyseus logs to the console by default, and its text can hold a room id (the room code) or what a client sent.
 * Its errors and warnings become text-free lines, so the operator still hears of them; the rest is dropped.
 */
export function colyseusLogger(log: (event: RoomLogEvent) => void): ColyseusLogger {
  const ignore = (): void => undefined
  return {
    debug: ignore,
    info: ignore,
    trace: ignore,
    error: () => log({ event: 'colyseus.error' }),
    warn: () => log({ event: 'colyseus.warn' }),
  }
}
