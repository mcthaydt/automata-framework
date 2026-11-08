import { dirname, join } from 'node:path'
import { Effect } from 'effect'
import { Files } from '../node/files.ts'
import { ProcessRunner, type RunResult } from '../node/process-runner.ts'
import type { CheckFinding } from './check-report.ts'
import { CheckToolError, type CspProbe } from './csp-probe.ts'

// What the steps of `automata check` share: the tools they run, found in `node_modules/.bin` from the game folder
// upwards, and what a step returns. A step returns its findings, or fails with CheckToolError when it could not run:
// a missing tool, or a tool that exits non-zero without printing anything the step can read. A tool error is never
// a pass.

/** A tool the game installs and `check` runs from its `node_modules/.bin`. */
export interface Tool {
  readonly bin: string
  /** The npm package that provides the bin. */
  readonly pkg: string
}

/** The tools `check` and `build` run. */
export const TOOLS: Readonly<Record<'boundaries' | 'tsc' | 'vitest' | 'vite', Tool>> = {
  boundaries: { bin: 'automata-check-boundaries', pkg: '@mcthaydt/automata-check-boundaries' },
  tsc: { bin: 'tsc', pkg: 'typescript' },
  vitest: { bin: 'vitest', pkg: 'vitest' },
  vite: { bin: 'vite', pkg: 'vite' },
}

/** What every step of `automata check` is: its findings, or a tool error when it could not run. */
export type StepEffect = Effect.Effect<
  readonly CheckFinding[],
  CheckToolError,
  ProcessRunner | Files | CspProbe
>

/** The last lines of a tool's output, for a message. */
export const tail = (result: RunResult, lines = 20): string =>
  `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-lines).join('\n')

/** The tool's bin, found in `node_modules/.bin` from the game folder upwards (a workspace hoists tools to its root). */
export const findBin = (gameDir: string, tool: Tool): Effect.Effect<string, CheckToolError, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    let dir = gameDir
    for (;;) {
      const candidate = join(dir, 'node_modules', '.bin', tool.bin)
      if (yield* files.exists(candidate)) return candidate
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return yield* new CheckToolError({
      kind: 'missing',
      tool: tool.bin,
      detail: `install it: npm install --save-dev ${tool.pkg}`,
    })
  })

/** Runs the game's tool with the game folder as the working folder; a missing tool or one that cannot start is a tool error. */
export const runTool = (
  gameDir: string,
  tool: Tool,
  args: readonly string[],
): Effect.Effect<RunResult, CheckToolError, Files | ProcessRunner> =>
  Effect.gen(function* () {
    const bin = yield* findBin(gameDir, tool)
    const runner = yield* ProcessRunner
    return yield* Effect.mapError(
      runner.run(bin, args, { cwd: gameDir }),
      (error) => new CheckToolError({ kind: 'failed', tool: tool.bin, detail: error.message }),
    )
  })

/** A non-zero exit with nothing parseable means the tool itself failed, not the game. */
export const findingsOrToolError = (
  tool: Tool,
  result: RunResult,
  findings: readonly CheckFinding[],
): Effect.Effect<readonly CheckFinding[], CheckToolError> =>
  result.exitCode === 0 || findings.length > 0
    ? Effect.succeed(findings)
    : Effect.fail(
        new CheckToolError({
          kind: 'failed',
          tool: tool.bin,
          detail: `exited ${result.exitCode}: ${tail(result)}`,
        }),
      )
