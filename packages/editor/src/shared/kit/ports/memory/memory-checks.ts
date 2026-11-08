// The in-memory checks runner: each declared check answers through `respond`. One run per
// check id at a time: a newer run of an id ends that id in the older run as `error` ("replaced"), and `cancel` ends the
// run's unfinished checks as `error` ("cancelled"); `respond` gets an `AbortSignal` that fires then. A run never
// rejects: a check that throws is `error` with its message, and an id the list does not declare is `error` too.
import type { CheckDef, CheckResult, CheckRun, ChecksRunner } from '../suite-ports'

/** What a check answers, without its id. */
export type CheckOutcome = Omit<CheckResult, 'check'>

export interface MemoryCheck extends CheckDef {
  respond(input: {
    readonly candidates: readonly { readonly path: string; readonly text: string }[]
    readonly signal: AbortSignal
  }): Promise<CheckOutcome> | CheckOutcome
}

const errorResult = (check: string, output: string): CheckResult => ({
  check,
  status: 'error',
  findings: [],
  output,
})

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

interface Running {
  /** Ends the check now with `error` and `reason`; does nothing once it has finished. */
  stop(reason: string): void
}

export function createMemoryChecks(checks: readonly MemoryCheck[]): ChecksRunner {
  const byId = new Map(checks.map((check) => [check.id, check]))
  const declared: readonly CheckDef[] = checks.map(({ respond: _, ...def }) => def)
  const running = new Map<string, Running>()
  let runs = 0

  function start(check: MemoryCheck, candidates: readonly { path: string; text: string }[]) {
    running.get(check.id)?.stop('replaced by a newer run of this check')
    const controller = new AbortController()
    let stopped!: (result: CheckResult) => void
    const stop = new Promise<CheckResult>((resolve) => {
      stopped = resolve
    })
    const handle: Running = {
      stop(reason) {
        stopped(errorResult(check.id, reason))
        controller.abort()
      },
    }
    running.set(check.id, handle)
    const work = (async (): Promise<CheckResult> => {
      try {
        return { check: check.id, ...(await check.respond({ candidates, signal: controller.signal })) }
      } catch (error) {
        return errorResult(check.id, messageOf(error))
      }
    })()
    const result = Promise.race([stop, work]).finally(() => {
      if (running.get(check.id) === handle) running.delete(check.id)
    })
    return { handle, result }
  }

  return {
    declared: () => declared,
    async run({ checks: ids, candidates = [] }): Promise<CheckRun> {
      const started = ids.map((id) => {
        const check = byId.get(id)
        if (check === undefined)
          return {
            handle: undefined,
            result: Promise.resolve(errorResult(id, `${id} is not a declared check`)),
          }
        return start(check, candidates)
      })
      const results = Promise.all(started.map((each) => each.result))
      return {
        id: `run-${++runs}`,
        result: () => results,
        cancel() {
          for (const { handle } of started) handle?.stop('cancelled')
        },
      }
    },
  }
}
