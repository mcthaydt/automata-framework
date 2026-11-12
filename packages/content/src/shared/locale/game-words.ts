import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { MessageCatalog } from './messages.ts'

// Every word a game shows in one language, by catalog. The font build cuts its subsets to all of them, and `automata
// check` holds all of them to the font, so a letter a screen draws is never missing from the face the game ships.

/** Where a game keeps its own interface words, in the order they are looked for. */
export const UI_FOLDERS: readonly string[] = ['messages/ui', 'src/messages/ui']

/** The framework packages whose screens carry words, each as `<package>/words/<lang>.json` through its `exports`. */
export const WORD_PACKAGES: readonly string[] = [
  '@automata/framework',
  '@automata/ui-screens',
  '@automata/net-ui',
]

/**
 * `<package>/words/<lang>.json` as the package's `exports` maps it, found from the game's folder up through the
 * `node_modules` folders on the way, and nowhere else: what the game can import is what its words are. A package the game
 * does not have, or one that does not export its words, answers undefined.
 */
function packageWordsFile(gameDir: string, name: string, lang: string): string | undefined {
  for (let dir = gameDir; ; dir = dirname(dir)) {
    const root = join(dir, 'node_modules', name)
    if (existsSync(join(root, 'package.json'))) {
      let target: unknown
      try {
        const exported = (
          JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
            exports?: Record<string, unknown>
          }
        ).exports?.['./words/*.json']
        target =
          typeof exported === 'string' ? exported : (exported as { default?: unknown } | undefined)?.default
      } catch {
        return undefined
      }
      return typeof target === 'string' ? join(root, target.replace('*', lang)) : undefined
    }
    if (dirname(dir) === dir) return undefined
  }
}

/** A catalog file's messages: text only, without the `$schema` line. A file that is not a catalog is nothing. */
async function readCatalog(path: string): Promise<MessageCatalog | undefined> {
  let value: unknown
  try {
    value = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const catalog: Record<string, string> = {}
  for (const [key, text] of Object.entries(value))
    if (key !== '$schema' && typeof text === 'string') catalog[key] = text
  return catalog
}

/**
 * Every word a game shows in `lang`, by catalog: `content` (the catalog the content compiled, passed in), `ui` (the
 * game's own interface words) and each of {@link WORD_PACKAGES} that the game can resolve. A catalog the game does not
 * have is left out.
 */
export async function gameWords(
  gameDir: string,
  lang: string,
  content: MessageCatalog,
): Promise<ReadonlyMap<string, MessageCatalog>> {
  const words = new Map<string, MessageCatalog>([['content', content]])
  for (const folder of UI_FOLDERS) {
    const ui = await readCatalog(join(gameDir, folder, `${lang}.json`))
    if (ui === undefined) continue
    words.set('ui', ui)
    break
  }
  for (const name of WORD_PACKAGES) {
    const path = packageWordsFile(gameDir, name, lang)
    const found = path === undefined ? undefined : await readCatalog(path)
    if (found !== undefined) words.set(name, found)
  }
  return words
}
