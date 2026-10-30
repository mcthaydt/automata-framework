import { Effect, Exit, Fiber } from 'effect'

// How both bins run their program (M3.8b review round 3). `Effect.runPromise` alone leaves a Ctrl-C, or a client
// stopping the MCP server with SIGTERM, to kill the process mid-fiber: no finalizer runs, so a target or ledger lock
// would stay behind. Here SIGINT and SIGTERM interrupt the fiber first, its finalizers (the locks' releases) run, and
// the process exits with the shell's code for the signal (128 + its number). core has no @effect/platform-node
// (ADR 0003), so this is the small handler NodeRuntime.runMain would otherwise be.

/** The signals the bins stop on, and the exit code for each (128 + the signal's number). */
export const SIGNAL_CODES: { readonly SIGINT: 130; readonly SIGTERM: 143 } = { SIGINT: 130, SIGTERM: 143 }

/** Runs `program`, hands its value to `done`, and turns SIGINT and SIGTERM into an interruption. */
export function runMain<A>(program: Effect.Effect<A>, done: (value: A) => void): void {
  const fiber = Effect.runFork(program)
  const handlers = Object.entries(SIGNAL_CODES).map(([signal, code]) => {
    const handler = () => {
      void Effect.runPromise(Fiber.interrupt(fiber)).then(() => process.exit(code))
    }
    process.once(signal, handler)
    return [signal, handler] as const
  })
  fiber.addObserver((exit) => {
    for (const [signal, handler] of handlers) process.off(signal, handler)
    if (Exit.isSuccess(exit)) done(exit.value)
  })
}
