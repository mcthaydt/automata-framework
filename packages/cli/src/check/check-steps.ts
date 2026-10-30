import { dirname, join } from 'node:path'
import { Files, ProcessRunner, type RunResult } from '@mcthaydt/automata-node'
import {
  boardNamesIn,
  declaredBoardsIn,
  declaredInputsIn,
  declaredOrientationIn,
  gameOrientationsIn,
  inputsProblems,
  isBoardSource,
  isInputsSource,
  isOrientationSource,
  keysBindingsIn,
  readEnvValues,
  type ShipInputBindings,
  scanTextForSecrets,
} from '@mcthaydt/automata-ship'
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

// A game's sim is `src/sim/` or, laid out by role, these files in `src/` (GL spec §4.5). A copy of
// check-boundaries' GAME_SIM_ROLES: that package is a bin with no library entry; run-check.test.ts pins the names.
const GAME_SIM_ROLES = ['constants', 'components', 'commands', 'events', 'resources', 'systems', 'state']

export const boundariesStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const src = join(gameDir, 'src')
    const hasSimFolder = yield* files.exists(join(src, 'sim'))
    let hasRoleLayout = yield* files.exists(join(src, 'sim.ts'))
    for (const role of GAME_SIM_ROLES) {
      if (hasRoleLayout) break
      hasRoleLayout = (yield* files.exists(join(src, `${role}.ts`))) || (yield* files.exists(join(src, role)))
    }
    if (!hasSimFolder && !hasRoleLayout) {
      return yield* new CheckToolError({
        kind: 'failed',
        tool: TOOLS.boundaries.bin,
        detail: `no sim in ${gameDir}: expected a src/sim folder or sim files laid out by role (src/systems.ts, src/state.ts, …); automata check runs in a game folder`,
      })
    }
    const roots = [...(hasSimFolder ? ['src/sim'] : []), ...(hasRoleLayout ? ['--game', 'src'] : [])]
    const result = yield* runTool(gameDir, TOOLS.boundaries, roots)
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

/**
 * M5 spec §4.8, L-b: the board scan `prepare-ruken` runs, over the game's sources, against the boards its
 * `ship.config.ts` declares under `leaderboards` (read as written). No `ship.config.ts` declares no boards.
 */
export const boardsStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const toolError = (detail: string) => new CheckToolError({ kind: 'failed', tool: 'boards', detail })
    const configPath = join(gameDir, 'ship.config.ts')
    const declared = (yield* files.exists(configPath))
      ? declaredBoardsIn(
          yield* Effect.mapError(files.readText(configPath), (error) => toolError(error.message)),
        )
      : []
    if (declared === undefined)
      return yield* toolError(
        'cannot read the leaderboards in ship.config.ts: write them as an object literal',
      )
    const known = new Set(declared)
    const listed = yield* Effect.mapError(files.listFiles(gameDir), (error) => toolError(error.message))
    const findings: CheckFinding[] = []
    for (const file of listed.filter(isBoardSource).sort()) {
      const code = yield* Effect.mapError(files.readText(join(gameDir, file)), (error) =>
        toolError(error.message),
      )
      for (const name of boardNamesIn(file, code) ?? []) {
        if (known.has(name.board)) continue
        findings.push({
          file,
          line: name.line,
          col: name.col,
          rule: 'undeclared-board',
          message: `board "${name.board}" is not declared in ship.config.ts leaderboards`,
        })
      }
    }
    return findings
  })

/**
 * M4.7 follow-up: the scan `prepare-ruken` runs over the game's sources for the orientation each `defineGame`
 * plays in, against the `runtime.orientation` its `ship.config.ts` sends Ruken (read as written). A game with no
 * `ship.config.ts`, or with no `defineGame` to compare, finds nothing; a config whose orientation is not a
 * literal, with a `defineGame` to compare against it, is a tool error, never a pass.
 */
export const orientationStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const toolError = (detail: string) => new CheckToolError({ kind: 'failed', tool: 'orientation', detail })
    const configPath = join(gameDir, 'ship.config.ts')
    if (!(yield* files.exists(configPath))) return []
    const listed = yield* Effect.mapError(files.listFiles(gameDir), (error) => toolError(error.message))
    const played: { file: string; line: number; col: number; orientation: string }[] = []
    for (const file of listed.filter(isOrientationSource).sort()) {
      const code = yield* Effect.mapError(files.readText(join(gameDir, file)), (error) =>
        toolError(error.message),
      )
      for (const found of gameOrientationsIn(file, code) ?? []) played.push({ file, ...found })
    }
    if (played.length === 0) return []
    const declared = declaredOrientationIn(
      yield* Effect.mapError(files.readText(configPath), (error) => toolError(error.message)),
    )
    if (declared === undefined)
      return yield* toolError(
        'cannot read runtime.orientation in ship.config.ts: write it as a string literal',
      )
    return played
      .filter((found) => found.orientation !== declared)
      .map((found) => ({
        file: found.file,
        line: found.line,
        col: found.col,
        rule: 'orientation-mismatch',
        message: `defineGame plays "${found.orientation}", but ship.config.ts runtime.orientation is "${declared}"`,
      }))
  })

/**
 * M4.1 follow-up: the scan `prepare-ruken` runs over the game's sources for what its `keys()` calls bind, against
 * the `runtime.inputs` its `ship.config.ts` sends Ruken (read as written), with `inputsProblems`' own rule. A game
 * with no `ship.config.ts`, or with no `keys()` call to compare, finds nothing; a config whose inputs are not
 * string literals, with a `keys()` call to compare against them, is a tool error, never a pass.
 */
export const inputsStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const toolError = (detail: string) => new CheckToolError({ kind: 'failed', tool: 'inputs', detail })
    const configPath = join(gameDir, 'ship.config.ts')
    if (!(yield* files.exists(configPath))) return []
    const listed = yield* Effect.mapError(files.listFiles(gameDir), (error) => toolError(error.message))
    const bound: { [action: string]: ShipInputBindings[string] } = {}
    for (const file of listed.filter(isInputsSource).sort()) {
      const code = yield* Effect.mapError(files.readText(join(gameDir, file)), (error) =>
        toolError(error.message),
      )
      Object.assign(bound, keysBindingsIn(file, code))
    }
    if (Object.keys(bound).length === 0) return []
    const declared = declaredInputsIn(
      yield* Effect.mapError(files.readText(configPath), (error) => toolError(error.message)),
    )
    if (declared === undefined)
      return yield* toolError(
        'cannot read runtime.inputs in ship.config.ts: write it as an array of string literals',
      )
    return inputsProblems(declared.inputs, bound).map((message) => ({
      file: 'ship.config.ts',
      line: declared.line,
      col: declared.col,
      rule: 'inputs-mismatch',
      message,
    }))
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
