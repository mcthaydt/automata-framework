#!/usr/bin/env node
/**
 * `automata-server report <log-file> [--days N] [--json]` (M7 spec §4.5 "Weekly report"; FloorFifty
 * `deploy/bin/report.mjs`).
 *
 * Reads a server's log lines (journald's `-o cat` output) and prints what the last 7 days say: restarts, fatal
 * classes, sockets given up, slow ticks (and slow steps), refusals by limit and peak live rooms. Run weekly, and
 * after every release; M7.7's deploy runs it on the box.
 *
 * Node runs this file from source on the box, so it imports nothing but Node: no relative module (the package's
 * imports carry no `.ts` suffix, which Node's type stripping needs) and no schema. It reads lines leniently and keeps
 * counts; a line that is not one of the server's is skipped. The lines were validated by `serverLogLine` when they
 * were written, and none holds an address, a name, a room code or a token, so nothing here could print one.
 */

import { readFileSync } from 'node:fs'

const DAY_MS = 86_400_000

export interface ReportCounts {
  /** `server.started` lines: each start of a server process, restarts after a crash or a deploy included. */
  restarts: number
  /** `fatal` lines by the error's class; a refused start as `start.<cause>`. */
  fatalByClass: Record<string, number>
  /** Seats given up after their connection dropped and the grace ran out (`seat.left` with `code: 'grace'`). */
  socketsGivenUp: number
  /** `tick.slow` lines: the room's timer fell behind and dropped time (at most one a room every ten seconds). */
  slowTicks: number
  /** `step.slow` lines: a step took more than half its tick. */
  slowSteps: number
  /** `refused` lines by the limit that refused. */
  refusedByLimit: Record<string, number>
  /** The most rooms open at once, counted from each start (`room.created` less `room.disposed`). */
  peakRooms: number
}

/**
 * A table keyed by codes read from the log, so it has no prototype: a code such as `constructor`, `toString` or
 * `__proto__` is counted like any other, never read from or written into `Object.prototype`.
 */
const newTable = (): Record<string, number> => Object.create(null) as Record<string, number>

const bump = (table: Record<string, number>, key: string): void => {
  // A code is only ever a key here: `Object.hasOwn` ignores anything a prototype could answer.
  table[key] = (Object.hasOwn(table, key) ? (table[key] as number) : 0) + 1
}

/** A log line's fields, or undefined for a line that is not one of the server's. */
function parse(line: string): { ts: number; event: string; code: string | undefined } | undefined {
  if (!line.startsWith('{')) return undefined
  let record: unknown
  try {
    record = JSON.parse(line)
  } catch {
    return undefined
  }
  if (record === null || typeof record !== 'object') return undefined
  const { ts, event, code } = record as Record<string, unknown>
  if (typeof ts !== 'number' || typeof event !== 'string') return undefined
  return { ts, event, code: typeof code === 'string' ? code : undefined }
}

export function summarizeLog(
  lines: Iterable<string>,
  options: { readonly nowMs: number; readonly days: number },
): ReportCounts {
  const since = options.nowMs - options.days * DAY_MS
  const counts: ReportCounts = {
    restarts: 0,
    fatalByClass: newTable(),
    socketsGivenUp: 0,
    slowTicks: 0,
    slowSteps: 0,
    refusedByLimit: newTable(),
    peakRooms: 0,
  }
  let live = 0
  for (const text of lines) {
    const line = parse(text.trim())
    if (line === undefined || line.ts < since) continue
    switch (line.event) {
      case 'server.started':
        counts.restarts += 1
        // A new process has no rooms; the last one's never wrote their `room.disposed` if it crashed.
        live = 0
        break
      case 'fatal':
        bump(counts.fatalByClass, line.code ?? 'unknown')
        break
      case 'start.refused':
        bump(counts.fatalByClass, `start.${line.code ?? 'unknown'}`)
        break
      case 'seat.left':
        if (line.code === 'grace') counts.socketsGivenUp += 1
        break
      case 'tick.slow':
        counts.slowTicks += 1
        break
      case 'step.slow':
        counts.slowSteps += 1
        break
      case 'refused':
        bump(counts.refusedByLimit, line.code ?? 'unknown')
        break
      case 'room.created':
        live += 1
        counts.peakRooms = Math.max(counts.peakRooms, live)
        break
      case 'room.disposed':
        live = Math.max(0, live - 1)
        break
      default:
    }
  }
  return counts
}

const table = (entries: Record<string, number>): string => {
  const keys = Object.keys(entries).sort()
  return keys.length === 0 ? 'none' : keys.map((key) => `${key} ${entries[key]}`).join(', ')
}

export function formatReport(counts: ReportCounts): string {
  return [
    `restarts             ${counts.restarts}`,
    `fatal by class       ${table(counts.fatalByClass)}`,
    `sockets given up     ${counts.socketsGivenUp}`,
    `slow ticks           ${counts.slowTicks}`,
    `slow steps           ${counts.slowSteps}`,
    `refused by limit     ${table(counts.refusedByLimit)}`,
    `peak live rooms      ${counts.peakRooms}`,
    '',
  ].join('\n')
}

export interface CliIo {
  readonly readFile: (path: string) => string
  readonly nowMs: number
  readonly stdout: (text: string) => void
  readonly stderr: (text: string) => void
}

const USAGE = 'usage: automata-server report <log-file> [--days N] [--json]\n'

/** Runs one command and returns the exit code: 0 done, 1 the file could not be read, 2 a usage error. */
export function runCli(argv: readonly string[], io: CliIo): number {
  const [command, file, ...rest] = argv
  let days = 7
  let json = false
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]
    if (flag === '--json') json = true
    else if (flag === '--days') {
      days = Number(rest[index + 1])
      index += 1
    } else days = Number.NaN
  }
  if (command !== 'report' || file === undefined || file.startsWith('--') || !(days > 0)) {
    io.stderr(USAGE)
    return 2
  }
  let text: string
  try {
    text = io.readFile(file)
  } catch {
    io.stderr(`automata-server: cannot read ${file}\n`)
    return 1
  }
  const counts = summarizeLog(text.split('\n'), { nowMs: io.nowMs, days })
  io.stdout(json ? `${JSON.stringify(counts)}\n` : formatReport(counts))
  return 0
}

if (import.meta.main) {
  process.exitCode = runCli(process.argv.slice(2), {
    readFile: (path) => readFileSync(path, 'utf8'),
    nowMs: Date.now(),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  })
}
