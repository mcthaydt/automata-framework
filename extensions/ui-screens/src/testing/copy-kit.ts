// What `automata add ui-screens` does, for the kit's own tests: copies each `from` in kit.json to its `to` in a game folder. The
// folder is made inside the kit's package (not the system temp) so the copy resolves `@mcthaydt/automata-ui` and `svelte` as a
// game's files would.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const KIT_ROOT: string = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

interface KitFile {
  readonly from: string
  readonly to: string
}
const files = (): readonly KitFile[] =>
  (JSON.parse(readFileSync(join(KIT_ROOT, 'kit.json'), 'utf8')) as { files: KitFile[] }).files

/** Each file the kit copies, with its text. */
export const kitSources = (): readonly { from: string; text: string }[] =>
  files().map(({ from }) => ({ from, text: readFileSync(join(KIT_ROOT, from), 'utf8') }))

/** The module specifiers a source file imports. */
export function specifiersOf(text: string): string[] {
  return [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map((m) => m[1] as string)
}

/** Copies the kit into a new game folder and returns it. The caller removes it. */
export function copyKit(): string {
  const parent = join(KIT_ROOT, '.copy-in')
  mkdirSync(parent, { recursive: true })
  const game = mkdtempSync(join(parent, 'game-'))
  for (const { from, to } of files()) {
    mkdirSync(dirname(join(game, to)), { recursive: true })
    copyFileSync(join(KIT_ROOT, from), join(game, to))
  }
  return game
}
