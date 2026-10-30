// The font build (M5 spec §4.7 Fonts, M5-D7). Reads `content/fonts.toml`, checks each committed source against
// its recorded sha256, and cuts it to each language it serves: the language's characters plus the ranges a
// typed name most likely needs (`localeCharacters`, PRODUCT.L2). From FloorFifty
// packages/asset-contract/tools/subset-fonts.ts and the coverage test tests/client/i18n/fonts.test.ts (ac72660).
// Like the atlas build, it returns the outputs and the CLI writes them.
//
// The glyph gate (G-b, PRODUCT.L's L-e): every character of every message in a language must be in one of that
// language's subsets. A game may stack faces (a Latin face, then a CJK one, as FloorFifty does), so a language
// is covered by all its fonts together. A failure names the message where it is written, from the compile's
// `messageLocations`, and each missing code point. Control characters (a newline) draw nothing and are skipped.
// A language no font serves is not checked: it draws in whatever face the game's CSS names.
//
// Every problem is a diagnostic and all of them are reported together. A font that could not be cut leaves its
// languages unchecked, so one broken source is not also reported as every glyph missing.
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { Effect } from 'effect'
import { type CompiledContent, type ContentOptions, compileContent } from '../compile/compile-content'
import { ContentCompileFailed, type InvalidContentConfig } from '../compile/errors'
import { type Diagnostic, sortDiagnostics } from '../diagnostics/diagnostic'
import { readBytesIfPresent, readTextIfPresent } from '../files/content-files'
import { canonicalFile } from '../hash/canonical-file'
import { localeCharacters } from '../locale/glyphs'
import { diagnosticAt, type ParsedToml, parseDocument } from '../parse/parse-document'
import { FONT_FILES } from './asset-outputs'
import { fontCoverage, subsetWoff2 } from './font-subset'
import { type FontSource, fontsSchema } from './fonts.schema'

/** What `buildFonts` produces; the caller writes it. */
export interface FontOutputs {
  /** `<font>-<locale>-<hash8>.woff2` and `fonts.json` (`{ font: { locale: file } }`), sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>
}

const FONTS_FILE = 'content/fonts.toml'
const CONTROL = /\p{Cc}/u

const reason = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const codePoint = (character: string): string =>
  `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')} "${character}"`

/** A language's subsets: which fonts cut it, and what they hold together. */
interface LocaleCoverage {
  readonly fonts: string[]
  readonly covers: ((character: string) => boolean)[]
}

/**
 * Builds every subset `<root>/content/fonts.toml` names, or fails with every problem found. Without the file
 * there is nothing to build, and the content is not compiled.
 */
export const buildFonts = (
  options: ContentOptions,
): Effect.Effect<FontOutputs, ContentCompileFailed | InvalidContentConfig> =>
  Effect.gen(function* () {
    const diagnostics: Diagnostic[] = []
    const fail = () => Effect.fail(new ContentCompileFailed({ diagnostics: sortDiagnostics(diagnostics) }))
    const atFonts = (code: Diagnostic['code'], message: string): Diagnostic => ({
      code,
      file: FONTS_FILE,
      line: 1,
      column: 1,
      keyPath: '',
      message,
    })

    const read = yield* Effect.either(readTextIfPresent(join(options.root, FONTS_FILE)))
    if (read._tag === 'Left') {
      diagnostics.push(atFonts('missingAsset', `could not be read: ${reason(read.left.cause)}`))
      return yield* fail()
    }
    if (read.right === undefined) return { files: new Map() }
    const fonts = parseDocument({ file: FONTS_FILE, text: read.right }, fontsSchema)
    if (!fonts.ok) {
      diagnostics.push(...fonts.diagnostics)
      return yield* fail()
    }

    const content = yield* compileContent(options)
    const files = new Map<string, Uint8Array>()
    const manifest: Record<string, Record<string, string>> = {}
    const coverage = new Map<string, LocaleCoverage>()
    const broken = new Set<string>()

    for (const name of Object.keys(fonts.value.font).sort()) {
      const font = fonts.value.font[name] as FontSource
      const locales = knownLocales(fonts.toml, name, font, content, diagnostics)
      const source = yield* readSource(options.root, fonts.toml, name, font, diagnostics)
      if (source === undefined) {
        for (const locale of locales) broken.add(locale)
        continue
      }
      for (const locale of locales) {
        const characters = localeCharacters(content.catalogs.get(locale) ?? {})
        const cut = yield* Effect.either(Effect.tryPromise(() => subsetWoff2(source, characters)))
        if (cut._tag === 'Left') {
          const why = reason(cut.left.cause)
          diagnostics.push(
            diagnosticAt(
              fonts.toml,
              'invalidAsset',
              ['font', name, 'file'],
              `${font.file} could not be subset: ${why}`,
            ),
          )
          broken.add(locale)
          continue
        }
        const file = `${name}-${locale}-${sha256(cut.right).slice(0, 8)}.woff2`
        files.set(file, cut.right)
        manifest[name] = { ...manifest[name], [locale]: file }
        const covered = coverage.get(locale) ?? { fonts: [], covers: [] }
        covered.fonts.push(name)
        covered.covers.push(fontCoverage(cut.right))
        coverage.set(locale, covered)
      }
    }

    for (const [locale, covered] of coverage) {
      if (!broken.has(locale)) checkGlyphs(content, locale, covered, diagnostics)
    }

    if (diagnostics.length > 0) return yield* fail()
    files.set(FONT_FILES, new TextEncoder().encode(canonicalFile(manifest)))
    return { files: new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) }
  })

/** The font's languages the content compiles; each other one is reported at its place in `locales`. */
function knownLocales(
  toml: ParsedToml,
  name: string,
  font: FontSource,
  content: CompiledContent,
  diagnostics: Diagnostic[],
): string[] {
  return font.locales.filter((locale, index) => {
    if (content.catalogs.has(locale)) return true
    const languages = content.languages.join(', ')
    diagnostics.push(
      diagnosticAt(
        toml,
        'unknownReference',
        ['font', name, 'locales', index],
        `${locale} is not a content language (${languages})`,
      ),
    )
    return false
  })
}

/** The source's bytes when they are there and match the recorded sha256; otherwise reported, and undefined. */
const readSource = (
  root: string,
  toml: ParsedToml,
  name: string,
  font: FontSource,
  diagnostics: Diagnostic[],
) =>
  Effect.gen(function* () {
    const read = yield* Effect.either(readBytesIfPresent(join(root, font.file)))
    if (read._tag === 'Left' || read.right === undefined) {
      const why = read._tag === 'Left' ? `could not be read: ${reason(read.left.cause)}` : 'does not exist'
      diagnostics.push(diagnosticAt(toml, 'missingAsset', ['font', name, 'file'], `${font.file} ${why}`))
      return undefined
    }
    const actual = sha256(read.right)
    if (actual !== font.sha256) {
      const message = `${font.file} has sha256 ${actual}, not the recorded ${font.sha256}`
      diagnostics.push(diagnosticAt(toml, 'invalidAsset', ['font', name, 'sha256'], message))
      return undefined
    }
    return read.right
  })

/** Reports each of the language's messages with a character none of its subsets holds. */
function checkGlyphs(
  content: CompiledContent,
  locale: string,
  covered: LocaleCoverage,
  diagnostics: Diagnostic[],
): void {
  const catalog = content.catalogs.get(locale) ?? {}
  const locations = content.messageLocations.get(locale)
  const fonts = [...covered.fonts].sort().join(' or ')
  for (const [key, text] of Object.entries(catalog)) {
    // `for…of` over a string walks code points, so a character outside the BMP is one character.
    const missing = [...new Set(text)].filter(
      (character) => !CONTROL.test(character) && !covered.covers.some((covers) => covers(character)),
    )
    if (missing.length === 0) continue
    const where = locations?.get(key) ?? { file: FONTS_FILE, line: 1, column: 1 }
    const verb = missing.length === 1 ? 'is' : 'are'
    diagnostics.push({
      code: 'missingGlyph',
      ...where,
      keyPath: key,
      message: `${missing.map(codePoint).join(', ')} ${verb} not in the ${locale} subset of ${fonts}`,
    })
  }
}
