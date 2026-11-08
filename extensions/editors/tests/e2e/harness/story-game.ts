// A fresh copy of the 2D story for one journey. A journey saves into the game it edits, so each one gets its own copy in a
// temp folder, never the committed game. The copy sits two folders below a copy of `tsconfig.base.json` (as the game
// does in the repository), and borrows the story's installed packages by linking each into its own `node_modules`, so
// its Vite keeps its cache in the copy and no other run's dev server is reloaded by it.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO: string = fileURLToPath(new URL('../../../../../', import.meta.url))
/** The committed game the journeys copy. */
export const STORY: string = join(REPO, 'examples/2d-story')

/** What a copy leaves out: installed packages (linked instead), builds and the outputs of earlier test runs. */
const LEFT_BEHIND = new Set([
  'node_modules',
  'dist',
  '.e2e',
  '.evidence',
  'test-results',
  'playwright-report',
])

export interface StoryCopy {
  /** The copy's folder: what `automata editor <dir>` opens. */
  readonly dir: string
  /** Deletes the copy. Safe to call twice. */
  readonly remove: () => void
}

export function copyStory(): StoryCopy {
  const root = mkdtempSync(join(tmpdir(), 'af-journey-story-'))
  const dir = join(root, 'examples', '2d-story')
  mkdirSync(dir, { recursive: true })
  cpSync(join(REPO, 'tsconfig.base.json'), join(root, 'tsconfig.base.json'))
  cpSync(STORY, dir, {
    recursive: true,
    filter: (path) =>
      !relative(STORY, path)
        .split(sep)
        .some((part) => LEFT_BEHIND.has(part)),
  })
  const installed = join(STORY, 'node_modules')
  mkdirSync(join(dir, 'node_modules'))
  for (const entry of readdirSync(installed))
    if (entry !== '.vite') symlinkSync(join(installed, entry), join(dir, 'node_modules', entry), 'dir')
  return { dir, remove: () => rmSync(root, { recursive: true, force: true }) }
}
