// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createLiveCompile, EDIT_QUIET_MS, type CompileJob, type LiveResult } from '../../src/lib/playground/live'
import { diagnosticText } from '../../src/lib/playground/status'
import type { Clock } from '../../src/lib/playground/orchestrator'

// The live compile (spec F3, §5.2's last paragraph): the quiet period, `seq`, and latest-wins, with a fake clock and a
// fake worker.

class FakeClock implements Clock {
  now = 0
  private timers = new Map<number, { at: number; fn: () => void }>()
  private next = 1
  setTimeout(fn: () => void, ms: number) { const id = this.next++; this.timers.set(id, { at: this.now + ms, fn }); return id }
  clearTimeout(handle: unknown) { this.timers.delete(handle as number) }
  advance(ms: number) {
    this.now += ms
    for (const [id, timer] of [...this.timers]) if (timer.at <= this.now && this.timers.delete(id)) timer.fn()
  }
  get pending() { return this.timers.size }
}

function setup() {
  const clock = new FakeClock()
  const posted: CompileJob[] = []
  const results: LiveResult[] = []
  let terminated = false
  const live = createLiveCompile({
    clock,
    worker: { post: job => posted.push(job), terminate: () => { terminated = true } },
    onResult: result => results.push(result),
  })
  return { clock, posted, results, live, terminated: () => terminated }
}

const ok = { ok: true, code: 'export default 1' } as const

describe('createLiveCompile', () => {
  it('posts an edit only once the quiet period has passed', () => {
    const { clock, posted, live } = setup()
    live.edit('a')
    clock.advance(EDIT_QUIET_MS - 1)
    expect(posted).toEqual([])
    clock.advance(1)
    expect(posted).toEqual([{ seq: 1, source: 'a' }])
  })

  it('restarts the quiet period on each edit and posts only the latest source', () => {
    const { clock, posted, live } = setup()
    live.edit('a')
    clock.advance(200)
    live.edit('ab')
    clock.advance(200)
    expect(posted).toEqual([])
    clock.advance(100)
    expect(posted).toEqual([{ seq: 1, source: 'ab' }])
  })

  it('compiles at once with now(), cancelling a pending edit', () => {
    const { clock, posted, live } = setup()
    live.edit('a')
    live.now('b')
    expect(posted).toEqual([{ seq: 1, source: 'b' }])
    clock.advance(EDIT_QUIET_MS)
    expect(posted).toHaveLength(1)
  })

  it('passes on the answer to the latest job and drops an older one', () => {
    const { posted, results, live } = setup()
    live.now('a')
    live.now('b')
    live.receive({ seq: posted[0]!.seq, result: ok })
    expect(results).toEqual([])
    live.receive({ seq: posted[1]!.seq, result: ok })
    expect(results).toEqual([{ source: 'b', result: ok }])
    live.receive({ seq: posted[1]!.seq, result: ok })
    expect(results).toHaveLength(1)
  })

  it('drops an answer that is not a compile result', () => {
    const { results, live } = setup()
    live.now('a')
    live.receive({ seq: 1, result: { ok: 'yes' } })
    live.receive('nonsense')
    expect(results).toEqual([])
  })

  it('stops on dispose: the timer is cancelled, the worker terminated, later answers dropped', () => {
    const { clock, posted, results, live, terminated } = setup()
    live.now('a')
    live.edit('b')
    live.dispose()
    expect(terminated()).toBe(true)
    expect(clock.pending).toBe(0)
    live.receive({ seq: 1, result: ok })
    live.edit('c')
    clock.advance(EDIT_QUIET_MS)
    expect(posted).toHaveLength(1)
    expect(results).toEqual([])
  })
})

describe('diagnosticText', () => {
  const diagnostic = { line: 21, column: 18, message: 'Unexpected token' }
  it('names the line and says the last good preview is still running (§8.3)', () => {
    expect(diagnosticText(diagnostic, true)).toBe('Line 21: Unexpected token. The preview is still running your last working version.')
  })
  it('says only what is wrong when nothing is running', () => {
    expect(diagnosticText(diagnostic, false)).toBe('Line 21: Unexpected token.')
  })
  it('keeps a message’s own full stop', () => {
    expect(diagnosticText({ line: 1, column: 1, message: 'The playground can import only @mcthaydt/automata and zod.' }, false))
      .toBe('Line 1: The playground can import only @mcthaydt/automata and zod.')
  })
})
