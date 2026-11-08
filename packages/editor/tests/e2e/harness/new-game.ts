// A game made the way a person makes one: `automata create-game` in an empty folder outside the repository. Installing
// it from the packs is the stranger's journey (tooling/consumer-smoke); here the game borrows Emberwick's installed
// packages instead, which are this checkout's own builds of the same framework, so a journey about the editor does not
// spend minutes installing. Each package is linked one by one into the game's own node_modules, so the game's Vite keeps
// its cache (`node_modules/.vite`) in the game: a cache shared with Emberwick's would make one dev server reload the
// other's page.
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { BIN } from './run-editor.ts'
import type { TempGame } from './temp-game.ts'

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
  const installed = join(installedFrom, 'node_modules')
  mkdirSync(join(dir, 'node_modules'))
  for (const entry of readdirSync(installed))
    if (entry !== '.vite') symlinkSync(join(installed, entry), join(dir, 'node_modules', entry), 'dir')
  return { dir, remove: () => rmSync(folder, { recursive: true, force: true }) }
}
