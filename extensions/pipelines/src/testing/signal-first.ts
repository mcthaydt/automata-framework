import { Effect } from 'effect'
import { runMain } from '../app/main.ts'

// A program whose first effect is a SIGINT to its own process (main.test.ts). Effect.runFork runs a fiber synchronously
// up to its first async boundary, so this is the earliest a signal can reach a program: runMain must already be
// listening, or Node's default action kills the process and no finalizer runs (issue #14, locks.test.ts).
runMain(
  Effect.gen(function* () {
    yield* Effect.sync(() => process.kill(process.pid, 'SIGINT'))
    return yield* Effect.never
  }),
  () => undefined,
)
