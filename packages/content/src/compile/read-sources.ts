// Reading the authored tree. Extracted from FloorFifty packages/content/src/read-sources.ts (122a220).
//
// The only compile step that touches the disk. It decides which files are sources and what an author sees
// them called; it decides nothing about what is in them. Every file is labelled `content/...`, the path an
// author has open, so a fixture tree in a temp folder reports exactly what the real tree would.
//
// Changed from FloorFifty: the folders and files come from the game's registered schemas instead of a fixed
// list, nested folders give `a/b` IDs, and a file that cannot be read is a diagnostic rather than a throw,
// so check and the dev server keep their recovery path.

import { join } from 'node:path'
import { Effect } from 'effect'
import type { Diagnostic } from '../diagnostics/diagnostic'
import { listFiles, readTextIfPresent } from '../files/content-files'
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

const atFile = (file: string, code: Diagnostic['code'], message: string): Diagnostic => ({
  code,
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

const reason = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

export const readSources = (root: string, schemas: readonly ContentSchemaDef[]): Effect.Effect<SourceTree> =>
  Effect.gen(function* () {
    const contentRoot = join(root, 'content')
    const diagnostics: Diagnostic[] = []
    const warnings: Diagnostic[] = []
    const skipped = (relative: string, namedLike: string): void => {
      warnings.push(atFile(`content/${relative}`, 'skippedFile', `this file is not read; ${namedLike}`))
    }

    const readOne = (relative: string): Effect.Effect<SourceFile | undefined> => {
      const file = `content/${relative}`
      return readTextIfPresent(join(contentRoot, relative)).pipe(
        Effect.map((text) => (text === undefined ? undefined : { file, text })),
        Effect.catchAll((error) => {
          diagnostics.push(
            atFile(file, 'missingField', `this file could not be read: ${reason(error.cause)}`),
          )
          return Effect.succeed(undefined)
        }),
      )
    }

    const listOne = (folder: string): Effect.Effect<string[]> =>
      listFiles(join(contentRoot, folder)).pipe(
        Effect.catchAll((error) => {
          diagnostics.push(
            atFile(
              `content/${folder}`,
              'missingField',
              `this folder could not be read: ${reason(error.cause)}`,
            ),
          )
          return Effect.succeed([])
        }),
      )

    const collections = new Map<string, ItemSource[]>()
    const documents = new Map<string, SourceFile | undefined>()

    for (const [kind, file] of Object.entries(BUILT_IN_FILES)) documents.set(kind, yield* readOne(file))

    for (const { kind, place } of schemas) {
      if ('file' in place) {
        documents.set(kind, yield* readOne(place.file))
        continue
      }
      const items: ItemSource[] = []
      for (const name of yield* listOne(place.folder)) {
        if (!isSource(name)) {
          if (!isQuietlySkipped(name))
            skipped(`${place.folder}/${name}`, 'items are named like dusk-run.toml')
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
        const source = yield* readOne(relative)
        if (source !== undefined) items.push({ id, source })
      }
      collections.set(kind, items)
    }

    const translations: TranslationSource[] = []
    for (const name of yield* listOne(TRANSLATIONS_FOLDER)) {
      if (name.includes('/') || !name.endsWith('.json')) {
        if (!isQuietlySkipped(name))
          skipped(`${TRANSLATIONS_FOLDER}/${name}`, 'translations are named like fr.json')
        continue
      }
      const source = yield* readOne(`${TRANSLATIONS_FOLDER}/${name}`)
      if (source !== undefined) translations.push({ language: name.slice(0, -'.json'.length), source })
    }

    return { collections, documents, translations, diagnostics, warnings }
  })
