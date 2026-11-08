// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  BOOT_TIMEOUT_MS,
  type Clock,
  createOrchestrator,
  FIRST_BOOT_TIMEOUT_MS,
  type OrchestratorView,
  type PreviewFrame,
} from '../../src/lib/playground/orchestrator'
import type { RunMessage } from '../../src/lib/playground/protocol'

// The orchestrator (spec §8.1) with a fake clock and fake frames: what it creates, posts, reveals and removes, and
// which messages it believes (§5.1).

const FRAMEWORK = 'f8023a907725cccd84277372c0d4f1b73d2da90c'

class FakeClock implements Clock {
  now = 0
  private timers = new Map<number, { at: number; fn: () => void }>()
  private next = 1
  setTimeout(fn: () => void, ms: number) {
    const id = this.next++
    this.timers.set(id, { at: this.now + ms, fn })
    return id
  }
  clearTimeout(handle: unknown) {
    this.timers.delete(handle as number)
  }
  advance(ms: number) {
    this.now += ms
    for (const [id, timer] of [...this.timers]) if (timer.at <= this.now && this.timers.delete(id)) timer.fn()
  }
  get pending() {
    return this.timers.size
  }
}

interface FakeFrame extends PreviewFrame {
  readonly window: object
  posted: RunMessage[]
  revealed: boolean
  removed: boolean
}

function setup() {
  const clock = new FakeClock()
  const frames: FakeFrame[] = []
  const views: OrchestratorView[] = []
  const orchestrator = createOrchestrator({
    clock,
    title: 'rectangles',
    createFrame: () => {
      const frame: FakeFrame = {
        window: {},
        posted: [],
        revealed: false,
        removed: false,
        post(message) {
          this.posted.push(message)
        },
        reveal() {
          this.revealed = true
        },
        remove() {
          this.removed = true
        },
      }
      frames.push(frame)
      return frame
    },
    onChange: (view) => views.push(view),
  })
  const live = () => frames.filter((frame) => !frame.removed)
  const view = () => views.at(-1)!
  const say = (frame: FakeFrame, data: unknown, origin = 'null') =>
    orchestrator.receive({ source: frame.window, origin, data })
  const booted = (frame: FakeFrame) => say(frame, { v: 1, type: 'booted', framework: FRAMEWORK })
  const running = (frame: FakeFrame, runId = frame.posted[0]!.runId) =>
    say(frame, { v: 1, type: 'running', runId })
  /** Runs `code` to `running` in a fresh frame. */
  const start = (code = 'export default 1') => {
    orchestrator.run(code)
    const frame = frames.at(-1)!
    booted(frame)
    running(frame)
    return frame
  }
  return { clock, frames, live, view, orchestrator, say, booted, running, start }
}

describe('the orchestrator', () => {
  it('drops a message whose origin is not null', () => {
    const { frames, orchestrator, say } = setup()
    orchestrator.run('code')
    say(frames[0]!, { v: 1, type: 'booted', framework: FRAMEWORK }, 'https://automata.ruken.com')
    expect(frames[0]!.posted).toEqual([])
  })

  it('drops a message from a window it did not create, one that does not parse, and one for another run', () => {
    const { frames, orchestrator, say, booted, view } = setup()
    orchestrator.run('code')
    const frame = frames[0]!
    orchestrator.receive({ source: {}, origin: 'null', data: { v: 1, type: 'booted', framework: FRAMEWORK } })
    say(frame, { v: 1, type: 'booted' })
    say(frame, '<b>booted</b>')
    expect(frame.posted).toEqual([])
    booted(frame)
    say(frame, { v: 1, type: 'running', runId: 99 })
    expect(frame.revealed).toBe(false)
    expect(view().preview).toBe('starting')
  })

  it('posts run once, after booted, with the next run id and the code', () => {
    const { frames, orchestrator, booted } = setup()
    orchestrator.run('export default game')
    const frame = frames[0]!
    expect(frame.posted).toEqual([])
    booted(frame)
    booted(frame)
    expect(frame.posted).toEqual([{ v: 1, type: 'run', runId: 1, code: 'export default game' }])
  })

  it('reveals the candidate only on running, then removes the old frame', () => {
    const { frames, orchestrator, booted, running, start, view, live } = setup()
    const first = start()
    expect(first.revealed).toBe(true)
    expect(view()).toMatchObject({
      preview: 'running',
      runId: 1,
      status: 'Running. Edit the code and the preview updates as you type.',
    })
    orchestrator.run('second')
    const second = frames[1]!
    booted(second)
    expect(second.revealed).toBe(false)
    expect(live()).toHaveLength(2)
    running(second)
    expect(second.revealed).toBe(true)
    expect(first.removed).toBe(true)
    expect(live()).toEqual([second])
    expect(view()).toMatchObject({ preview: 'running', runId: 2, status: 'Preview updated.' })
  })

  it('never holds more than two frames: a new run removes a candidate that is still booting', () => {
    const { frames, orchestrator, start, live } = setup()
    start()
    for (let index = 0; index < 5; index += 1) {
      orchestrator.run('edit ' + index)
      expect(live().length).toBeLessThanOrEqual(2)
    }
    expect(frames.filter((frame) => frame.removed)).toHaveLength(4)
  })

  it('says it is starting until the first run reaches running', () => {
    const { orchestrator, view } = setup()
    orchestrator.run('code')
    expect(view()).toMatchObject({ preview: 'starting', status: 'Starting the preview…', runId: 0 })
  })

  it('keeps the running preview when a candidate fails to import or boot, and names the line', () => {
    const { frames, orchestrator, booted, say, start, view, live } = setup()
    const first = start()
    orchestrator.run('broken')
    const candidate = frames[1]!
    booted(candidate)
    say(candidate, { v: 1, type: 'failed', runId: 2, phase: 'boot', message: 'x', line: 12, column: 3 })
    expect(candidate.removed).toBe(true)
    expect(live()).toEqual([first])
    expect(view()).toMatchObject({
      preview: 'running',
      runId: 1,
      status: 'Line 12: x. The preview is still running your last working version.',
    })
  })

  it('fails with Play back when the first run fails and nothing else is running', () => {
    const { frames, orchestrator, booted, say, view, live } = setup()
    orchestrator.run('broken')
    booted(frames[0]!)
    say(frames[0]!, {
      v: 1,
      type: 'failed',
      runId: 1,
      phase: 'import',
      message: 'The example’s default export must be defineGame(...)',
    })
    expect(live()).toEqual([])
    expect(view()).toMatchObject({
      preview: 'failed',
      status: 'The example’s default export must be defineGame(...).',
    })
  })

  it('keeps a frame that stops while running, with the stopped message over it', () => {
    const { orchestrator, say, start, view, live } = setup()
    const first = start()
    say(first, { v: 1, type: 'failed', runId: 1, phase: 'run', message: 'x', line: 30 })
    expect(live()).toEqual([first])
    expect(view()).toMatchObject({
      preview: 'failed',
      stopped: 'Stopped: line 30: x.',
      status: 'Stopped: line 30: x.',
    })
    orchestrator.restart()
    expect(view().stopped).toBe('Stopped: line 30: x.')
  })

  it('names a hang in the spec’s words, by phase (§7.2, §7.3)', () => {
    const { orchestrator, frames, booted, say, start, view } = setup()
    const first = start()
    orchestrator.run('hangs at boot')
    booted(frames[1]!)
    say(frames[1]!, {
      v: 1,
      type: 'failed',
      runId: 2,
      phase: 'boot',
      message: 'this loop ran for over 1 s without a break, so the preview stopped it',
      line: 9,
      hung: true,
    })
    expect(view().status).toBe(
      'Line 9: this loop ran for over a second without a break, so the preview stopped it. The preview is still running your last working version.',
    )
    say(first, { v: 1, type: 'failed', runId: 1, phase: 'run', message: 'anything', line: 18, hung: true })
    expect(view().stopped).toBe(
      'Stopped: line 18: this loop ran for over a second without a break, so the preview stopped it.',
    )
  })

  it('carries the line of the last failure that had one, for the editor, until the next run reaches running', () => {
    const { orchestrator, frames, booted, say, running, start, view } = setup()
    const first = start()
    expect(view().failure).toBeUndefined()
    orchestrator.run('throws in setup')
    booted(frames[1]!)
    say(frames[1]!, { v: 1, type: 'failed', runId: 2, phase: 'boot', message: 'x', line: 12, column: 3 })
    expect(view().failure).toEqual({ line: 12, column: 3, message: 'x' })
    say(first, { v: 1, type: 'failed', runId: 1, phase: 'run', message: 'y', line: 30 })
    expect(view().failure).toEqual({ line: 30, column: 1, message: 'y' })
    orchestrator.run('fixed')
    booted(frames[2]!)
    running(frames[2]!)
    expect(view().failure).toBeUndefined()
  })

  it('carries no line for a failure without one', () => {
    const { frames, orchestrator, booted, say, view } = setup()
    orchestrator.run('broken')
    booted(frames[0]!)
    say(frames[0]!, { v: 1, type: 'failed', runId: 1, phase: 'import', message: 'no line' })
    expect(view().failure).toBeUndefined()
  })

  it('times the first frame out at 20 seconds and later ones at 10, removing only the candidate', () => {
    const { clock, frames, orchestrator, booted, view, live, start } = setup()
    orchestrator.run('slow')
    clock.advance(FIRST_BOOT_TIMEOUT_MS - 1)
    expect(frames[0]!.removed).toBe(false)
    clock.advance(1)
    expect(frames[0]!.removed).toBe(true)
    expect(view()).toMatchObject({
      preview: 'failed',
      status: 'The preview couldn’t load. Check the connection and press Retry.',
    })
    const running = start()
    orchestrator.run('slow again')
    booted(frames.at(-1)!)
    clock.advance(BOOT_TIMEOUT_MS)
    expect(frames.at(-1)!.removed).toBe(true)
    expect(live()).toEqual([running])
    expect(view()).toMatchObject({
      preview: 'running',
      status: 'The preview did not start within 10 seconds.',
    })
  })

  it('clears the timeout once the frame is running', () => {
    const { clock, start } = setup()
    start()
    expect(clock.pending).toBe(0)
  })

  it('restarts the last code in a fresh frame from tick 0', () => {
    const { frames, orchestrator, booted, start } = setup()
    start('the code')
    orchestrator.restart()
    booted(frames[1]!)
    expect(frames[1]!.posted).toEqual([{ v: 1, type: 'run', runId: 2, code: 'the code' }])
  })

  it('removes every frame and timer on dispose, and ignores what comes after', () => {
    const { clock, frames, orchestrator, booted, start, live } = setup()
    start()
    orchestrator.run('next')
    orchestrator.dispose()
    expect(live()).toEqual([])
    expect(clock.pending).toBe(0)
    booted(frames[1]!)
    expect(frames[1]!.posted).toEqual([])
  })

  it('ignores a determinism report for a run that asked for none', () => {
    const { say, start, view } = setup()
    const frame = start()
    const before = view()
    say(frame, { v: 1, type: 'determinism', runId: 1, ticks: 120, hash: '0123456789abcdef', golden: 'pass' })
    expect(view()).toEqual(before)
  })
})

// WEB.PLAY.10 (spec §13, F6): the determinism request goes out with the run, and the row shows only the frame on show.
describe('the determinism row', () => {
  const ORIGINAL = { ticks: 120, replay: '/playground/goldens/shapes-rects.replay' }
  const HASH = '0123456789abcdef'

  /** Runs `code` with `request` to `running` in a fresh frame. */
  function started(request?: { ticks: number; replay?: string }) {
    const harness = setup()
    harness.orchestrator.run('code', request)
    const frame = harness.frames.at(-1)!
    harness.booted(frame)
    harness.running(frame)
    return { ...harness, frame }
  }

  it('sends the request with the run, and none without one', () => {
    expect(started(ORIGINAL).frame.posted).toEqual([
      { v: 1, type: 'run', runId: 1, code: 'code', determinism: ORIGINAL },
    ])
    expect(started().frame.posted).toEqual([{ v: 1, type: 'run', runId: 1, code: 'code' }])
  })

  it('shows no row without a request, and checking once a requested run is running', () => {
    expect(started().view().determinism).toBeUndefined()
    expect(started(ORIGINAL).view().determinism).toEqual({ kind: 'checking', ticks: 120 })
  })

  it('shows a pass with the framework the frame booted, an edit with its hash, and a divergence with its tick', () => {
    const pass = started(ORIGINAL)
    pass.say(pass.frame, { v: 1, type: 'determinism', runId: 1, ticks: 120, hash: HASH, golden: 'pass' })
    expect(pass.view().determinism).toEqual({ kind: 'pass', ticks: 120, hash: HASH, framework: FRAMEWORK })
    const edited = started({ ticks: 120 })
    edited.say(edited.frame, { v: 1, type: 'determinism', runId: 1, ticks: 120, hash: HASH, golden: 'none' })
    expect(edited.view().determinism).toEqual({ kind: 'edited', ticks: 120, hash: HASH })
    const diverged = started(ORIGINAL)
    diverged.say(diverged.frame, {
      v: 1,
      type: 'determinism',
      runId: 1,
      ticks: 120,
      hash: HASH,
      golden: 'diverged',
      tick: 37,
    })
    expect(diverged.view().determinism).toEqual({ kind: 'diverged', tick: 37 })
  })

  it('removes the row when the check could not run', () => {
    const { say, frame, view } = started(ORIGINAL)
    say(frame, {
      v: 1,
      type: 'determinism-unavailable',
      runId: 1,
      message: 'the golden could not be read (404)',
    })
    expect(view().determinism).toBeUndefined()
    expect(view().preview).toBe('running')
  })

  it('ignores a result from a frame that is not on show', () => {
    const { orchestrator, frames, booted, say, view } = started(ORIGINAL)
    orchestrator.run('edit', { ticks: 120 })
    const candidate = frames[1]!
    booted(candidate)
    say(candidate, { v: 1, type: 'determinism', runId: 2, ticks: 120, hash: HASH, golden: 'none' })
    expect(view().determinism).toEqual({ kind: 'checking', ticks: 120 })
  })

  it('restarts with the same request', () => {
    const { orchestrator, frames, booted } = started(ORIGINAL)
    orchestrator.restart()
    booted(frames[1]!)
    expect(frames[1]!.posted).toEqual([{ v: 1, type: 'run', runId: 2, code: 'code', determinism: ORIGINAL }])
  })
})
