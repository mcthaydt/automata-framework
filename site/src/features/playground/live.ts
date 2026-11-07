import { z } from 'zod'
import type { CompileResult } from './compile'
import type { Clock } from './orchestrator'

// Live updates (spec F3, §5.2's last paragraph): every edit restarts the quiet period; when it ends the source goes to
// the compile worker with the next `seq`, and only the answer to the latest `seq` is passed on, so a slow compile of an
// older text never replaces a newer one. The clock and the worker are injected, so all of it runs in a unit test.

/** The compile waits this long after the last change (PLAY-D6). */
export const EDIT_QUIET_MS = 300

export interface CompileJob {
  readonly seq: number
  readonly source: string
}

/** The compile worker, as the page started it (`compile.worker.ts`). */
export interface CompileWorker {
  post(job: CompileJob): void
  terminate(): void
}

export interface LiveResult {
  readonly source: string
  readonly result: CompileResult
}

export interface LiveCompileOptions {
  clock: Clock
  worker: CompileWorker
  onResult(result: LiveResult): void
}

const diagnostic = z.strictObject({ line: z.int().min(1), column: z.int().min(1), message: z.string() })
const answer = z.strictObject({
  seq: z.int().min(1),
  result: z.union([
    z.strictObject({ ok: z.literal(true), code: z.string() }),
    z.strictObject({ ok: z.literal(false), diagnostics: z.array(diagnostic).min(1) }),
  ]),
})

export function createLiveCompile({ clock, worker, onResult }: LiveCompileOptions) {
  let seq = 0
  let latest: CompileJob | undefined
  let timer: unknown
  let disposed = false

  const cancel = () => {
    if (timer !== undefined) clock.clearTimeout(timer)
    timer = undefined
  }

  const now = (source: string) => {
    if (disposed) return
    cancel()
    latest = { seq: ++seq, source }
    worker.post(latest)
  }

  return {
    /** A change in the editor: compiles once the reader has paused for `EDIT_QUIET_MS`. */
    edit(source: string) {
      if (disposed) return
      cancel()
      timer = clock.setTimeout(() => {
        timer = undefined
        now(source)
      }, EDIT_QUIET_MS)
    },
    /** Compiles at once, without the quiet period. */
    now,
    /** The worker's answer, `{ seq, result }`. */
    receive(data: unknown) {
      const parsed = answer.safeParse(data)
      if (disposed || !parsed.success || !latest || parsed.data.seq !== latest.seq) return
      const { source } = latest
      latest = undefined
      onResult({ source, result: parsed.data.result })
    },
    dispose() {
      disposed = true
      cancel()
      worker.terminate()
    },
  }
}

export type LiveCompile = ReturnType<typeof createLiveCompile>
