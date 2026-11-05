// The font build. Reads `content/fonts.toml`, checks each committed source against
// its recorded sha256, and cuts it to each language it serves: the language's characters plus the ranges a
// typed name most likely needs (`localeCharacters`). From FloorFifty
// packages/asset-contract/tools/subset-fonts.ts and the coverage test tests/client/i18n/fonts.test.ts (ac72660).
// Like the atlas build, it returns the outputs and the CLI writes them.
//
// The glyph gate: every character of every message in a language must be in one of that
// language's subsets. A game may stack faces (a Latin face, then a CJK one, as FloorFifty does), so a language
// is covered by all its fonts together. A failure names the message where it is written, from the compile's
// `messageLocations`, and each missing code point. Control characters (a newline) draw nothing and are skipped.
// A language no font serves is not checked: it draws in whatever face the game's CSS names.
//
// The language picker's names. The picker lists every content language by its own name (`endonymOf`, the
// same function ui's `LanguageSection` shows), whichever language the game is showing, so every subset is also cut
// to every content language's name, and the gate holds each language's subsets to the names of the languages the
// fonts serve: a Latin face for `en` beside a Japanese face for `ja` fails until a face serving `en` holds 日本語. A
// name has no place in a content file, so a failure is reported at the language's entry in `locales` of the
// first font (by name) that serves it, where the fix is made. As with messages, a language no font serves is not
// checked, and neither is its name: both draw in the game's own CSS face.
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
import { endonymOf } from '../locale/endonyms'
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

/** A language's subsets: which fonts cut it, what they hold together, and its entry in the first one's `locales`. */
interface LocaleCoverage {
  readonly fonts: string[]
  readonly covers: ((character: string) => boolean)[]
  readonly at: readonly (string | number)[]
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
    const served = new Set<string>()
    // Every content language's name, as the language picker shows it, goes into every subset: the picker lists
    // them all whichever language the game is showing.
    const names = new Map(content.languages.map((language) => [language, endonymOf(language)]))
    const nameCharacters = [...names.values()].join('')

    for (const name of Object.keys(fonts.value.font).sort()) {
      const font = fonts.value.font[name] as FontSource
      const locales = knownLocales(fonts.toml, name, font, content, diagnostics)
      for (const locale of locales) served.add(locale)
      const source = yield* readSource(options.root, fonts.toml, name, font, diagnostics)
      if (source === undefined) {
        for (const locale of locales) broken.add(locale)
        continue
      }
      for (const locale of locales) {
        const characters = new Set([
          ...localeCharacters(content.catalogs.get(locale) ?? {}),
          ...nameCharacters,
        ])
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
        const at = ['font', name, 'locales', font.locales.indexOf(locale)]
        const covered = coverage.get(locale) ?? { fonts: [], covers: [], at }
        covered.fonts.push(name)
        covered.covers.push(fontCoverage(cut.right))
        coverage.set(locale, covered)
      }
    }

    for (const [locale, covered] of coverage) {
      if (broken.has(locale)) continue
      checkGlyphs(content, locale, covered, diagnostics)
      checkNames(fonts.toml, names, served, locale, covered, diagnostics)
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

/** The text's characters, each once, that none of the language's subsets holds; control characters draw nothing. */
function missingCharacters(text: string, covered: LocaleCoverage): string[] {
  // `for…of` over a string walks code points, so a character outside the BMP is one character.
  return [...new Set(text)].filter(
    (character) => !CONTROL.test(character) && !covered.covers.some((covers) => covers(character)),
  )
}

/** `U+65E5 "日" is not in the fr subset of cjk or pixel`. */
function notInSubset(missing: readonly string[], locale: string, covered: LocaleCoverage): string {
  const verb = missing.length === 1 ? 'is' : 'are'
  const fonts = [...covered.fonts].sort().join(' or ')
  return `${missing.map(codePoint).join(', ')} ${verb} not in the ${locale} subset of ${fonts}`
}

/** Reports each of the language's messages with a character none of its subsets holds. */
function checkGlyphs(
  content: CompiledContent,
  locale: string,
  covered: LocaleCoverage,
  diagnostics: Diagnostic[],
): void {
  const catalog = content.catalogs.get(locale) ?? {}
  const locations = content.messageLocations.get(locale)
  for (const [key, text] of Object.entries(catalog)) {
    const missing = missingCharacters(text, covered)
    if (missing.length === 0) continue
    const where = locations?.get(key) ?? { file: FONTS_FILE, line: 1, column: 1 }
    diagnostics.push({
      code: 'missingGlyph',
      ...where,
      keyPath: key,
      message: notInSubset(missing, locale, covered),
    })
  }
}

/**
 * Reports each served language whose name (as the language picker shows it) has a character none of this
 * language's subsets holds, at this language's entry in its first font's `locales`.
 */
function checkNames(
  toml: ParsedToml,
  names: ReadonlyMap<string, string>,
  served: ReadonlySet<string>,
  locale: string,
  covered: LocaleCoverage,
  diagnostics: Diagnostic[],
): void {
  for (const [language, name] of names) {
    if (!served.has(language)) continue
    const missing = missingCharacters(name, covered)
    if (missing.length === 0) continue
    const message = `${notInSubset(missing, locale, covered)} (the language picker names ${language} ${name})`
    diagnostics.push(diagnosticAt(toml, 'missingGlyph', covered.at, message))
  }
}
