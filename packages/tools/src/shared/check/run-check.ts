import { Clock, Effect } from 'effect'
import type { Files } from '../node/files.ts'
import type { ProcessRunner } from '../node/process-runner.ts'
import { type CheckReport, reportOf, type StepName, type StepResult } from './check-report.ts'
import { boardsStep, inputsStep, orientationStep } from './check-source-steps.ts'
import {
  boundariesStep,
  cspStep,
  dataUrlsStep,
  noEvalStep,
  secretsStep,
  testStep,
  typecheckStep,
} from './check-steps.ts'
import type { CspProbe } from './csp-probe.ts'

// `automata check`: the steps in order, each timed with Effect's Clock. Without --fail-fast every
// step runs, so one report lists every problem; with it, the first step that does not pass ends the run.

export interface RunCheckOptions {
  /** Absolute path of the game folder. */
  readonly gameDir: string
  readonly simOnly: boolean
  readonly csp: boolean
  readonly failFast: boolean
}

type Step = readonly [StepName, (gameDir: string) => ReturnType<typeof boundariesStep>]

function stepsFor(options: RunCheckOptions): readonly Step[] {
  const steps: Step[] = [
    ['boundaries', boundariesStep],
    ['typecheck', typecheckStep],
    ['test', testStep],
  ]
  // --sim-only checks a sim edit: it skips the board, orientation and inputs scans, the build, and the secrets,
  // data-urls and csp steps that read it.
  if (!options.simOnly)
    steps.push(
      ['boards', boardsStep],
      ['orientation', orientationStep],
      ['inputs', inputsStep],
      ['no-eval', noEvalStep],
      ['secrets', secretsStep],
      ['data-urls', dataUrlsStep],
    )
  if (!options.simOnly && options.csp) steps.push(['csp', cspStep])
  return steps
}

/** The steps that scan the `dist/` the `no-eval` step builds. */
const READS_THE_BUILD: ReadonlySet<StepName> = new Set(['secrets', 'data-urls'])

/**
 * Why the steps that read dist/ must not scan it, or undefined when no-eval built it and read it. A failed build
 * and a no-eval that could not run (no vite, an unreadable dist/) both leave whatever an earlier build wrote.
 */
function distNotScanned(results: readonly StepResult[]): string | undefined {
  const noEval = results.find((result) => result.name === 'no-eval')
  if (noEval === undefined) return undefined
  if (noEval.toolError) return 'not scanned: no-eval could not build or read dist/ (see no-eval)'
  if (noEval.findings.some((finding) => finding.rule === 'build'))
    return 'not scanned: the build failed (see no-eval)'
  return undefined
}

export function runCheck(
  options: RunCheckOptions,
): Effect.Effect<CheckReport, never, ProcessRunner | Files | CspProbe> {
  return Effect.gen(function* () {
    const results: StepResult[] = []
    for (const [name, step] of stepsFor(options)) {
      // A dist/ left over from an earlier build is not this game's bundle: say it was not scanned, never pass it.
      const notScanned = READS_THE_BUILD.has(name) ? distNotScanned(results) : undefined
      if (notScanned !== undefined) {
        results.push({
          name,
          ok: false,
          ms: 0,
          toolError: false,
          findings: [{ file: '', line: 0, col: 0, rule: 'build', message: notScanned }],
        })
        if (options.failFast) break
        continue
      }
      const start = yield* Clock.currentTimeMillis
      const outcome = yield* Effect.either(step(options.gameDir))
      const ms = (yield* Clock.currentTimeMillis) - start
      const result: StepResult =
        outcome._tag === 'Right'
          ? { name, ok: outcome.right.length === 0, ms, findings: outcome.right, toolError: false }
          : {
              name,
              ok: false,
              ms,
              toolError: true,
              findings: [
                {
                  file: '',
                  line: 0,
                  col: 0,
                  rule: outcome.left.kind === 'missing' ? 'tool-missing' : 'tool-error',
                  message: outcome.left.message,
                },
              ],
            }
      results.push(result)
      if (options.failFast && !result.ok) break
    }
    return reportOf(results)
  })
}
