import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compileGame, RUNTIME_SPECIFIERS } from '@mcthaydt/automata-editor/kit/player'
import { createMemoryStore } from '@mcthaydt/automata-editor/kit/storage'
import { toolsVersion } from '../../shared/create-game/tools-version.ts'

// `automata check-player`: whether a game plays on a phone or tablet, said before anyone presses Play. It runs the
// Automata app's own compile (the editor kit's `compileGame`) on the game's files, so Claude hears the same words the
// person would: a package the app does not carry, a newer framework than the app has, a `.svelte` file of the game's
// own. It checks against the runtime of the tools version the game pins; the Review card checks against the app.

export type PlayerCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly file?: string }

export interface CheckPlayerIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

const USAGE = `Usage: automata check-player [folder]

Checks that the game in <folder> (default: this folder) plays on a phone or tablet, with no computer.
It says what to change when it does not.
`

/** Folders a game does not carry to a phone: installed packages, git, the app's own files and a build. */
const SKIPPED = new Set(['node_modules', '.git', '.automata', 'dist', 'tests', '.evidence', '.e2e'])

async function readGame(root: string) {
  const store = createMemoryStore()
  const walk = async (folder: string, prefix: string): Promise<void> => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (SKIPPED.has(entry.name)) continue
      if (entry.isDirectory()) await walk(join(folder, entry.name), `${prefix}${entry.name}/`)
      else await store.write(`${prefix}${entry.name}`, readFileSync(join(folder, entry.name)))
    }
  }
  await walk(root, '')
  return store
}

/** Compiles the game in `root` as the phone app would, and says whether it can. */
export async function checkPlayer(root: string): Promise<PlayerCheck> {
  const version = toolsVersion()
  const result = await compileGame(await readGame(root), {
    packages: Object.fromEntries(
      RUNTIME_SPECIFIERS.map((specifier) => [specifier, { version, url: `./runtime/${specifier}` }]),
    ),
  })
  if (!('reason' in result)) return { ok: true }
  return { ok: false, message: result.message, ...(result.file === undefined ? {} : { file: result.file }) }
}

export async function checkPlayerCommand(args: readonly string[], io: CheckPlayerIo): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    io.stdout(USAGE)
    return 0
  }
  const folder = args.find((arg) => !arg.startsWith('-')) ?? '.'
  const result = await checkPlayer(resolve(folder))
  if (result.ok) {
    io.stdout('This game plays on a phone or tablet.\n')
    return 0
  }
  io.stderr(`${result.message}${result.file === undefined ? '' : ` (${result.file})`}\n`)
  return 1
}
