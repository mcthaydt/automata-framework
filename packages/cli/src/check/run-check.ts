import type { Files, ProcessRunner } from '@mcthaydt/automata-node'
import { Clock, Effect } from 'effect'
import { type CheckReport, reportOf, type StepName, type StepResult } from './check-report.ts'
import { boundariesStep, cspStep, noEvalStep, testStep, typecheckStep } from './check-steps.ts'
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
  // --sim-only skips the build, and the csp step serves that build.
  if (!options.simOnly) steps.push(['no-eval', noEvalStep])
  if (!options.simOnly && options.csp) steps.push(['csp', cspStep])
  return steps
}

export function runCheck(
  options: RunCheckOptions,
): Effect.Effect<CheckReport, never, ProcessRunner | Files | CspProbe> {
  return Effect.gen(function* () {
    const results: StepResult[] = []
    for (const [name, step] of stepsFor(options)) {
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
