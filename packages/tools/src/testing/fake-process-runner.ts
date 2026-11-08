// A stand-in for the `ProcessRunner` service, so a test can run a ship or check step without starting `git`, `cargo`
// or `butler`: it records every call and answers from a function the test writes.
import { Effect, Layer } from 'effect'
import { ProcessRunner, type RunOptions, type RunResult } from '../shared/node/process-runner.ts'

export interface RecordedRun {
  readonly command: string
  readonly args: readonly string[]
  readonly options: RunOptions
}

/** A ProcessRunner that records each call and answers with `reply` instead of starting a program. */
export function fakeProcessRunner(reply: (run: RecordedRun) => RunResult): {
  readonly layer: Layer.Layer<ProcessRunner>
  readonly runs: readonly RecordedRun[]
} {
  const runs: RecordedRun[] = []
  const layer = Layer.succeed(ProcessRunner, {
    run: (command, args, options = {}) =>
      Effect.sync(() => {
        const recorded = { command, args, options }
        runs.push(recorded)
        return reply(recorded)
      }),
  })
  return { layer, runs }
}
