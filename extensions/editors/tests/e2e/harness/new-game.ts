// A game made the way a person makes one: `automata create-game` in an empty folder outside the repository. Installing it
// from the packs is the stranger's journey (tooling/consumer-smoke); here the game borrows the 2D story's installed
// packages (this checkout's own builds, which include the Feel and Audio extensions a new game imports), each linked one by
// one into the game's own node_modules so its Vite keeps its cache in the game.
import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { STORY } from './story-game.ts'
import { BIN } from './run-editor.ts'
import type { StoryCopy } from './story-game.ts'

export async function newGame(name = 'my-game'): Promise<StoryCopy> {
  const folder = mkdtempSync(join(tmpdir(), 'af-journey-new-'))
  await promisify(execFile)(process.execPath, [BIN, 'create-game', name], { cwd: folder })
  const dir = join(folder, name)
  const installed = join(STORY, 'node_modules')
  mkdirSync(join(dir, 'node_modules'))
  for (const entry of readdirSync(installed))
    if (entry !== '.vite') symlinkSync(join(installed, entry), join(dir, 'node_modules', entry), 'dir')
  return { dir, remove: () => rmSync(folder, { recursive: true, force: true }) }
}
