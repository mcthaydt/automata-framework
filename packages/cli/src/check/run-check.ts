import type { Files, ProcessRunner } from '@mcthaydt/automata-node'
import { Clock, Effect } from 'effect'
import { type CheckReport, reportOf, type StepName, type StepResult } from './check-report.ts'
import {
  boardsStep,
  boundariesStep,
  cspStep,
  dataUrlsStep,
  inputsStep,
  noEvalStep,
  orientationStep,
  secretsStep,
  testStep,
  typecheckStep,
} from './check-steps.ts'
import type { CspProbe } from './csp-probe.ts'

// `automata check` (DX spec §3.6): the steps in order, each timed with Effect's Clock. Without --fail-fast every
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

const buildFailed = (results: readonly StepResult[]): boolean =>
  results.some(
    (result) => result.name === 'no-eval' && result.findings.some((finding) => finding.rule === 'build'),
  )

export function runCheck(
  options: RunCheckOptions,
): Effect.Effect<CheckReport, never, ProcessRunner | Files | CspProbe> {
  return Effect.gen(function* () {
    const results: StepResult[] = []
    for (const [name, step] of stepsFor(options)) {
      // A dist/ left over from an earlier build is not this game's bundle: say it was not scanned, never pass it.
      if (READS_THE_BUILD.has(name) && buildFailed(results)) {
        results.push({
          name,
          ok: false,
          ms: 0,
          toolError: false,
          findings: [
            {
              file: '',
              line: 0,
              col: 0,
              rule: 'build',
              message: 'not scanned: the build failed (see no-eval)',
            },
          ],
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
