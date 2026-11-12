// The font build. Reads `content/fonts.toml`, checks each committed source against
// its recorded sha256, and cuts it to each language it serves: the language's characters plus the ranges a
// typed name most likely needs (`localeCharacters`).
// Like the atlas build, it returns the outputs and the CLI writes them.
//
// The glyph gate: every character of every message in a language must be in one of that
// language's subsets. A game may stack faces (a Latin face, then a CJK one), so a language
// is covered by all its fonts together. A failure names the message where it is written, from the compile's
// `messageLocations`, and each missing code point. Control characters (a newline) draw nothing and are skipped.
// Every language the content compiles must be served by a font: no language falls back to the device's.
//
// Every word a game shows is cut and checked, not the content's alone: `gameWords` adds the game's own interface
// words and the words of the framework packages it uses, which are drawn in the same face.
//
// A font whose licence reserves its name (`reserved_name`) is renamed `<font> <language>` after the cut, and its licence
// file (`license_file`) is copied beside the subsets. `fonts.css` loads the faces: one `@font-face` per font and
// language, and a `:root:lang()` rule per language that sets the `--af-font` the framework's theme draws in.
//
// Text a kind marks `verbatim()` (a credits name) is in no catalog and is drawn as written in every language, so every
// subset is cut to it too and each language's faces are held to it, reported where the text is written.
//
// The language picker's names. The picker lists every content language by its own name (`endonymOf`, the
// same function ui's `LanguageSection` shows), whichever language the game is showing, so every subset is also cut
// to every content language's name, and the gate holds each language's subsets to the names of the languages the
// fonts serve: a Latin face for `en` beside a Japanese face for `ja` fails until a face serving `en` holds 日本語. A
// name has no place in a content file, so a failure is reported at the language's entry in `locales` of the
// first font (by name) that serves it, where the fix is made.
//
// Every problem is a diagnostic and all of them are reported together. A font that could not be cut leaves its
// languages unchecked, so one broken source is not also reported as every glyph missing.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Effect } from 'effect'
import { type CompiledContent, type ContentOptions, compileContent } from '../compile/compile-content.ts'
import { ContentCompileFailed, type InvalidContentConfig } from '../compile/errors.ts'
import { type Diagnostic, sortDiagnostics } from '../diagnostics/diagnostic.ts'
import { readBytesIfPresent, readTextIfPresent } from '../files/content-files.ts'
import { canonicalFile } from '../hash/canonical-file.ts'
import { endonymOf } from '../locale/endonyms.ts'
import { gameWords, UI_FOLDERS } from '../locale/game-words.ts'
import { localeCharacters } from '../locale/glyphs.ts'
import type { MessageCatalog } from '../locale/messages.ts'
import { diagnosticAt, type ParsedToml, parseDocument } from '../parse/parse-document.ts'
import { FONT_CSS, FONT_FILES } from './asset-outputs.ts'
import { fontCoverage, subsetWoff2 } from './font-subset.ts'
import { type FontSource, fontsSchema } from './fonts.schema.ts'

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
    const shownWords = new Map<string, ReadonlyMap<string, MessageCatalog>>()
    // Every content language's name, as the language picker shows it, goes into every subset: the picker lists
    // them all whichever language the game is showing.
    const names = new Map(content.languages.map((language) => [language, endonymOf(language)]))
    // Text a kind marks `verbatim()` (a credits name) is drawn as written in every language, so it goes into every
    // subset as well, and each language's faces are held to it (`checkVerbatim`).
    const nameCharacters = [...names.values(), ...content.verbatim.map(({ text }) => text)].join('')

    for (const name of Object.keys(fonts.value.font).sort()) {
      const font = fonts.value.font[name] as FontSource
      const locales = knownLocales(fonts.toml, name, font, content, diagnostics)
      for (const locale of locales) served.add(locale)
      const source = yield* readSource(options.root, fonts.toml, name, font, diagnostics)
      if (source === undefined) {
        for (const locale of locales) broken.add(locale)
        continue
      }
      const licence = yield* readLicence(options.root, fonts.toml, name, font, diagnostics)
      if (licence !== undefined) files.set(`${name}-${basename(font.license_file as string)}`, licence)
      for (const locale of locales) {
        const shown = yield* Effect.promise(() => wordsOf(options.root, locale, content))
        const characters = new Set([
          ...[...shown.values()].flatMap((catalog) => [...localeCharacters(catalog)]),
          ...nameCharacters,
        ])
        const rename =
          font.reserved_name === undefined
            ? undefined
            : { family: `${name} ${locale}`, reservedName: font.reserved_name }
        const cut = yield* Effect.either(Effect.tryPromise(() => subsetWoff2(source, characters, rename)))
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
        shownWords.set(locale, shown)
        covered.fonts.push(name)
        covered.covers.push(fontCoverage(cut.right))
        coverage.set(locale, covered)
      }
    }

    for (const [locale, covered] of coverage) {
      if (broken.has(locale)) continue
      checkGlyphs(options.root, content, locale, shownWords.get(locale), covered, diagnostics)
      checkNames(fonts.toml, names, served, locale, covered, diagnostics)
      checkVerbatim(content, locale, covered, diagnostics)
    }

    for (const language of content.languages)
      if (!served.has(language))
        diagnostics.push(atFonts('missingAsset', `no font serves ${language}: add it to a font's locales`))

    if (diagnostics.length > 0) return yield* fail()
    files.set(FONT_CSS, new TextEncoder().encode(fontCss(fonts.value.font, manifest)))
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

/** Where a catalog other than the content's is, for a diagnostic: the game's own file, or the package's. */
function wordsFile(root: string, catalog: string, locale: string): string {
  if (catalog !== 'ui') return `${catalog}/words/${locale}.json`
  return (
    UI_FOLDERS.map((folder) => `${folder}/${locale}.json`).find((file) => existsSync(join(root, file))) ??
    `${UI_FOLDERS[0]}/${locale}.json`
  )
}

/** Every word shown in `locale`: the content's, the game's interface words and its framework packages'. */
const wordsOf = (root: string, locale: string, content: CompiledContent) =>
  gameWords(root, locale, content.catalogs.get(locale) ?? {})

/**
 * Reports each of the language's messages, whichever catalog it is in, with a character none of its subsets holds. A
 * content message is reported where it is written; a word of another catalog at its file, named in the message.
 */
function checkGlyphs(
  root: string,
  content: CompiledContent,
  locale: string,
  shown: ReadonlyMap<string, MessageCatalog> | undefined,
  covered: LocaleCoverage,
  diagnostics: Diagnostic[],
): void {
  const locations = content.messageLocations.get(locale)
  for (const [catalog, words] of shown ?? new Map([['content', content.catalogs.get(locale) ?? {}]])) {
    for (const [key, text] of Object.entries(words)) {
      const missing = missingCharacters(text, covered)
      if (missing.length === 0) continue
      const where =
        catalog === 'content'
          ? (locations?.get(key) ?? { file: FONTS_FILE, line: 1, column: 1 })
          : { file: wordsFile(root, catalog, locale), line: 1, column: 1 }
      const named = catalog === 'content' ? '' : ` (in the ${catalog} words)`
      diagnostics.push({
        code: 'missingGlyph',
        ...where,
        keyPath: key,
        message: `${notInSubset(missing, locale, covered)}${named}`,
      })
    }
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

/**
 * Reports each text a kind marks `verbatim()` (a credits name) with a character none of this language's subsets holds,
 * where it is written. A name is not translated, so every language draws it, in that language's faces.
 */
function checkVerbatim(
  content: CompiledContent,
  locale: string,
  covered: LocaleCoverage,
  diagnostics: Diagnostic[],
): void {
  for (const { text, file, line, column, keyPath } of content.verbatim) {
    const missing = missingCharacters(text, covered)
    if (missing.length === 0) continue
    diagnostics.push({
      code: 'missingGlyph',
      file,
      line,
      column,
      keyPath,
      message: `${notInSubset(missing, locale, covered)} (a name is drawn as written in every language: give ${locale} a font that has these characters in fonts.toml, or change the name)`,
    })
  }
}

/** The licence file a font names, read; reported when it is named and not there. Undefined when none is named. */
const readLicence = (
  root: string,
  toml: ParsedToml,
  name: string,
  font: FontSource,
  diagnostics: Diagnostic[],
) =>
  Effect.gen(function* () {
    if (font.license_file === undefined) return undefined
    const read = yield* Effect.either(readBytesIfPresent(join(root, font.license_file)))
    if (read._tag === 'Right' && read.right !== undefined) return read.right
    const why = read._tag === 'Left' ? `could not be read: ${reason(read.left.cause)}` : 'does not exist'
    diagnostics.push(
      diagnosticAt(toml, 'missingAsset', ['font', name, 'license_file'], `${font.license_file} ${why}`),
    )
    return undefined
  })

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * The stylesheet that loads a game's faces. One `@font-face` for each font and language (family `<font> <language>`,
 * the subset's file, `font-display: block` so a word is never drawn in a stand-in face first), and for each language a
 * `:root:lang()` rule that sets `--af-font` to that language's faces in `fonts.toml` order. The framework's theme draws
 * in `var(--af-font)` and the locale service sets `<html lang>`, so changing language changes face with no code. Nothing
 * names a device or generic family: a language with no face is an error the build already reported.
 */
function fontCss(
  declared: Readonly<Record<string, FontSource>>,
  manifest: Readonly<Record<string, Readonly<Record<string, string>>>>,
): string {
  const faces: string[] = []
  for (const font of Object.keys(manifest).sort(byName)) {
    for (const locale of Object.keys(manifest[font] ?? {}).sort(byName)) {
      faces.push(
        `@font-face {\n  font-family: "${font} ${locale}";\n  src: url("${manifest[font]?.[locale]}") format("woff2");\n  font-display: block;\n}\n`,
      )
    }
  }
  const locales = [...new Set(Object.values(manifest).flatMap((files) => Object.keys(files)))].sort(byName)
  const rules = locales.map((locale) => {
    const families = Object.keys(declared)
      .filter((font) => manifest[font]?.[locale] !== undefined)
      .map((font) => `"${font} ${locale}"`)
    return `:root:lang(${locale}) {\n  --af-font: ${families.join(', ')};\n}\n`
  })
  return `/* Written by \`automata-content assets\` from content/fonts.toml: do not edit. */\n${[...faces, ...rules].join('\n')}`
}
