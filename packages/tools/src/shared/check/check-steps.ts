import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect } from 'effect'
import { Files } from '../node/files.ts'
import { ProcessRunner } from '../node/process-runner.ts'
import { readEnvValues, scanTextForSecrets } from '../ship/prepare/secret-scan.ts'
import type { CheckFinding } from './check-report.ts'
import { findingsOrToolError, runTool, type StepEffect, TOOLS, tail } from './check-tool.ts'
import { CheckToolError, CspProbe } from './csp-probe.ts'
import { scanForDataUrls } from './data-url-scan.ts'
import { scanForEval } from './no-eval-scan.ts'
import { parseBoundaries, parseTsc, parseVitestJson } from './tool-output.ts'

// The steps of `automata check` that run something: the boundaries checker and the game's own tools (`tsc`,
// `vitest`, `vite`), then the scans of the `dist/` the build left, and the page load that proves the CSP. The scans
// that compare the game's sources with its `ship.config.ts` are in `check-source-steps.ts`; the tools and what a step
// returns are in `check-tool.ts`.

/** How long the `csp` step waits for the game's ready signal. */
export const CSP_READY_TIMEOUT_MS = 20_000

/**
 * The boundaries checker, as the path of the CLI that `node` runs. It is part of this package, so a new game does not
 * install it and it is always the version of the tools that run it. From source it is `features/boundaries/cli.ts`;
 * in a published install it is the built `boundaries-cli.js` beside the bundle that holds this code. Node 24 runs both.
 */
export function boundariesCli(): string {
  const built = fileURLToPath(new URL('./boundaries-cli.js', import.meta.url))
  return existsSync(built)
    ? built
    : fileURLToPath(new URL('../../features/boundaries/cli.ts', import.meta.url))
}

const WHERE_CODE_GOES = 'Put game code in src/features/<name>/ (see the guide).'

// Every game keeps its code in `src/features/<name>/`, with `src/shared/` and `src/app/` beside it. The base 3D game
// still keeps its sim in role files (`src/systems.ts`, `src/state.ts`, ...) until its own slice moves it; it is
// allowed by name, and no other game is.
const ROLE_LAYOUT_GAMES: readonly string[] = ['base-3d']
const GAME_SIM_ROLES = ['constants', 'components', 'commands', 'events', 'resources', 'systems', 'state']

export const boundariesStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const src = join(gameDir, 'src')
    const toolError = (detail: string) =>
      new CheckToolError({ kind: 'failed', tool: TOOLS.boundaries.bin, detail })
    let laidOutByRole = false
    if (ROLE_LAYOUT_GAMES.includes(basename(gameDir))) {
      for (const role of GAME_SIM_ROLES)
        laidOutByRole ||=
          (yield* files.exists(join(src, `${role}.ts`))) || (yield* files.exists(join(src, role)))
    }
    const laidOutByFeature = yield* files.exists(join(src, 'features'))
    if ((!laidOutByFeature && !laidOutByRole) || (yield* files.exists(join(src, 'sim')))) {
      return yield* toolError(WHERE_CODE_GOES)
    }
    const cli = yield* Effect.try({
      try: boundariesCli,
      catch: (cause) =>
        new CheckToolError({ kind: 'missing', tool: TOOLS.boundaries.bin, detail: String(cause) }),
    })
    const runner = yield* ProcessRunner
    const result = yield* Effect.mapError(
      runner.run(process.execPath, [cli, '--game', 'src'], { cwd: gameDir }),
      (error) => toolError(error.message),
    )
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
      // A workspace game's vitest config imports the framework's TypeScript source, whose extensionless imports Node's
      // default config loader cannot resolve; the runner loader reads that config and a plain one alike.
      '--configLoader',
      'runner',
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
 * The assets Vite inlined as `data:` URLs (data-url-scan.ts), in the JavaScript of the `dist/` the no-eval
 * step just built. Ruken's CSP refuses to fetch them, so each one is an asset the game never loads.
 */
export const dataUrlsStep = (gameDir: string): StepEffect =>
  Effect.gen(function* () {
    const files = yield* Files
    const distDir = join(gameDir, 'dist')
    const toolError = (detail: string) => new CheckToolError({ kind: 'failed', tool: 'data-urls', detail })
    const listed = yield* Effect.mapError(files.listFiles(distDir), (error) => toolError(error.message))
    const findings: CheckFinding[] = []
    for (const path of listed.filter((name) => name.endsWith('.js'))) {
      const code = yield* Effect.mapError(files.readText(join(distDir, path)), (error) =>
        toolError(error.message),
      )
      findings.push(...scanForDataUrls(`dist/${path}`, code))
    }
    return findings
  })

/**
 * The bundle secret scan from `ship` (the one `prepare-ruken` runs), over the `dist/` the no-eval step just
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
