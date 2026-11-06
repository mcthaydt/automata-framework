import { basename, resolve } from 'node:path'
import { Effect, Layer } from 'effect'
import { parseBuildArgs } from '../features/build/build-args.ts'
import { type BuildResult, runBuild } from '../features/build/run-build.ts'
import { parseCheckArgs } from '../shared/check/check-args.ts'
import { type CheckReport, exitCodeFor, formatText, toJson } from '../shared/check/check-report.ts'
import { CspProbeLive } from '../shared/check/ruken/csp-probe-live.ts'
import { type RunCheckOptions, runCheck } from '../shared/check/run-check.ts'
import { createGame } from '../shared/create-game/create-game.ts'
import { parseTargets } from '../shared/create-game/create-game-targets.ts'
import { FilesLive } from '../shared/node/files.ts'
import { ProcessRunnerLive } from '../shared/node/process-runner.ts'
import { type CliIo, PROCESS_IO } from './cli-io.ts'
import { BUILD_HELP, CHECK_HELP, CREATE_GAME_HELP, ROOT_HELP } from './help.ts'
import { runShip } from './ship-cli.ts'

export interface ParsedArgs {
  readonly targetDir?: string | undefined
  readonly id?: string | undefined
  readonly title?: string | undefined
  /** `--targets web,itch,…` as given; `create-game` checks it. */
  readonly targets?: string | undefined
  /** `--link-workspace`: for a game made inside this repository's workspace (the repository's own tests). */
  readonly linkWorkspace: boolean
  readonly help: boolean
}

export function parseArgs(args: readonly string[]): ParsedArgs {
  let targetDir: string | undefined
  let id: string | undefined
  let title: string | undefined
  let targets: string | undefined
  let help = false
  let linkWorkspace = false

  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === undefined) {
      continue
    }
    if (token === '--help' || token === '-h') {
      help = true
    } else if (token === '--id' && i + 1 < args.length) {
      id = args[++i]
    } else if (token === '--title' && i + 1 < args.length) {
      title = args[++i]
    } else if (token === '--link-workspace') {
      linkWorkspace = true
    } else if (token === '--targets' && i + 1 < args.length) {
      targets = args[++i]
    } else if (!token.startsWith('-') && targetDir === undefined) {
      targetDir = token
    }
  }

  return { targetDir, id, title, targets, linkWorkspace, help }
}

/** Runs `automata check` with the real processes, files and browser. */
export const runCheckLive = (options: RunCheckOptions): Promise<CheckReport> =>
  Effect.runPromise(
    Effect.provide(runCheck(options), Layer.mergeAll(FilesLive, ProcessRunnerLive, CspProbeLive)),
  )

/** Runs `automata build` with the real processes and files. */
export const runBuildLive = (options: { gameDir: string; debug: boolean }): Promise<BuildResult> =>
  Effect.runPromise(Effect.provide(runBuild(options), Layer.mergeAll(FilesLive, ProcessRunnerLive)))

const wantsHelp = (args: readonly string[]): boolean => args.includes('--help') || args.includes('-h')

async function buildCommand(
  args: readonly string[],
  io: CliIo,
  build: (options: { gameDir: string; debug: boolean }) => Promise<BuildResult>,
): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(BUILD_HELP)
    return 0
  }
  const parsed = parseBuildArgs(args)
  if (!parsed.ok) {
    io.stderr(`Error: ${parsed.problem}\n\n${BUILD_HELP}`)
    return 2
  }
  const { dir, debug } = parsed.options
  let result: BuildResult
  try {
    result = await build({ gameDir: resolve(process.cwd(), dir ?? '.'), debug })
  } catch (error) {
    // vite could not run (not installed, could not start): exit 2, never 1, which means the build failed.
    io.stderr(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    return 2
  }
  if (result.exitCode !== 0) {
    io.stderr(`${result.tail}\nautomata build: vite build failed (exit ${result.exitCode})\n`)
    return 1
  }
  io.stdout(`automata build: built${debug ? ' with the developer tools in' : ''}\n`)
  return 0
}

async function checkCommand(
  args: readonly string[],
  io: CliIo,
  check: (options: RunCheckOptions) => Promise<CheckReport>,
): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(CHECK_HELP)
    return 0
  }
  const parsed = parseCheckArgs(args)
  if (!parsed.ok) {
    io.stderr(`Error: ${parsed.problem}\n\n${CHECK_HELP}`)
    return 2
  }
  const { dir, json, simOnly, csp, failFast } = parsed.options
  const report = await check({ gameDir: resolve(process.cwd(), dir ?? '.'), simOnly, csp, failFast })
  io.stdout(json ? `${toJson(report)}\n` : formatText(report))
  return exitCodeFor(report)
}

export async function runCli(
  args: readonly string[],
  io: CliIo = PROCESS_IO,
  check: (options: RunCheckOptions) => Promise<CheckReport> = runCheckLive,
  build: (options: { gameDir: string; debug: boolean }) => Promise<BuildResult> = runBuildLive,
  ship: (args: readonly string[], io: CliIo) => Promise<number> = runShip,
): Promise<number> {
  const [command, ...rest] = args
  if (command === undefined || command === '--help' || command === '-h') {
    io.stdout(ROOT_HELP)
    return 0
  }
  if (command === 'create-game') return createGameCommand(rest, io)
  if (command === 'ship') return ship(rest, io)
  if (command === 'build') return buildCommand(rest, io, build)
  if (command === 'check') return checkCommand(rest, io, check)
  if (command === 'editor') {
    // Loaded only here: the editor suite's sources use extensionless imports that plain Node cannot read, and
    // pnpm runs this bin from source. Every other command must start without touching it.
    const { editorCommand, liveEditorDeps } = await import('../features/editor/editor-command.ts')
    return editorCommand(rest, io, liveEditorDeps())
  }
  // Never taken for a folder name: `automata my-game` must not make a game called "my-game" by accident.
  io.stderr(`Unknown command "${command}".\n\n${ROOT_HELP}`)
  return 2
}

async function createGameCommand(args: readonly string[], io: CliIo): Promise<number> {
  const parsed = parseArgs(args)

  if (parsed.help) {
    io.stdout(CREATE_GAME_HELP)
    return 0
  }

  if (!parsed.targetDir) {
    io.stderr(`Error: name a folder for the game, like: automata create-game my-game\n\n${CREATE_GAME_HELP}`)
    return 1
  }

  const targets = parseTargets(parsed.targets)
  if (!targets.ok) {
    io.stderr(`Error: ${targets.message}\n`)
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
    targets: targets.targets,
    linkWorkspace: parsed.linkWorkspace,
  })

  const exit = await Effect.runPromise(Effect.exit(program))
  if (exit._tag === 'Success') {
    // The folder as typed, so the next commands can be pasted as they are.
    const dir = parsed.targetDir
    io.stdout(`Created "${exit.value.title}" in ${dir}.\nNext: cd ${dir} && pnpm install && pnpm dev\n`)
    return 0
  }

  if (exit.cause._tag === 'Fail') {
    io.stderr(`Error: ${exit.cause.error.message}\n`)
  } else {
    io.stderr(`Error: ${String(exit.cause)}\n`)
  }
  return 1
}
