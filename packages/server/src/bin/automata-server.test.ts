import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { formatReport, runCli, summarizeLog } from './automata-server'

// `automata-server report` (M7 spec §4.5 "Weekly report"; FloorFifty `deploy/bin/report.mjs`): restarts, fatal
// classes, sockets given up, slow ticks, refusals by limit and peak live rooms from the last 7 days of log lines.

const DAY = 86_400_000
const NOW = 1_790_000_000_000
const at = (daysAgo: number): number => NOW - daysAgo * DAY
const line = (ts: number, fields: Record<string, unknown>): string =>
  JSON.stringify({ ts, level: 'info', ...fields })

const LOG = [
  line(at(9), { event: 'fatal', code: 'OldError' }), // older than the week
  line(at(9), { event: 'server.started' }),
  'Started game@blue.service - Game server (blue).', // journald's own lines are not JSON
  line(at(6), { event: 'server.started' }),
  line(at(6), { event: 'room.created', room: '1' }),
  line(at(6), { event: 'room.created', room: '2' }),
  line(at(6), { event: 'room.created', room: '3' }),
  line(at(6), { event: 'room.disposed', room: '1' }),
  line(at(5), { event: 'tick.slow', room: '2', ms: 40 }),
  line(at(5), { event: 'tick.slow', room: '3', ms: 25 }),
  line(at(5), { event: 'step.slow', room: '3', ms: 12 }),
  line(at(5), { event: 'refused', code: 'busy' }),
  line(at(5), { event: 'refused', code: 'session' }),
  line(at(5), { event: 'refused', code: 'busy' }),
  line(at(5), { event: 'seat.left', room: '2', seat: 0, code: 'grace' }),
  line(at(5), { event: 'seat.left', room: '2', seat: 1 }),
  line(at(4), { event: 'fatal', code: 'TypeError' }),
  line(at(4), { event: 'server.started' }),
  line(at(4), { event: 'room.created', room: '1' }),
  line(at(3), { event: 'fatal', code: 'TypeError' }),
  line(at(3), { event: 'start.refused', code: 'content' }),
  '{"ts": "not a number", "event": "fatal"}',
  '{ not json',
  'null',
]

describe('summarizeLog', () => {
  const counts = summarizeLog(LOG, { nowMs: NOW, days: 7 })

  it('counts restarts as the starts in the window', () => {
    expect(counts.restarts).toBe(2)
  })

  it('counts fatal lines by class, and a refused start by its cause', () => {
    expect(counts.fatalByClass).toEqual({ TypeError: 2, 'start.content': 1 })
  })

  it('counts seats given up after a drop as sockets given up, never a seat left on purpose', () => {
    expect(counts.socketsGivenUp).toBe(1)
  })

  it('counts slow ticks and slow steps', () => {
    expect(counts.slowTicks).toBe(2)
    expect(counts.slowSteps).toBe(1)
  })

  it('counts refusals by limit', () => {
    expect(counts.refusedByLimit).toEqual({ busy: 2, session: 1 })
  })

  it('finds the peak of live rooms, counted from each start', () => {
    expect(counts.peakRooms).toBe(3)
  })

  it('reads a longer window when asked', () => {
    expect(summarizeLog(LOG, { nowMs: NOW, days: 10 }).fatalByClass).toEqual({
      OldError: 1,
      TypeError: 2,
      'start.content': 1,
    })
  })
})

describe('formatReport', () => {
  it('prints one row per item, tables sorted by name, and none for an empty table', () => {
    expect(formatReport(summarizeLog(LOG, { nowMs: NOW, days: 7 }))).toBe(
      [
        'restarts             2',
        'fatal by class       TypeError 2, start.content 1',
        'sockets given up     1',
        'slow ticks           2',
        'slow steps           1',
        'refused by limit     busy 2, session 1',
        'peak live rooms      3',
        '',
      ].join('\n'),
    )
    expect(formatReport(summarizeLog([], { nowMs: NOW, days: 7 }))).toContain('fatal by class       none')
  })
})

describe('runCli', () => {
  const io = (files: Record<string, string>) => {
    const out: string[] = []
    const err: string[] = []
    return {
      out,
      err,
      io: {
        readFile: (path: string) => {
          const text = files[path]
          if (text === undefined) throw new Error(`ENOENT: ${path}`)
          return text
        },
        nowMs: NOW,
        stdout: (text: string) => out.push(text),
        stderr: (text: string) => err.push(text),
      },
    }
  }

  it('prints the summary of a log file', () => {
    const { out, io: cli } = io({ 'game.log': LOG.join('\n') })
    expect(runCli(['report', 'game.log'], cli)).toBe(0)
    expect(out.join('')).toContain('restarts             2')
  })

  it('prints the counts as JSON with --json, over --days', () => {
    const { out, io: cli } = io({ 'game.log': LOG.join('\n') })
    expect(runCli(['report', 'game.log', '--json', '--days', '10'], cli)).toBe(0)
    expect(JSON.parse(out.join('')).fatalByClass).toEqual({ OldError: 1, TypeError: 2, 'start.content': 1 })
  })

  it('exits 1 for a file it cannot read, and 2 for a command it does not know', () => {
    const missing = io({})
    expect(runCli(['report', 'gone.log'], missing.io)).toBe(1)
    expect(missing.err.join('')).toMatch(/cannot read gone\.log/)
    const unknown = io({})
    expect(runCli(['deploy'], unknown.io)).toBe(2)
    expect(runCli(['report'], unknown.io)).toBe(2)
    expect(runCli(['report', 'a.log', '--days', 'x'], unknown.io)).toBe(2)
    expect(unknown.err.join('')).toMatch(/usage: automata-server report <log-file>/)
  })
})

describe('the bin', () => {
  it('runs from source under Node and prints the report of a file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'automata-server-report-'))
    const file = join(dir, 'game.log')
    const recent = Date.now() - DAY
    writeFileSync(
      file,
      [
        JSON.stringify({ ts: recent, level: 'info', event: 'server.started' }),
        JSON.stringify({ ts: recent, level: 'warn', event: 'tick.slow', room: '1', ms: 30 }),
      ].join('\n'),
    )
    const bin = fileURLToPath(new URL('./automata-server.ts', import.meta.url))
    const { stdout } = await promisify(execFile)(process.execPath, [bin, 'report', file])
    expect(stdout).toContain('restarts             1')
    expect(stdout).toContain('slow ticks           1')
  })
})
