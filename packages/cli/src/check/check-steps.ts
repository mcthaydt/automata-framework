import { dirname, join } from 'node:path'
import { Files, ProcessRunner, type RunResult } from '@mcthaydt/automata-node'
import { readEnvValues, scanTextForSecrets } from '@mcthaydt/automata-ship'
import { Effect } from 'effect'
import type { CheckFinding } from './check-report.ts'
import { CheckToolError, CspProbe } from './csp-probe.ts'
import { scanForEval } from './no-eval-scan.ts'
import { parseBoundaries, parseTsc, parseVitestJson } from './tool-output.ts'

// The steps of `automata check` (DX spec §3.6). Each runs the game's own tool, found in `node_modules/.bin`
// from the game folder upwards (a workspace hoists tools to its root), with the game folder as the working
// folder. A step returns its findings, or fails with CheckToolError when it could not run: a missing tool, or a
// tool that exits non-zero without printing anything this file can read. A tool error is never a pass.

/** How long the `csp` step waits for the game's ready signal (DX spec §3.6). */
export const CSP_READY_TIMEOUT_MS = 20_000

interface Tool {
  readonly bin: string
  /** The npm package that provides the bin. */
  readonly pkg: string
}

const TOOLS = {
  boundaries: { bin: 'automata-check-boundaries', pkg: '@mcthaydt/automata-check-boundaries' },
  tsc: { bin: 'tsc', pkg: 'typescript' },
  vitest: { bin: 'vitest', pkg: 'vitest' },
  vite: { bin: 'vite', pkg: 'vite' },
} as const satisfies Record<string, Tool>

type StepEffect = Effect.Effect<readonly CheckFinding[], CheckToolError, ProcessRunner | Files | CspProbe>

/** The last lines of a tool's output, for a message. */
const tail = (result: RunResult, lines = 20): string =>
  `${result.stdout}\n${result.stderr}`.trim().split('\n').slice(-lines).join('\n')

const findBin = (gameDir: string, tool: Tool): Effect.Effect<string, CheckToolError, Files> =>
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

const runTool = (gameDir: string, tool: Tool, args: readonly string[]) =>
  Effect.gen(function* () {
    const bin = yield* findBin(gameDir, tool)
    const runner = yield* ProcessRunner
    return yield* Effect.mapError(
      runner.run(bin, args, { cwd: gameDir }),
      (error) => new CheckToolError({ kind: 'failed', tool: tool.bin, detail: error.message }),
    )
  })

/** A non-zero exit with nothing parseable means the tool itself failed, not the game. */
const findingsOrToolError = (tool: Tool, result: RunResult, findings: readonly CheckFinding[]) =>
  result.exitCode === 0 || findings.length > 0
    ? Effect.succeed(findings)
    : Effect.fail(
        new CheckToolError({
          kind: 'failed',
          tool: tool.bin,
          detail: `exited ${result.exitCode}: ${tail(result)}`,
        }),
      )

export const boundariesStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    if (!(yield* files.exists(join(gameDir, 'src', 'sim')))) {
      return yield* new CheckToolError({
        kind: 'failed',
        tool: TOOLS.boundaries.bin,
        detail: `no src/sim folder in ${gameDir}; automata check runs in a game folder`,
      })
    }
    const result = yield* runTool(gameDir, TOOLS.boundaries, ['src/sim'])
    return yield* findingsOrToolError(TOOLS.boundaries, result, parseBoundaries(result.stdout))
  })

export const typecheckStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const result = yield* runTool(gameDir, TOOLS.tsc, ['-p', '.', '--noEmit', '--pretty', 'false'])
    return yield* findingsOrToolError(TOOLS.tsc, result, parseTsc(result.stdout))
  })

export const testStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const reportPath = join(gameDir, 'node_modules', '.cache', 'automata-check', 'vitest.json')
    yield* Effect.orElse(files.remove(reportPath), () => Effect.void) // a stale report must never count
    const result = yield* runTool(gameDir, TOOLS.vitest, [
      'run',
      '--reporter=json',
      `--outputFile=${reportPath}`,
      '--includeTaskLocation',
    ])
    const report = yield* Effect.option(files.readText(reportPath))
    if (report._tag === 'None') {
      return yield* new CheckToolError({
        kind: 'failed',
        tool: TOOLS.vitest.bin,
        detail: `wrote no report (exit ${result.exitCode}): ${tail(result)}`,
      })
    }
    const findings = yield* Effect.try({
      try: () => parseVitestJson(report.value, gameDir),
      catch: (cause) =>
        new CheckToolError({
          kind: 'failed',
          tool: TOOLS.vitest.bin,
          detail: `unreadable report: ${String(cause)}`,
        }),
    })
    return yield* findingsOrToolError(TOOLS.vitest, result, findings)
  })

export const noEvalStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const build = yield* runTool(gameDir, TOOLS.vite, ['build'])
    if (build.exitCode !== 0) {
      return [{ file: '', line: 0, col: 0, rule: 'build', message: `vite build failed: ${tail(build)}` }]
    }
    const files = yield* Files
    const distDir = join(gameDir, 'dist')
    const listed = yield* Effect.mapError(
      files.listFiles(distDir),
      (error) => new CheckToolError({ kind: 'failed', tool: 'no-eval', detail: error.message }),
    )
    const findings: CheckFinding[] = []
    for (const path of listed.filter((name) => name.endsWith('.js'))) {
      const code = yield* Effect.mapError(
        files.readText(join(distDir, path)),
        (error) => new CheckToolError({ kind: 'failed', tool: 'no-eval', detail: error.message }),
      )
      findings.push(...scanForEval(`dist/${path}`, code))
    }
    return findings
  })

/**
 * QB-b: the bundle secret scan from `ship` (the one `prepare-ruken` runs), over the `dist/` the no-eval step just
 * built, with the game folder's `.env*` values. Files are read as UTF-8 text here, so the offset in a message
 * counts characters; line and column are what an editor needs.
 */
export const secretsStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const distDir = join(gameDir, 'dist')
    const toolError = (detail: string) => new CheckToolError({ kind: 'failed', tool: 'secrets', detail })
    const envValues = yield* Effect.try({
      try: () => readEnvValues(gameDir),
      catch: (cause) => toolError(`could not read the .env files: ${String(cause)}`),
    })
    const listed = yield* Effect.mapError(files.listFiles(distDir), (error) => toolError(error.message))
    const findings: CheckFinding[] = []
    for (const path of listed) {
      const text = yield* Effect.mapError(files.readText(join(distDir, path)), (error) =>
        toolError(error.message),
      )
      for (const found of scanTextForSecrets(path, text, envValues)) {
        findings.push({
          file: `dist/${found.file}`,
          line: found.line,
          col: found.col,
          rule: `secret-${found.rule}`,
          message: `${found.detail} at character ${found.offset}`,
        })
      }
    }
    return findings
  })

export const cspStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const probe = yield* CspProbe
    const result = yield* probe.run({
      gameDir,
      distDir: join(gameDir, 'dist'),
      timeoutMs: CSP_READY_TIMEOUT_MS,
    })
    const findings: CheckFinding[] = result.violations.map((message) => ({
      file: '',
      line: 0,
      col: 0,
      rule: 'csp-violation',
      message,
    }))
    if (result.state === 'failed') {
      findings.push({
        file: '',
        line: 0,
        col: 0,
        rule: 'boot-failed',
        message: 'the game set data-state="failed"',
      })
    } else if (!result.ready) {
      findings.push({
        file: '',
        line: 0,
        col: 0,
        rule: 'not-ready',
        message: `no ready signal (<html data-state="ready">) within ${CSP_READY_TIMEOUT_MS / 1000} s; last state: ${result.state ?? 'none'}`,
      })
    }
    return findings
  })
