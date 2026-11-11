import { basename, join } from 'node:path'
import { Effect } from 'effect'
import { Files } from '../node/files.ts'

// A game's words are message catalogs: flat `key -> text` JSON in the inlang message format, with a `{name}` slot
// wherever the text needs a name or a number. What `automata words` and `automata check` share about them lives
// here, with no model and no network.

/** The schema line every catalog file starts with. */
export const CATALOG_SCHEMA = 'https://inlang.com/schema/inlang-message-format'

/** A catalog without its `$schema` line: key to text. */
export type Catalog = Readonly<Record<string, string>>

/** Where one catalog's files are, whatever its layout. */
export interface CatalogPaths {
  /** `content`, `ui`, or a folder's own name; the key of the catalog in the record. */
  readonly name: string
  /** The source-language file. */
  readonly source: string
  /** The notes file for the translator, when the catalog has one. */
  readonly context: string | undefined
  /** The file of one language's translation. */
  readonly translation: (lang: string) => string
  /** The file that records which source each translation was made from. */
  readonly record: string
}

/**
 * The `{name}` slots in a text, sorted and once each. A `\{` is not one: the content compiler reads it as a literal
 * brace.
 */
export function placeholders(text: string): string[] {
  const names = new Set<string>()
  for (const match of text.matchAll(/(?<!\\)\{(\w+)\}/g)) names.add(match[1] ?? '')
  return [...names].sort()
}

const show = (names: readonly string[]): string =>
  names.length === 0 ? 'none' : names.map((n) => `{${n}}`).join(', ')

/**
 * What is wrong with a translation: a key the source does not have, or slots that differ from the source's. A key with
 * no translation (or an empty one) is not a problem here: that is "missing", which `wordsState` counts.
 */
export function translationProblems(source: Catalog, translated: Catalog): string[] {
  const problems: string[] = []
  for (const [key, text] of Object.entries(translated)) {
    const original = source[key]
    if (original === undefined) {
      problems.push(`${key}: not a source key`)
      continue
    }
    if (text.trim() === '') continue
    const want = placeholders(original)
    const have = placeholders(text)
    if (want.join(' ') !== have.join(' '))
      problems.push(`${key}: placeholders (${show(have)}) are not ${show(want)}`)
  }
  return problems
}

/** One folder as a catalog: `<dir>/<lang>.json`, `<dir>/context.json`, and the record `<dir>/sources.json`. */
export function folderCatalog(dir: string, sourceLanguage: string): CatalogPaths {
  return {
    name: basename(dir),
    source: join(dir, `${sourceLanguage}.json`),
    context: join(dir, 'context.json'),
    translation: (lang) => join(dir, `${lang}.json`),
    record: join(dir, 'sources.json'),
  }
}

/** Where a game keeps its interface words: `messages/ui`, or `src/messages/ui` when the game's source lives there. */
const UI_FOLDERS = ['messages/ui', 'src/messages/ui'] as const

/**
 * A game's catalogs. `content` is the words its content compiles to (the source in `content/generated/messages`, each
 * translation in `content/messages`), found when the source file exists. `ui` is the interface words, in the first of
 * `messages/ui` and `src/messages/ui` that holds the source language's file. Both are recorded in the game's one
 * `words-sources.json` at its root, never inside `content/messages`, where the content compiler would read it as a
 * translation.
 */
export function gameCatalogs(
  gameDir: string,
  sourceLanguage: string,
): Effect.Effect<readonly CatalogPaths[], never, Files> {
  return Effect.gen(function* () {
    const files = yield* Files
    const record = join(gameDir, 'words-sources.json')
    const found: CatalogPaths[] = []
    const contentSource = join(gameDir, 'content/generated/messages', `${sourceLanguage}.json`)
    if (yield* files.exists(contentSource)) {
      found.push({
        name: 'content',
        source: contentSource,
        context: undefined,
        translation: (lang) => join(gameDir, 'content/messages', `${lang}.json`),
        record,
      })
    }
    for (const folder of UI_FOLDERS) {
      const dir = join(gameDir, folder)
      if (!(yield* files.exists(join(dir, `${sourceLanguage}.json`)))) continue
      found.push({ ...folderCatalog(dir, sourceLanguage), name: 'ui', record })
      break
    }
    return found
  })
}
