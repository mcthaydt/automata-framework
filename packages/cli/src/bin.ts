import { basename, resolve } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { parseAddArgs } from './add/add-args.ts'
import { KitSourceLive } from './add/kit-source.ts'
import { type AddError, type AddResult, addExitCode, type RunAddOptions, runAdd } from './add/run-add.ts'
import { parseCheckArgs } from './check/check-args.ts'
import { type CheckReport, exitCodeFor, formatText, toJson } from './check/check-report.ts'
import { CspProbeLive } from './check/csp-probe-live.ts'
import { type RunCheckOptions, runCheck } from './check/run-check.ts'
import { createGame } from './create-game.ts'

export interface ParsedArgs {
  readonly targetDir?: string | undefined
  readonly id?: string | undefined
  readonly title?: string | undefined
  readonly help: boolean
}

export interface CliIo {
  readonly stdout: (msg: string) => void
  readonly stderr: (msg: string) => void
}

const DEFAULT_IO: CliIo = {
  stdout: (msg) => process.stdout.write(msg),
  stderr: (msg) => process.stderr.write(msg),
}

export function parseArgs(args: readonly string[]): ParsedArgs {
  let targetDir: string | undefined
  let id: string | undefined
  let title: string | undefined
  let help = false

  const tokens = [...args]
  if (tokens[0] === 'create-game') {
    tokens.shift()
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === undefined) {
      continue
    }
    if (token === '--help' || token === '-h') {
      help = true
    } else if (token === '--id' && i + 1 < tokens.length) {
      id = tokens[++i]
    } else if (token === '--title' && i + 1 < tokens.length) {
      title = tokens[++i]
    } else if (!token.startsWith('-') && targetDir === undefined) {
      targetDir = token
    }
  }

  return { targetDir, id, title, help }
}

const USAGE = `Usage: automata create-game <target-dir> [--id <id>] [--title <title>]
       automata add <kit> [--dir <game>] [--repo <url>] [--force]
       automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast]

create-game scaffolds a new Automata Framework game project.
add copies an Automata Plus kit into a game at its installed core version, then runs check
(exit 0 added and checked, 1 added and check found problems, 2 either not added (no access, unknown kit,
core version, collision, or a failed copy, which is undone) or added and a check step could not run,
in which case the kit stays in place).
check runs, in a game folder: boundaries, typecheck, tests, the boards, orientation and inputs scans of the
sources, no-eval (vite build, then a scan of the bundle), the secrets and data-urls scans of that build, and
with --csp the browser CSP check; --sim-only runs only the first three
(exit 0 pass, 1 findings, 2 a tool could not run).

Options:
  --id <id>        Unique game identifier (lowercase alphanumeric with hyphens)
  --title <title>  Display title of the game
  --dir <game>     add: the game folder (default: the working folder)
  --repo <url>     add: the kit repository (default: the Automata Plus repository)
  --force          add: replace files the game already has
  -h, --help       Show this help message
`

/** Runs `automata check` with the real processes, files and browser. */
export const runCheckLive = (options: RunCheckOptions): Promise<CheckReport> =>
  Effect.runPromise(
    Effect.provide(runCheck(options), Layer.mergeAll(FilesLive, ProcessRunnerLive, CspProbeLive)),
  )

/** Runs `automata add` with real git, files and processes; the check after it is `automata check` with no flags. */
export const runAddLive = (options: RunAddOptions): Promise<AddResult | AddError> =>
  Effect.runPromise(
    Effect.provide(
      Effect.merge(
        runAdd(options, (gameDir) => runCheck({ gameDir, simOnly: false, csp: false, failFast: false })),
      ),
      Layer.mergeAll(
        FilesLive,
        ProcessRunnerLive,
        CspProbeLive,
        Layer.provide(KitSourceLive, ProcessRunnerLive),
      ),
    ),
  )

async function addCommand(
  args: readonly string[],
  io: CliIo,
  add: (options: RunAddOptions) => Promise<AddResult | AddError>,
): Promise<number> {
  const parsed = parseAddArgs(args)
  if (!parsed.ok) {
    io.stderr(`Error: ${parsed.problem}\n\n${USAGE}`)
    return 2
  }
  const { kit, dir, repo, force } = parsed.options
  let outcome: AddResult | AddError
  try {
    outcome = await add({ kit, gameDir: resolve(process.cwd(), dir), repo, force })
  } catch (error) {
    // A crash (a file the CLI may not read, say) could not run the add: exit 2, never 1, which means the check failed.
    io.stderr(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
  if ('reason' in outcome) {
    io.stderr(`Error: ${outcome.message}\n`)
    return addExitCode(outcome)
  }
  const files = outcome.files.map((file) => `  ${file}\n`).join('')
  io.stdout(`Added ${outcome.kit} from ${outcome.tag}:\n${files}${formatText(outcome.report)}`)
  if (!outcome.report.ok)
    io.stdout(
      'The kit is in place and automata check did not pass: fix what it reports, or remove the files listed above.\n',
    )
  return addExitCode(outcome)
}

async function checkCommand(
  args: readonly string[],
  io: CliIo,
  check: (options: RunCheckOptions) => Promise<CheckReport>,
): Promise<number> {
  const parsed = parseCheckArgs(args)
  if (!parsed.ok) {
    io.stderr(`Error: ${parsed.problem}\n\n${USAGE}`)
    return 2
  }
  const { dir, json, simOnly, csp, failFast } = parsed.options
  const report = await check({ gameDir: resolve(process.cwd(), dir ?? '.'), simOnly, csp, failFast })
  io.stdout(json ? `${toJson(report)}\n` : formatText(report))
  return exitCodeFor(report)
}

export async function runCli(
  args: readonly string[],
  io: CliIo = DEFAULT_IO,
  check: (options: RunCheckOptions) => Promise<CheckReport> = runCheckLive,
  add: (options: RunAddOptions) => Promise<AddResult | AddError> = runAddLive,
): Promise<number> {
  if (args[0] === 'check') return checkCommand(args.slice(1), io, check)
  if (args[0] === 'add') return addCommand(args.slice(1), io, add)
  const parsed = parseArgs(args)

  if (parsed.help) {
    io.stdout(USAGE)
    return 0
  }

  if (!parsed.targetDir) {
    io.stderr(`Error: target directory is required.\n\n${USAGE}`)
    return 1
  }

  const resolvedTarget = resolve(process.cwd(), parsed.targetDir)
  const id = parsed.id ?? basename(resolvedTarget).toLowerCase()
  const title =
    parsed.title ??
    id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  const program = createGame({
    targetDir: resolvedTarget,
    id,
    title,
  })

  const exit = await Effect.runPromise(Effect.exit(program))
  if (exit._tag === 'Success') {
    io.stdout(`Created game "${exit.value.title}" (${exit.value.id}) at ${exit.value.targetDir}\n`)
    return 0
  }

  if (exit.cause._tag === 'Fail') {
    io.stderr(`Error: ${exit.cause.error.message}\n`)
  } else {
    io.stderr(`Error: ${String(exit.cause)}\n`)
  }
  return 1
}

// Auto-run when executed directly via node
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('create-game.js') ||
  process.argv[1]?.endsWith('bin.js')

if (isMain) {
  void runCli(process.argv.slice(2)).then((code) => {
    if (code !== 0) {
      process.exitCode = code
    }
  })
}
