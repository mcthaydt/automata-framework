import { Cause, Effect, Exit, Fiber } from 'effect'

// How both bins run their program (M3.8b review round 3). `Effect.runPromise` alone leaves a Ctrl-C, or a client
// stopping the MCP server with SIGTERM, to kill the process mid-fiber: no finalizer runs, so a target or ledger lock
// would stay behind. Here SIGINT and SIGTERM interrupt the fiber first, its finalizers (the locks' releases) run, and
// the process exits with the shell's code for the signal (128 + its number). core has no @effect/platform-node
// (ADR 0003), so this is the small handler NodeRuntime.runMain would otherwise be.

/** The signals the bins stop on, and the exit code for each (128 + the signal's number). */
export const SIGNAL_CODES: { readonly SIGINT: 130; readonly SIGTERM: 143 } = { SIGINT: 130, SIGTERM: 143 }

/** Runs `program`, hands its value to `done`, and turns SIGINT and SIGTERM into an interruption. A defect exits 1. */
export function runMain<A>(program: Effect.Effect<A>, done: (value: A) => void): void {
  // The handlers go in before the fork (issue #14): runFork runs the fiber synchronously up to its first async
  // boundary, so a program's first effects (taking a lock, say) run inside it, and a signal sent once they are
  // visible must already meet a listener. A signal is dispatched from the event loop, so `fiber` is set by then.
  let fiber: Fiber.RuntimeFiber<A> | undefined
  const handlers = Object.entries(SIGNAL_CODES).map(([signal, code]) => {
    const handler = () => {
      void (fiber ? Effect.runPromise(Fiber.interrupt(fiber)) : Promise.resolve()).then(() =>
        process.exit(code),
      )
    }
    process.once(signal, handler)
    return [signal, handler] as const
  })
  fiber = Effect.runFork(program)
  fiber.addObserver((exit) => {
    for (const [signal, handler] of handlers) process.off(signal, handler)
    if (Exit.isSuccess(exit)) done(exit.value)
    // A program that dies fails loudly, as a rejected runPromise did: the cause on stderr and exit 1. An interruption
    // by a signal is left to the handler above, which exits with the signal's code.
    else if (!Cause.isInterruptedOnly(exit.cause)) {
      process.stderr.write(`${Cause.pretty(exit.cause)}\n`)
      process.exitCode = 1
    }
  })
}
