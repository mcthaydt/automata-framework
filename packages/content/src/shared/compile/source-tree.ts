// The authored tree, as a list of files. Extracted from FloorFifty packages/content/src/read-sources.ts (122a220).
//
// The pure half of reading: given every file under the project (a path such as `content/songs/dusk-run.toml`
// and its text), it decides which files are sources and what an author sees them called, and decides nothing
// about what is in them. It touches no disk, so the editors' phone app runs it on a folder it holds in memory
// and `read-sources.ts` runs it on a folder it read with Effect.
//
// Changed from FloorFifty: the folders and files come from the game's registered schemas instead of a fixed
// list, nested folders give `a/b` IDs, and a file that cannot be read is a diagnostic rather than a throw,
// so check and the dev server keep their recovery path.

import type { Diagnostic } from '../diagnostics/diagnostic'
import { LANGUAGE_TAG } from '../game/game-facts'
import type { SourceFile } from '../parse/parse-document'
import type { ContentSchemaDef } from '../schema/content-schema'

/** The compiler's own documents, keyed by the kind each is stored under in the content data. */
export const BUILT_IN_FILES: Readonly<Record<string, string>> = {
  tuning: 'tuning.toml',
  flow: 'flow.toml',
  palette: 'palette.toml',
  game: 'game.toml',
  assets: 'assets.toml',
}

/** Where translators put `<lang>.json`, below `content/`. */
export const TRANSLATIONS_FOLDER = 'messages'

export interface ItemSource {
  readonly id: string
  readonly source: SourceFile
}

export interface TranslationSource {
  readonly language: string
  readonly source: SourceFile
}

export interface SourceTree {
  /** Each collection kind's items, sorted by file path. */
  readonly collections: ReadonlyMap<string, readonly ItemSource[]>
  /** Each document kind (registered and built-in) to its file, or undefined when there is none. */
  readonly documents: ReadonlyMap<string, SourceFile | undefined>
  /** Sorted by language. */
  readonly translations: readonly TranslationSource[]
  readonly diagnostics: readonly Diagnostic[]
  /** `skippedFile` for each file in a content folder that is not read. They never fail a compile. */
  readonly warnings: readonly Diagnostic[]
}

const ID_SEGMENT = /^[a-z0-9-]+$/

const isSource = (name: string): boolean => name.endsWith('.toml') && !name.endsWith('.toml.example')

/**
 * Files that are meant to be skipped without a word: drafts kept as `.toml.example` and hidden files the
 * operating system or an editor leaves behind (`.DS_Store`, `.dusk-run.toml.swp`). Anything else the
 * compiler skips is most likely a misnamed file (`dusk-run.TOML`), so it gets a warning (audit of PR #8).
 */
const isQuietlySkipped = (name: string): boolean =>
  name.endsWith('.toml.example') || (name.split('/').at(-1) ?? '').startsWith('.')

/** Edits (insert, delete, replace one character) that turn `a` into `b`. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const replace = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      current.push(Math.min(replace, (previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1))
    }
    previous = current
  }
  return previous[b.length] ?? 0
}

/**
 * The document a misnamed file was probably meant to be: the stem before the first dot, ignoring case,
 * is one or two edits from a document's stem (`tunning` → `tuning`, `Game` → `game`, `flow.toml.bak` →
 * `flow`). Two edits catch a doubled or swapped letter without matching unrelated short names.
 */
function nearestDocument(name: string, documents: readonly string[]): string | undefined {
  const stem = (file: string): string => (file.split('.')[0] ?? '').toLowerCase()
  return documents.find((document) => editDistance(stem(name), stem(document)) <= 2)
}

const atFile = (file: string, code: Diagnostic['code'], message: string): Diagnostic => ({
  code,
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

/** The folder the compiler reads, below the project root. */
export const CONTENT_FOLDER = 'content'

/**
 * Whether the file at `relative` (below `content/`) is one the compiler reads: a TOML file, or a translation.
 * Any other file is named in the tree, so a misnamed one is warned about, but its text is never read.
 */
export const isReadFile = (relative: string): boolean =>
  relative.endsWith('.toml') ||
  (relative.startsWith(`${TRANSLATIONS_FOLDER}/`) &&
    relative.endsWith('.json') &&
    !relative.slice(TRANSLATIONS_FOLDER.length + 1).includes('/'))

/**
 * The sources among `files`: every path below `content/` to its text. A path outside `content/` is ignored. The
 * text of a file that is not read (`isReadFile`) may be empty.
 */
export function sourceTreeFrom(
  files: ReadonlyMap<string, string>,
  schemas: readonly ContentSchemaDef[],
): SourceTree {
  const diagnostics: Diagnostic[] = []
  const warnings: Diagnostic[] = []
  const skipped = (relative: string, namedLike: string): void => {
    warnings.push(atFile(`content/${relative}`, 'skippedFile', `this file is not read; ${namedLike}`))
  }

  const prefix = `${CONTENT_FOLDER}/`
  /** Every file below `folder` (below `content/`), as `/`-separated paths relative to it, sorted by code unit. */
  const listOne = (folder: string): string[] => {
    const below = folder === '' ? prefix : `${prefix}${folder}/`
    return [...files.keys()]
      .filter((path) => path.startsWith(below))
      .map((path) => path.slice(below.length))
      .sort()
  }

  const readOne = (relative: string): SourceFile | undefined => {
    const text = files.get(`${prefix}${relative}`)
    // Some Windows editors start UTF-8 files with a byte order mark. It is not content: left in, it makes
    // JSON invalid and moves every line-1 column by one (audit of PR #8).
    return text === undefined ? undefined : { file: `content/${relative}`, text: text.replace(/^\uFEFF/, '') }
  }

  const collections = new Map<string, ItemSource[]>()
  const documents = new Map<string, SourceFile | undefined>()

  for (const [kind, file] of Object.entries(BUILT_IN_FILES)) documents.set(kind, readOne(file))

  for (const { kind, place } of schemas) {
    if ('file' in place) {
      documents.set(kind, readOne(place.file))
      continue
    }
    const items: ItemSource[] = []
    for (const name of listOne(place.folder)) {
      if (!isSource(name)) {
        if (!isQuietlySkipped(name)) skipped(`${place.folder}/${name}`, 'items are named like dusk-run.toml')
        continue
      }
      const id = name.slice(0, -'.toml'.length)
      const relative = `${place.folder}/${name}`
      if (!id.split('/').every((segment) => ID_SEGMENT.test(segment))) {
        diagnostics.push(
          atFile(
            `content/${relative}`,
            'invalidId',
            `${id} is not an ID; name files like dusk-run.toml (${ID_SEGMENT.source} per folder)`,
          ),
        )
        continue
      }
      const source = readOne(relative)
      if (source !== undefined) items.push({ id, source })
    }
    collections.set(kind, items)
  }

  const translations: TranslationSource[] = []
  for (const name of listOne(TRANSLATIONS_FOLDER)) {
    if (name.includes('/') || !name.endsWith('.json')) {
      if (!isQuietlySkipped(name))
        skipped(`${TRANSLATIONS_FOLDER}/${name}`, 'translations are named like fr.json')
      continue
    }
    const language = name.slice(0, -'.json'.length)
    // The file name becomes a language in ruken-fields.json, so it must be a tag, not `FR_fr` or `notes`.
    if (!LANGUAGE_TAG.test(language)) {
      diagnostics.push(
        atFile(
          `content/${TRANSLATIONS_FOLDER}/${name}`,
          'invalidId',
          `${language} is not a language tag; name translations like fr.json or pt-BR.json`,
        ),
      )
      continue
    }
    const source = readOne(`${TRANSLATIONS_FOLDER}/${name}`)
    if (source !== undefined) translations.push({ language, source })
  }

  // A document saved under a slightly wrong name (`tunning.toml`, `Game.toml`, `flow.toml.bak`) would be
  // skipped as if it were absent. Only near misses warn, so a README beside the TOML stays quiet.
  const documentNames = [
    ...Object.values(BUILT_IN_FILES),
    ...schemas.flatMap(({ place }) => ('file' in place && !place.file.includes('/') ? [place.file] : [])),
  ]
  for (const name of listOne('')) {
    if (name.includes('/') || documentNames.includes(name) || isQuietlySkipped(name)) continue
    // Documents are TOML, so only a TOML-ish name (`x.toml`, `x.TOML`, `x.toml.bak`) can be one misnamed.
    if (!name.toLowerCase().includes('.toml')) continue
    const meant = nearestDocument(name, documentNames)
    if (meant !== undefined) skipped(name, `did you mean ${meant}?`)
  }

  return { collections, documents, translations, diagnostics, warnings }
}
