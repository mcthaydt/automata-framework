// `automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast]`.

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

const isFlag = (token: string): token is keyof typeof FLAGS => Object.hasOwn(FLAGS, token)

export function parseCheckArgs(args: readonly string[]): CheckArgs {
  const options = {
    dir: undefined as string | undefined,
    json: false,
    simOnly: false,
    csp: false,
    failFast: false,
  }
  for (const token of args) {
    if (isFlag(token)) options[FLAGS[token]] = true
    else if (token.startsWith('-')) return { ok: false, problem: `unknown option ${token}` }
    else if (options.dir === undefined) options.dir = token
    else return { ok: false, problem: `unexpected argument ${token}` }
  }
  return { ok: true, options }
}
