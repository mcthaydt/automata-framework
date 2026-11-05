// The files the asset build made for the atlases and fonts a screen names in `assets.toml` (M5 spec §4.7,
// M5.6F.2), as paths in the game's build.
//
// The names are checked against `content/atlases.toml` and `content/fonts.toml`, read with their own schemas.
// Which files exist comes from the asset build's committed outputs below `outDir`, as `automata-content assets`
// wrote them (`asset-outputs.ts` names the folders and files): an atlas's pages, and `fonts.json`, the map from
// each font and language to its subset. Reading those outputs, rather than packing the atlases and cutting the
// fonts again, keeps the preload list as cheap as it was; a stale output is `check --verify-artifact`'s to catch
// (M5.6F.1).
//
// Nothing here fails: a name that cannot be resolved says why, and a broken declaration or `fonts.json` is a
// diagnostic on that file. A name the broken file would have resolved is then left out, already reported, so
// one broken file is not also reported once for every screen that names something in it.

import { join, posix } from 'node:path'
import { Effect } from 'effect'
import type { z } from 'zod'
import type { Diagnostic, DiagnosticCode } from '../../shared/diagnostics/diagnostic'
import { listFiles, readTextIfPresent } from '../../shared/files/content-files'
import { ATLASES_FOLDER, atlasPageFiles, FONT_FILES, FONTS_FOLDER } from '../assets/asset-outputs'
import { atlasesSchema } from '../assets/atlases.schema'
import { type FontFiles, fontFilesSchema, fontsSchema } from '../assets/fonts.schema'
import { parseDocument } from '../parse/parse-document'

/** One atlas or font a screen names: its files in the build, in order, or why it has none. */
type Resolved =
  | { readonly files: readonly string[] }
  | { readonly code: DiagnosticCode; readonly message: string }

/** Resolves a screen's atlas or font name; undefined when the file that declares it is broken (reported). */
type Resolve = (name: string) => Resolved | undefined

export interface AssetBuildFiles {
  readonly atlas: Resolve
  readonly font: Resolve
  /** A broken `atlases.toml`, `fonts.toml` or `fonts.json`, each placed in its own file. */
  readonly diagnostics: readonly Diagnostic[]
}

const ATLASES_FILE = 'content/atlases.toml'
const FONTS_FILE = 'content/fonts.toml'
const RUN_ASSETS = 'run automata-content assets'

const atFile = (file: string, code: DiagnosticCode, message: string): Diagnostic => ({
  code,
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

const reason = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

/**
 * The names a declarations file gives, or undefined when it is broken. An absent file declares nothing.
 */
const declaredNames = <T>(
  root: string,
  file: string,
  schema: z.ZodType<T>,
  namesOf: (value: T) => Readonly<Record<string, unknown>>,
  diagnostics: Diagnostic[],
) =>
  Effect.gen(function* () {
    const read = yield* Effect.either(readTextIfPresent(join(root, file)))
    if (read._tag === 'Left') {
      diagnostics.push(atFile(file, 'missingAsset', `could not be read: ${reason(read.left.cause)}`))
      return undefined
    }
    if (read.right === undefined) return new Set<string>()
    const parsed = parseDocument({ file, text: read.right }, schema)
    if (!parsed.ok) {
      diagnostics.push(...parsed.diagnostics)
      return undefined
    }
    return new Set(Object.keys(namesOf(parsed.value)))
  })

/** `fonts.json` below `outDir`, empty when the font build has not written it, or undefined when it is broken. */
const builtFontFiles = (root: string, file: string, diagnostics: Diagnostic[]) =>
  Effect.gen(function* () {
    const broken = (why: string) => {
      diagnostics.push(atFile(file, 'invalidAsset', why))
      return undefined
    }
    const read = yield* Effect.either(readTextIfPresent(join(root, file)))
    if (read._tag === 'Left') return broken(`could not be read: ${reason(read.left.cause)}`)
    if (read.right === undefined) return {} satisfies FontFiles
    let json: unknown
    try {
      json = JSON.parse(read.right)
    } catch {
      json = undefined
    }
    const parsed = fontFilesSchema.safeParse(json)
    if (!parsed.success) return broken(`is not the map automata-content assets writes; ${RUN_ASSETS}`)
    return parsed.data
  })

/**
 * Reads what the preload list needs to resolve atlas names (when `needs.atlases`) and font names (when
 * `needs.fonts`); nothing is read for the other. `outDir` is the content options' output folder, relative to
 * `root`.
 */
export const readAssetBuildFiles = (
  root: string,
  outDir: string,
  needs: { readonly atlases: boolean; readonly fonts: boolean },
): Effect.Effect<AssetBuildFiles> =>
  Effect.gen(function* () {
    const diagnostics: Diagnostic[] = []

    const atlasesFolder = posix.join(outDir, ATLASES_FOLDER)
    const atlases = needs.atlases
      ? yield* declaredNames(root, ATLASES_FILE, atlasesSchema, (file) => file.atlas, diagnostics)
      : new Set<string>()
    // An output folder that cannot be listed holds no pages for the preload list: each atlas is then reported
    // as not built.
    const builtPages = new Set(
      needs.atlases
        ? yield* listFiles(join(root, atlasesFolder)).pipe(Effect.orElseSucceed((): string[] => []))
        : [],
    )

    const fontFilesPath = posix.join(outDir, FONTS_FOLDER, FONT_FILES)
    const fonts = needs.fonts
      ? yield* declaredNames(root, FONTS_FILE, fontsSchema, (file) => file.font, diagnostics)
      : new Set<string>()
    const fontFiles =
      needs.fonts && fonts !== undefined ? yield* builtFontFiles(root, fontFilesPath, diagnostics) : {}

    const atlas: Resolve = (name) => {
      if (atlases === undefined) return undefined
      if (!atlases.has(name)) {
        return { code: 'unknownReference', message: `${name} is not an atlas in ${ATLASES_FILE}` }
      }
      // Pages count from 0, and an atlas has as many as the build wrote: probe until a page has neither file.
      const files: string[] = []
      for (let page = 0; ; page++) {
        const { json, image } = atlasPageFiles(name, page)
        if (!builtPages.has(json) && !builtPages.has(image)) break
        files.push(`${ATLASES_FOLDER}/${json}`, `${ATLASES_FOLDER}/${image}`)
      }
      if (files.length === 0) {
        return {
          code: 'missingAsset',
          message: `atlas ${name} has no pages in ${atlasesFolder}; ${RUN_ASSETS}`,
        }
      }
      return { files }
    }

    const font: Resolve = (name) => {
      if (fonts === undefined || fontFiles === undefined) return undefined
      if (!fonts.has(name))
        return { code: 'unknownReference', message: `${name} is not a font in ${FONTS_FILE}` }
      const subsets = fontFiles[name] ?? {}
      // The preload list is fixed before the player picks a language, so it holds every language's subset.
      const locales = Object.keys(subsets).sort()
      if (locales.length === 0) {
        return {
          code: 'missingAsset',
          message: `font ${name} has no subsets in ${fontFilesPath}; ${RUN_ASSETS}`,
        }
      }
      return { files: locales.map((locale) => `${FONTS_FOLDER}/${subsets[locale]}`) }
    }

    return { atlas, font, diagnostics }
  })
