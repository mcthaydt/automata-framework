import { basename, resolve } from 'node:path'
import { Effect } from 'effect'
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

Scaffold a new Automata Framework game project.

Options:
  --id <id>        Unique game identifier (lowercase alphanumeric with hyphens)
  --title <title>  Display title of the game
  -h, --help       Show this help message
`

export async function runCli(args: readonly string[], io: CliIo = DEFAULT_IO): Promise<number> {
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
