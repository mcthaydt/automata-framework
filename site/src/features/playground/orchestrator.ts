import type { DeterminismView } from './determinism'
import { type FrameMessage, frameMessage, PROTOCOL_VERSION, type RunMessage } from './protocol'
import { STATUS } from './status'

// The preview's frames. Each run gets a candidate frame under the current one; the
// candidate is revealed only when it reports `running`, so a run that fails or never starts leaves the last good
// preview where it was. The clock and the frame factory are injected, so all of it runs in a unit test.

/** The first frame of a page visit downloads the runtime (DemoRunner waits as long). */
export const FIRST_BOOT_TIMEOUT_MS = 20_000
/** Later frames, from creation to `running`. */
export const BOOT_TIMEOUT_MS = 10_000

/** One preview frame, as the page made it. `window` is its `contentWindow`, the only source its messages may have. */
export interface PreviewFrame {
  readonly window: unknown
  post(message: RunMessage): void
  /** Puts the frame on top, interactive and named. */
  reveal(): void
  remove(): void
}

export interface Clock {
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export type PreviewState = 'poster' | 'starting' | 'running' | 'failed'

export interface OrchestratorView {
  readonly preview: PreviewState
  /** The run id of the frame on show; 0 before the first run reaches `running`. */
  readonly runId: number
  readonly status: string
  /** Shown over a preview whose run threw or hung after it started. */
  readonly stopped: string | null
  readonly frames: number
  /** Where the last frame failure that named a line was, for the editor to mark; cleared by the next `running`. */
  readonly failure?: { readonly line: number; readonly column: number; readonly message: string }
  /** The determinism row for the frame on show; absent: no row. */
  readonly determinism?: DeterminismView
}

export interface OrchestratorOptions {
  createFrame(): PreviewFrame
  clock: Clock
  title: string
  onChange(view: OrchestratorView): void
}

interface Held {
  readonly frame: PreviewFrame
  readonly runId: number
  readonly code: string
  readonly determinism: RunMessage['determinism']
  /** The commit the frame booted. */
  framework?: string
  sent: boolean
  timer: unknown
}

/** The loop guard's stop, in plain words; the frame's own message says "over 1 s". */
const HANG_MESSAGE = 'this loop ran for over a second without a break, so the preview stopped it'

/** A failure's text, with its line when the frame found one in the reader's source. */
function failureText(message: string, line: number | undefined): string {
  const text = /[.!?]$/.test(message) ? message : message + '.'
  return line === undefined ? text : `Line ${line}: ${text}`
}

export function createOrchestrator(options: OrchestratorOptions) {
  const { clock, onChange } = options
  let current: Held | undefined
  let candidate: Held | undefined
  let nextRunId = 1
  let everRan = false
  let disposed = false
  let lastCode: string | undefined
  let lastDeterminism: RunMessage['determinism']
  let view: OrchestratorView = { preview: 'poster', runId: 0, status: '', stopped: null, frames: 0 }

  const update = (change: Partial<OrchestratorView>) => {
    view = { ...view, ...change, frames: (current ? 1 : 0) + (candidate ? 1 : 0) }
    onChange(view)
  }

  const drop = (held: Held | undefined) => {
    if (!held) return
    clock.clearTimeout(held.timer)
    held.frame.remove()
  }

  const dropCandidate = () => {
    drop(candidate)
    candidate = undefined
  }

  /** The candidate failed or never started: the running preview, if any, stays. */
  const candidateFailed = (status: string) => {
    dropCandidate()
    if (current) update({ status: `${status} ${STATUS.kept}` })
    else update({ preview: 'failed', status })
  }

  const run = (code: string, determinism?: RunMessage['determinism']) => {
    if (disposed) return
    dropCandidate()
    lastCode = code
    lastDeterminism = determinism
    const first = !everRan
    const held: Held = {
      frame: options.createFrame(),
      runId: nextRunId++,
      code,
      determinism,
      sent: false,
      timer: undefined,
    }
    held.timer = clock.setTimeout(
      () => {
        if (candidate !== held) return
        if (current) {
          dropCandidate()
          update({ status: STATUS.bootTimeout })
        } else candidateFailed(first ? STATUS.offline : STATUS.bootTimeout)
      },
      first ? FIRST_BOOT_TIMEOUT_MS : BOOT_TIMEOUT_MS,
    )
    candidate = held
    if (current) update({})
    else update({ preview: 'starting', status: STATUS.starting })
  }

  const handle = (held: Held, message: FrameMessage) => {
    if (message.type === 'booted') {
      if (held !== candidate || held.sent) return
      held.sent = true
      held.framework = message.framework
      held.frame.post({
        v: PROTOCOL_VERSION,
        type: 'run',
        runId: held.runId,
        code: held.code,
        ...(held.determinism && { determinism: held.determinism }),
      })
      return
    }
    if (message.runId !== held.runId) return
    if (message.type === 'running') {
      if (held !== candidate) return
      clock.clearTimeout(held.timer)
      const replaced = current !== undefined
      held.frame.reveal()
      drop(current)
      current = held
      candidate = undefined
      everRan = true
      const determinism = held.determinism && { kind: 'checking' as const, ticks: held.determinism.ticks }
      update({
        preview: 'running',
        runId: held.runId,
        stopped: null,
        failure: undefined,
        determinism,
        status: replaced ? STATUS.updated : STATUS.running,
      })
      return
    }
    if (message.type === 'failed') {
      const reason = message.hung ? HANG_MESSAGE : message.message
      const text = failureText(reason, message.line)
      if (message.line !== undefined)
        view = { ...view, failure: { line: message.line, column: message.column ?? 1, message: reason } }
      if (held === candidate) {
        candidateFailed(text)
        return
      }
      const stopped = `Stopped: ${text.replace(/^Line/, 'line')}`
      update({ preview: 'failed', stopped, status: stopped })
      return
    }
    // Only the frame on show, and only a run that asked: no row claims a check nobody requested.
    if (held !== current || held.determinism === undefined) return
    if (message.type === 'determinism-unavailable') update({ determinism: undefined })
    if (message.type !== 'determinism') return
    const { ticks, hash } = message
    if (message.golden === 'pass')
      update({ determinism: { kind: 'pass', ticks, hash, framework: held.framework! } })
    else if (message.golden === 'diverged')
      update({ determinism: { kind: 'diverged', tick: message.tick ?? ticks } })
    else update({ determinism: { kind: 'edited', ticks, hash } })
  }

  return {
    run,
    restart() {
      if (lastCode !== undefined) run(lastCode, lastDeterminism)
    },
    receive(event: { source: unknown; origin: string; data: unknown }) {
      if (disposed || event.origin !== 'null' || event.source === null) return
      const held = [current, candidate].find(
        (each) => each !== undefined && each.frame.window === event.source,
      )
      if (!held) return
      const parsed = frameMessage.safeParse(event.data)
      if (parsed.success) handle(held, parsed.data)
    },
    dispose() {
      disposed = true
      dropCandidate()
      drop(current)
      current = undefined
      update({})
    },
  }
}

export type Orchestrator = ReturnType<typeof createOrchestrator>
