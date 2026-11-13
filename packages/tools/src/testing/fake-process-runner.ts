// A stand-in for the `ProcessRunner` service, so a test can run a ship or check step without starting `git`, `cargo`
// or `butler`: it records every call and answers from a function the test writes.
import { Effect, Layer } from 'effect'
import { ProcessError } from '../shared/node/errors.ts'
import { ProcessRunner, type RunOptions, type RunResult } from '../shared/node/process-runner.ts'

export interface RecordedRun {
  readonly command: string
  readonly args: readonly string[]
  readonly options: RunOptions
}

/** The answer for a program that is not installed: the real runner fails to start it, as `spawn` does (ENOENT). */
export const NOT_INSTALLED = 'not-installed'

/**
 * A ProcessRunner that records each call and answers with `reply` instead of starting a program. A reply of
 * `NOT_INSTALLED` fails the run with a `ProcessError`, as the real runner does for a program that is not on the path.
 */
export function fakeProcessRunner(reply: (run: RecordedRun) => RunResult | typeof NOT_INSTALLED): {
  readonly layer: Layer.Layer<ProcessRunner>
  readonly runs: readonly RecordedRun[]
} {
  const runs: RecordedRun[] = []
  const layer = Layer.succeed(ProcessRunner, {
    run: (command, args, options = {}) =>
      Effect.suspend(() => {
        const recorded = { command, args, options }
        runs.push(recorded)
        const answer = reply(recorded)
        if (answer !== NOT_INSTALLED) return Effect.succeed(answer)
        const cause = Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' })
        return Effect.fail(new ProcessError({ command, cause }))
      }),
  })
  return { layer, runs }
}
