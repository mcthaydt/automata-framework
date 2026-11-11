import { join, relative } from 'node:path'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { z } from 'zod'
import type { CheckFinding } from '../check/check-report.ts'
import type { CheckToolError } from '../check/csp-probe.ts'
import { Files, type FilesService } from '../node/files.ts'
import {
  type Catalog,
  type CatalogPaths,
  gameCatalogs,
  languagesOnDisk,
  translationProblems,
} from './catalog.ts'
import { fontCoverage, undrawable } from './characters.ts'
import { packageCatalogs } from './package-words.ts'

// The `words` step of `automata check`: every language a game ships has all its words with their `{placeholders}`,
// and the game's fonts can draw every letter of them. There is no model and no network. A game with one language and
// no `content/fonts.toml` (every game before the six languages) and a game with no catalogs have nothing to check.

const SOURCE_LANGUAGE = 'en'
const FONTS_FILE = 'content/fonts.toml'

/** What this step reads of `content/fonts.toml`: the content build owns the rest and refuses a malformed file. */
const fontsSchema = z.object({
  font: z.record(z.string(), z.object({ file: z.string(), locales: z.array(z.string()) })).default({}),
})

const finding = (file: string, rule: 'words-parity' | 'words-font', message: string): CheckFinding => ({
  file,
  line: 0,
  col: 0,
  rule,
  message,
})

const codePoint = (character: string): string =>
  `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')} "${character}"`

/** A catalog file as key to text; undefined when it is not a catalog, which the content build reports in its words. */
function parseCatalog(text: string): Catalog | undefined {
  try {
    const value: unknown = JSON.parse(text)
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    const out: Record<string, string> = {}
    for (const [key, word] of Object.entries(value)) {
      if (key === '$schema') continue
      if (typeof word !== 'string') return undefined
      out[key] = word
    }
    return out
  } catch {
    return undefined
  }
}

/** One catalog's words in one language, or undefined when the language has no file there. */
const readWords = (files: FilesService, path: string): Effect.Effect<Catalog | undefined> =>
  Effect.flatMap(files.exists(path), (there) =>
    there
      ? files.readText(path).pipe(
          Effect.map(parseCatalog),
          Effect.catchAll(() => Effect.succeed(undefined)),
        )
      : Effect.succeed(undefined),
  )

/** The `words` step, in the shape the other steps have. Its only tool is the file system. */
export const wordsStep = (gameDir: string): Effect.Effect<readonly CheckFinding[], CheckToolError, Files> =>
  Effect.gen(function* () {
    const files = yield* Files
    const catalogs = yield* gameCatalogs(gameDir, SOURCE_LANGUAGE)
    if (catalogs.length === 0) return []

    const rel = (path: string): string => relative(gameDir, path).split('\\').join('/')
    const findings: CheckFinding[] = []

    // Each catalog's source words, and every language the game ships in any of its catalogs.
    const sources = new Map<CatalogPaths, Catalog>()
    const languages = new Set<string>([SOURCE_LANGUAGE])
    for (const catalog of catalogs) {
      const source = yield* readWords(files, catalog.source)
      if (source === undefined) continue
      sources.set(catalog, source)
      for (const lang of yield* languagesOnDisk(files, catalog, SOURCE_LANGUAGE)) languages.add(lang)
    }

    // Per language, the words the game shows, for the font check below.
    const shown = new Map<string, Record<string, string>>()
    for (const lang of languages) {
      const words: Record<string, string> = {}
      for (const [catalog, source] of sources) {
        const translated =
          lang === SOURCE_LANGUAGE ? source : yield* readWords(files, catalog.translation(lang))
        const path = rel(catalog.translation(lang))
        if (translated === undefined) {
          findings.push(finding(path, 'words-parity', `${lang} has no ${path}`))
          continue
        }
        if (lang !== SOURCE_LANGUAGE) {
          for (const problem of translationProblems(source, translated))
            findings.push(finding(path, 'words-parity', `${lang} ${problem}`))
          for (const key of Object.keys(source))
            if ((translated[key] ?? '').trim() === '')
              findings.push(finding(path, 'words-parity', `${lang} "${key}" has no translation`))
        }
        for (const [key, text] of Object.entries(translated)) words[`${catalog.name}.${key}`] = text
      }
      // The framework packages' screens are drawn in the same face as the game's own words.
      for (const [name, packageWords] of yield* packageCatalogs(gameDir, lang))
        for (const [key, text] of Object.entries(packageWords)) words[`${name}.${key}`] = text
      shown.set(lang, words)
    }

    // Fonts: only a game with more than one language, or one that already names fonts, has to prove them.
    const fontsPath = join(gameDir, FONTS_FILE)
    const hasFonts = yield* files.exists(fontsPath)
    if (languages.size === 1 && !hasFonts) return findings
    const named = new Map<string, { file: string; locales: readonly string[] }>()
    if (hasFonts) {
      const text = yield* files.readText(fontsPath).pipe(Effect.catchAll(() => Effect.succeed('')))
      const parsed = fontsSchema.safeParse(safeToml(text))
      if (parsed.success) for (const [name, font] of Object.entries(parsed.data.font)) named.set(name, font)
    }
    const coverOf = new Map<string, ((character: string) => boolean) | undefined>()
    for (const [name, font] of named) {
      const bytes = yield* files
        .readBytes(join(gameDir, font.file))
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)))
      let cover: ((character: string) => boolean) | undefined
      try {
        cover = bytes === undefined ? undefined : fontCoverage(bytes)
      } catch {
        cover = undefined
      }
      if (cover === undefined)
        findings.push(finding(FONTS_FILE, 'words-font', `font "${name}" (${font.file}) cannot be read`))
      coverOf.set(name, cover)
    }

    for (const lang of languages) {
      const serving = [...named].filter(([, font]) => font.locales.includes(lang))
      if (serving.length === 0) {
        findings.push(
          finding(FONTS_FILE, 'words-font', `no font is declared for ${lang}: name one in ${FONTS_FILE}`),
        )
        continue
      }
      const covers = serving.flatMap(([name]) => coverOf.get(name) ?? [])
      // A font that could not be read is already a finding; do not also call every letter undrawable.
      if (covers.length < serving.length) continue
      const words = shown.get(lang) ?? {}
      for (const { key, character } of undrawable(words, covers)) {
        const [catalog = '', word = key] = splitKey(key)
        const where = catalogs.find((candidate) => candidate.name === catalog)
        const file = where !== undefined ? rel(where.translation(lang)) : `${catalog}/words/${lang}.json`
        findings.push(
          finding(
            file,
            'words-font',
            `${codePoint(character)} in ${lang} "${word}" is not in any font that serves ${lang}`,
          ),
        )
      }
    }
    return findings
  })

const safeToml = (text: string): unknown => {
  try {
    return parse(text)
  } catch {
    return {}
  }
}

/** `content.play` to `['content', 'play']`: a catalog's name, or a package's, has no dot; a message key may. */
const splitKey = (joined: string): [string, string] => {
  const dot = joined.indexOf('.')
  return [joined.slice(0, dot), joined.slice(dot + 1)]
}
