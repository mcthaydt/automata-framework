import { type Files, ProcessRunner } from '@mcthaydt/automata-node'
import { Effect } from 'effect'
import { findBin, TOOLS } from '../check/check-steps.ts'
import { CheckToolError } from '../check/csp-probe.ts'

// `automata build` (FR.3): the game's own `vite build`, found as `automata check` finds its tools. `--debug` sets `AUTOMATA_DEBUG=1` for
// it, which `@mcthaydt/automata-content/vite` turns into the `__AUTOMATA_DEBUG__` constant (true), so a game's dev-only tools are in the
// bundle. A release build sets nothing: the constant is false and the bundler drops every block it guards.

export interface BuildResult {
  /** vite's own exit code: non-zero means the build failed. */
  readonly exitCode: number
  /** The last lines of vite's output, for a failure message. */
  readonly tail: string
}

const TAIL_LINES = 20

export const runBuild = (options: {
  readonly gameDir: string
  readonly debug: boolean
}): Effect.Effect<BuildResult, CheckToolError, ProcessRunner | Files> =>
  Effect.gen(function* () {
    const bin = yield* findBin(options.gameDir, TOOLS.vite)
    const runner = yield* ProcessRunner
    const result = yield* Effect.mapError(
      runner.run(bin, ['build'], {
        cwd: options.gameDir,
        echo: true,
        ...(options.debug ? { env: { AUTOMATA_DEBUG: '1' } } : {}),
      }),
      (error) => new CheckToolError({ kind: 'failed', tool: TOOLS.vite.bin, detail: error.message }),
    )
    const tail = `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-TAIL_LINES).join('\n')
    return { exitCode: result.exitCode, tail }
  })
