import { describe, expect, it } from 'vitest'
import {
  exampleModulePath,
  frameMessage,
  MAX_CODE_CHARS,
  MAX_FAILURE_CHARS,
  runMessage,
} from '#src/playground/playground-protocol.ts'

const COMMIT = 'a'.repeat(40)

describe('the playground protocol', () => {
  it('parses each frame message', () => {
    const messages = [
      { v: 1, type: 'booted', framework: COMMIT },
      { v: 1, type: 'running', runId: 1 },
      { v: 1, type: 'failed', runId: 2, phase: 'run', message: 'x', line: 21, column: 5 },
      { v: 1, type: 'failed', runId: 2, phase: 'run', message: 'loop', line: 9, hung: true },
      { v: 1, type: 'determinism', runId: 3, ticks: 120, hash: '0123456789abcdef', golden: 'pass' },
      {
        v: 1,
        type: 'determinism',
        runId: 3,
        ticks: 120,
        hash: '0123456789abcdef',
        golden: 'diverged',
        tick: 61,
      },
      { v: 1, type: 'determinism-unavailable', runId: 3, message: 'the golden could not be read (404)' },
    ]
    for (const message of messages) expect(frameMessage.parse(message)).toEqual(message)
  })

  it('parses a run, with and without a determinism request', () => {
    const run = { v: 1, type: 'run', runId: 1, code: 'export default 1' }
    expect(runMessage.parse(run)).toEqual(run)
    const checked = { ...run, determinism: { ticks: 120, replay: '/playground/goldens/shapes-rects.replay' } }
    expect(runMessage.parse(checked)).toEqual(checked)
  })

  it('rejects anything else', () => {
    const bad: unknown[] = [
      { type: 'running', runId: 1 },
      { v: 2, type: 'running', runId: 1 },
      { v: 1, type: 'started', runId: 1 },
      { v: 1, type: 'running', runId: 0 },
      { v: 1, type: 'running', runId: 1.5 },
      { v: 1, type: 'booted', framework: 'main' },
      { v: 1, type: 'determinism', runId: 1, ticks: 120, hash: 'xyz', golden: 'pass' },
      { v: 1, type: 'failed', runId: 1, phase: 'later', message: 'x' },
      { v: 1, type: 'failed', runId: 1, phase: 'run', message: 'x'.repeat(MAX_FAILURE_CHARS + 1) },
      { v: 1, type: 'running', runId: 1, extra: '<img>' },
      'running',
      null,
    ]
    for (const message of bad)
      expect(frameMessage.safeParse(message).success, JSON.stringify(message)).toBe(false)
    expect(
      runMessage.safeParse({ v: 1, type: 'run', runId: 1, code: 'x'.repeat(MAX_CODE_CHARS + 1) }).success,
    ).toBe(false)
    expect(
      runMessage.safeParse({
        v: 1,
        type: 'run',
        runId: 1,
        code: '',
        determinism: { ticks: 120, replay: 'https://x/a' },
      }).success,
    ).toBe(false)
  })

  it('names the example module the way its import.meta.url must resolve resources', () => {
    expect(exampleModulePath('shapes', 'rects')).toBe('/playground/examples/shapes/shapes-rects.ts')
  })
})
