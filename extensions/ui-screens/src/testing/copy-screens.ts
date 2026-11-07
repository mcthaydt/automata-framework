// What a game does to change a screen: copies the screen's folder into its own source. The folder is made inside the
// package (not the system temp) so the copy resolves `@automata/framework` and `svelte` as a game's files would.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PACKAGE_ROOT: string = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

const FEATURES = join(PACKAGE_ROOT, 'src', 'features')

/** Each screen's folder, by name. */
export const screenFolders = (): readonly string[] => readdirSync(FEATURES).sort()

/** Every file of every screen, with its text. */
export const screenSources = (): readonly { from: string; text: string }[] =>
  screenFolders().flatMap((folder) =>
    readdirSync(join(FEATURES, folder)).map((file) => {
      const from = `src/features/${folder}/${file}`
      return { from, text: readFileSync(join(PACKAGE_ROOT, from), 'utf8') }
    }),
  )

/** The module specifiers a source file imports. */
export function specifiersOf(text: string): string[] {
  return [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map((m) => m[1] as string)
}

/** Copies every screen's folder into a new game's `src/screens/` and returns the game's folder. The caller removes it. */
export function copyScreens(): string {
  const parent = join(PACKAGE_ROOT, '.copy-in')
  mkdirSync(parent, { recursive: true })
  const game = mkdtempSync(join(parent, 'game-'))
  for (const folder of screenFolders()) {
    const to = join(game, 'src', 'screens', folder)
    mkdirSync(to, { recursive: true })
    for (const file of readdirSync(join(FEATURES, folder)))
      copyFileSync(join(FEATURES, folder, file), join(to, file))
  }
  return game
}
