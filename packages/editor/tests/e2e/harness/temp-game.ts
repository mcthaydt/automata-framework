// A fresh copy of a game for one journey. A journey saves into the game it edits, so each one gets its own copy in a
// temp folder, never the committed game, and the copy is removed when the journey ends. Only the game's own files
// are copied: `node_modules`, builds and test output stay behind (the editor reads `content/` and the editor list).
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'

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
