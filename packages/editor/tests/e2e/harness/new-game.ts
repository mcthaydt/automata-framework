// A game made the way a person makes one: `automata create-game` in an empty folder outside the repository. Installing
// it from the packs is the stranger's journey (tooling/consumer-smoke); here the game borrows Emberwick's installed
// packages instead, which are this checkout's own builds of the same framework, so a journey about the editor does not
// spend minutes installing. Which packages is read from the game's own package.json (link-game-packages.ts), so what
// `create-game` adds to a game is linked without anyone editing this file.
import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { linkGamePackages, workspacePackages } from './link-game-packages.ts'
import { BIN } from './run-editor.ts'
import type { TempGame } from './temp-game.ts'

const WORKSPACE: string = fileURLToPath(new URL('../../../../../', import.meta.url))

/**
 * The first step of the game's `pnpm dev`, when it has one (the 2D game's `fonts` script, `automata-content assets`):
 * it writes the font styles the game's main.ts imports, into the git-ignored `content/generated/`. `automata editor`
 * starts the game's Vite alone, so without this the game's page is a 500 and Play opens a blank tab. The command is the
 * built one the content package publishes, run from the workspace: the game's own `.bin` is made by an install, which
 * this skips. A game with no such script (the 3D one) has nothing to write.
 */
async function writeGeneratedAssets(gameDir: string): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(gameDir, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }
  const [command, ...args] = (manifest.scripts?.fonts ?? '').split(' ')
  if (command === undefined || command === '') return
  if (command !== 'automata-content')
    throw new Error(`the new game's fonts script runs ${command}, which the journeys do not know how to run`)
  const content = workspacePackages(WORKSPACE).get('@automata/content')
  if (content === undefined)
    throw new Error('the workspace has no @automata/content to make the game’s fonts with')
  const published = JSON.parse(readFileSync(join(content, 'package.json'), 'utf8')) as {
    publishConfig?: { bin?: Record<string, string> }
  }
  const bin = published.publishConfig?.bin?.['automata-content']
  if (bin === undefined) throw new Error('@automata/content names no automata-content command')
  await promisify(execFile)(process.execPath, [join(content, bin), ...args], { cwd: gameDir })
}

export async function newGame(
  installedFrom: string,
  name = 'my-game',
  /** `--template 3d` makes the 3D game (this checkout has the 3D package, so the tools allow it). */
  template?: '2d' | '3d',
): Promise<TempGame> {
  const folder = mkdtempSync(join(tmpdir(), 'af-journey-new-'))
  await promisify(execFile)(
    process.execPath,
    [BIN, 'create-game', name, ...(template === undefined ? [] : ['--template', template])],
    { cwd: folder },
  )
  const dir = join(folder, name)
  linkGamePackages(dir, installedFrom, WORKSPACE)
  await writeGeneratedAssets(dir)
  return { dir, remove: () => rmSync(folder, { recursive: true, force: true }) }
}
