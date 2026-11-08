// A game made the way a person makes one: `automata create-game` in an empty folder outside the repository. Installing
// it from the packs is the stranger's journey (tooling/consumer-smoke); here the game borrows Emberwick's installed
// packages instead, which are this checkout's own builds of the same framework, so a journey about the editor does not
// spend minutes installing.
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
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
  symlinkSync(join(installedFrom, 'node_modules'), join(dir, 'node_modules'), 'dir')
  return { dir, remove: () => rmSync(folder, { recursive: true, force: true }) }
}
