// A fresh copy of a game for one journey. A journey saves into the game it edits, so each one gets its own copy in a
// temp folder, never the committed game, and the copy is removed when the journey ends. Only the game's own files
// are copied: `node_modules`, builds and test output stay behind (the editor reads `content/` and the editor list).
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve, sep } from 'node:path'

/** What a copy leaves out: installed packages, builds and the outputs of earlier test runs. */
const LEFT_BEHIND = new Set([
  'node_modules',
  'dist',
  '.e2e',
  '.evidence',
  'test-results',
  'playwright-report',
])

export interface TempGame {
  /** The copy's folder: what `automata editor <dir>` opens. */
  readonly dir: string
  /** Deletes the copy. Safe to call twice. */
  readonly remove: () => void
}

/** Copies the game in `source` to a new temp folder. */
export function copyGame(source: string): TempGame {
  const dir = join(mkdtempSync(join(tmpdir(), `af-journey-${basename(source)}-`)), basename(source))
  cpSync(source, dir, {
    recursive: true,
    filter: (path) =>
      !relative(source, path)
        .split(sep)
        .some((part) => LEFT_BEHIND.has(part)),
  })
  return { dir, remove: () => rmSync(join(dir, '..'), { recursive: true, force: true }) }
}

/**
 * A copy of a game that runs: `copyGame`, plus its own `node_modules` made of links to the installed game's packages
 * (this checkout's builds), so the game's Vite keeps its cache (`node_modules/.vite`) in the copy and the editor can start
 * the game for Play.
 */
export function copyInstalledGame(source: string): TempGame {
  const game = copyGame(source)
  // A game in this repository extends the repository's base tsconfig by a relative path; in a temp folder that path is
  // gone, so the copy points at the base where it is.
  const tsconfig = join(game.dir, 'tsconfig.json')
  if (existsSync(tsconfig)) {
    const config = JSON.parse(readFileSync(tsconfig, 'utf8')) as { extends?: string }
    if (config.extends?.startsWith('.') === true)
      writeFileSync(
        tsconfig,
        JSON.stringify({ ...config, extends: resolve(source, config.extends) }, null, 2),
      )
  }
  const installed = join(source, 'node_modules')
  mkdirSync(join(game.dir, 'node_modules'))
  for (const entry of readdirSync(installed))
    if (entry !== '.vite') symlinkSync(join(installed, entry), join(game.dir, 'node_modules', entry), 'dir')
  return game
}
