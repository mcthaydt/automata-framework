import { ProcessError, ProcessRunner, type RunResult } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'

/** One program start the fake saw. */
export interface RunCall {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string | undefined
}

/** What the fake answers a call with: a finished program, or `'not-found'` (the program cannot be started). */
export type FakeAnswer = Partial<RunResult> | 'not-found'

export interface FakeProcessRunner {
  readonly layer: Layer.Layer<ProcessRunner>
  /** Every call, in order. */
  readonly calls: RunCall[]
  /** The calls as `command arg arg…` lines, for compact assertions. */
  readonly lines: () => string[]
}

/**
 * A `ProcessRunner` that starts nothing: `answer` decides each result (exit code 0 and empty output by default).
 * The unit tests answer git and lsof with it; the integration test runs the real programs.
 */
export function fakeProcessRunner(answer: (call: RunCall) => FakeAnswer): FakeProcessRunner {
  const calls: RunCall[] = []
  const layer = Layer.succeed(ProcessRunner, {
    run: (command, args, options) =>
      Effect.suspend(() => {
        const call = { command, args: [...args], cwd: options?.cwd }
        calls.push(call)
        const result = answer(call)
        if (result === 'not-found')
          return Effect.fail(new ProcessError({ command, cause: new Error(`spawn ${command} ENOENT`) }))
        return Effect.succeed({ exitCode: 0, stdout: '', stderr: '', ...result })
      }),
  })
  return { layer, calls, lines: () => calls.map((call) => [call.command, ...call.args].join(' ')) }
}
