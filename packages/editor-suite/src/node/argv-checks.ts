// The game's own checks, run as the editor list declares them (editor suite spec §4.2, §7): argv in the game checkout
// with no shell, output capped (`runArgv`), `{path}` and `{scene}` the only substitutions. Every requested check runs
// at once, one job per check id: a newer run of an id cancels that id in the older run. A `before` check reads the
// candidate text from a fresh folder named by `AUTOMATA_CANDIDATES`, removed when the run ends.
//
// What a check's exit and output mean (EDS.1d-a plan, decision 1): exit 0 is a pass (`warn` with only warnings, `fail`
// with an error finding); exit 1 with readable JSON is a fail; anything else is an `error` with its output.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type {
  CheckDef,
  CheckFinding,
  CheckResult,
  CheckRun,
  ChecksRunner,
} from '@mcthaydt/automata-editor-kit/ports'
import { automataCheckOutputSchema, type CheckOutput, suiteCheckOutputSchema } from './check-output.schema'
import { type ArgvResult, runArgv } from './run-argv'

export interface ArgvChecksOptions {
  /** The game's checkout, where every check runs. */
  readonly root: string
  /** The editor list's `[[check]]` rows. */
  readonly checks: readonly CheckDef[]
  /** The scene of a path, from the editor list's row (EDS.1d-b); without it `{scene}` has no value. */
  readonly sceneOf?: ((path: string) => string | undefined) | undefined
  /** How long one check may run (default five minutes). */
  readonly timeoutMs?: number | undefined
  /** The checks' environment (default this process's); `AUTOMATA_CANDIDATES` is added. */
  readonly env?: NodeJS.ProcessEnv | undefined
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000

type Candidate = { readonly path: string; readonly text: string }

/** A path inside the game root: relative, `/`-separated, no `..`, `.` or empty segment. */
const insideRoot = (path: string): boolean =>
  path !== '' &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')

const errorResult = (check: string, output: string): CheckResult => ({
  check,
  status: 'error',
  findings: [],
  output,
})

/** The output as the person reads it: both streams, and a note when the cap cut it. */
function outputOf(result: ArgvResult): string {
  const parts = [
    result.stdout,
    result.stderr,
    result.truncated ? '[output cut at 200 KB]' : '',
    result.error ?? '',
  ]
  return parts.filter((part) => part !== '').join('\n')
}

/** The findings a check printed: undefined for no output, `unreadable` for output that is not a shape the suite reads. */
function parseOutput(stdout: string): CheckOutput | 'unreadable' | undefined {
  const text = stdout.trim()
  if (text === '') return undefined
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return 'unreadable'
  }
  const report = automataCheckOutputSchema.safeParse(json)
  if (report.success)
    return {
      findings: report.data.steps.flatMap((step) =>
        step.findings.map(
          (finding): CheckFinding => ({
            ...(finding.file === '' ? {} : { path: finding.file }),
            ...(finding.line > 0 ? { line: finding.line, column: finding.col } : {}),
            severity: 'error',
            message: `${finding.rule}: ${finding.message}`,
          }),
        ),
      ),
    }
  const own = suiteCheckOutputSchema.safeParse(json)
  if (!own.success) return 'unreadable'
  return {
    findings: own.data.findings ?? [],
    ...(own.data.measure === undefined ? {} : { measure: own.data.measure }),
  }
}

function resultOf(def: CheckDef, ran: ArgvResult): CheckResult {
  const output = outputOf(ran)
  if (ran.error !== undefined || (ran.code !== 0 && ran.code !== 1)) return errorResult(def.id, output)
  const parsed = parseOutput(ran.stdout)
  if (ran.code === 1 && (parsed === undefined || parsed === 'unreadable')) return errorResult(def.id, output)
  const { findings, measure } =
    parsed === undefined || parsed === 'unreadable' ? { findings: [], measure: undefined } : parsed
  const status =
    ran.code === 1 || findings.some((finding) => finding.severity === 'error')
      ? 'fail'
      : findings.length > 0
        ? 'warn'
        : 'pass'
  const passed = status === 'pass' || status === 'warn'
  return {
    check: def.id,
    status,
    findings,
    ...(measure === undefined ? {} : { measure }),
    ...(passed && def.joins.length > 0 ? { joined: def.joins } : {}),
    output,
  }
}

/** The argv with `{path}` and `{scene}` filled in, or why it cannot be. */
function argvFor(
  def: CheckDef,
  path: string | undefined,
  scene: string | undefined,
): readonly string[] | string {
  const argv: string[] = []
  for (const arg of def.run) {
    if (arg.includes('{path}') && path === undefined)
      return `${def.id} needs a file for {path}, and the run gave none`
    if (arg.includes('{scene}') && scene === undefined)
      return `${def.id} needs a file in a scene for {scene}, and the run gave none`
    argv.push(arg.replaceAll('{path}', path ?? '').replaceAll('{scene}', scene ?? ''))
  }
  return argv
}

export function createArgvChecks(options: ArgvChecksOptions): ChecksRunner {
  const byId = new Map(options.checks.map((def) => [def.id, def]))
  /** The running job of each check id, so a newer run can replace it. */
  const running = new Map<string, AbortController>()
  let runs = 0

  const writeCandidates = async (candidates: readonly Candidate[]): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), 'af-candidates-'))
    for (const candidate of candidates) {
      const file = join(dir, candidate.path)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, candidate.text)
    }
    return dir
  }

  const runOne = async (
    id: string,
    abort: AbortController,
    candidates: readonly Candidate[],
    dir: string | undefined,
  ): Promise<CheckResult> => {
    const def = byId.get(id)
    if (def === undefined) return errorResult(id, `${id} is not a check the editor list declares`)
    const path = candidates[0]?.path
    const argv = argvFor(def, path, path === undefined ? undefined : options.sceneOf?.(path))
    if (typeof argv === 'string') return errorResult(id, argv)
    const env = {
      ...(options.env ?? process.env),
      ...(dir === undefined ? {} : { AUTOMATA_CANDIDATES: dir }),
    }
    const ran = await runArgv(argv, {
      cwd: options.root,
      env,
      signal: abort.signal,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
    return resultOf(def, ran)
  }

  return {
    declared: () => options.checks,
    async run(request) {
      const id = `run-${++runs}`
      const candidates = request.candidates ?? []
      const jobs = request.checks.map((check) => {
        const abort = new AbortController()
        running.get(check)?.abort('replaced by a newer run of this check')
        running.set(check, abort)
        return { check, abort }
      })
      const outside = candidates.find((candidate) => !insideRoot(candidate.path))
      const settled = (async (): Promise<CheckResult[]> => {
        if (outside !== undefined)
          return jobs.map(({ check }) =>
            errorResult(check, `the candidate ${outside.path} is outside the game root`),
          )
        const dir = candidates.length > 0 ? await writeCandidates(candidates) : undefined
        try {
          return await Promise.all(
            jobs.map(({ check, abort }) =>
              abort.signal.aborted
                ? errorResult(check, String(abort.signal.reason))
                : runOne(check, abort, candidates, dir),
            ),
          )
        } finally {
          if (dir !== undefined) await rm(dir, { recursive: true, force: true })
          for (const { check, abort } of jobs) if (running.get(check) === abort) running.delete(check)
        }
      })()
      const run: CheckRun = {
        id,
        result: () => settled,
        cancel: () => {
          for (const { abort } of jobs) abort.abort('cancelled')
        },
      }
      return run
    },
  }
}
