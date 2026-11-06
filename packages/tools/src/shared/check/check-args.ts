// `automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast] [--only <step>]`.

import { STEP_NAMES, type StepName } from './check-report.ts'

export interface CheckOptions {
  /** The game folder; the working folder when undefined. */
  readonly dir: string | undefined
  /** Print only the JSON report (the shape the agent hooks read). */
  readonly json: boolean
  /**
   * Boundaries, typecheck and tests only: no source scans (`boards`, `orientation`, `inputs`) and no build, so none
   * of the steps that read it (`no-eval`, `secrets`, `data-urls`, `csp`).
   */
  readonly simOnly: boolean
  /** Also run the browser CSP smoke test. */
  readonly csp: boolean
  /** Stop after the first step that does not pass. */
  readonly failFast: boolean
  /** Run only this step (for the ones that need the build or a browser, with their own flag). */
  readonly only: StepName | undefined
}

export type CheckArgs =
  | { readonly ok: true; readonly options: CheckOptions }
  | { readonly ok: false; readonly problem: string }

const FLAGS = {
  '--json': 'json',
  '--sim-only': 'simOnly',
  '--csp': 'csp',
  '--fail-fast': 'failFast',
} as const

const isStep = (token: string | undefined): token is StepName => STEP_NAMES.some((name) => name === token)

const isFlag = (token: string): token is keyof typeof FLAGS => Object.hasOwn(FLAGS, token)

export function parseCheckArgs(args: readonly string[]): CheckArgs {
  const options = {
    dir: undefined as string | undefined,
    json: false,
    simOnly: false,
    csp: false,
    failFast: false,
    only: undefined as StepName | undefined,
  }
  for (let index = 0; index < args.length; index++) {
    const token = args[index] as string
    if (token === '--only') {
      const name = args[++index]
      if (!isStep(name)) return { ok: false, problem: `--only needs a step: ${STEP_NAMES.join(', ')}` }
      options.only = name
    } else if (isFlag(token)) options[FLAGS[token]] = true
    else if (token.startsWith('-')) return { ok: false, problem: `unknown option ${token}` }
    else if (options.dir === undefined) options.dir = token
    else return { ok: false, problem: `unexpected argument ${token}` }
  }
  return { ok: true, options }
}
