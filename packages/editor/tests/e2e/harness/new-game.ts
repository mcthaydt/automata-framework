// A game made the way a person makes one: `automata create-game` in an empty folder outside the repository. Installing
// it from the packs is the stranger's journey (tooling/consumer-smoke); here the game borrows Emberwick's installed
// packages instead, which are this checkout's own builds of the same framework, so a journey about the editor does not
// spend minutes installing. Which packages is read from the game's own package.json (link-game-packages.ts), so what
// `create-game` adds to a game is linked without anyone editing this file. Nothing else is prepared here: the game's
// page needs its generated fonts, and `automata editor` makes them itself, as `pnpm dev` does.
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { linkGamePackages } from './link-game-packages.ts'
import { BIN } from './run-editor.ts'
import type { TempGame } from './temp-game.ts'

const WORKSPACE: string = fileURLToPath(new URL('../../../../../', import.meta.url))

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
  return { dir, remove: () => rmSync(folder, { recursive: true, force: true }) }
}
