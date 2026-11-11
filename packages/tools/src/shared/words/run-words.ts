import { Effect } from 'effect'
import type { FileError } from '../node/errors.ts'
import { Files, type FilesService } from '../node/files.ts'
import { ShipConfigLoader } from '../node/ship-config-loader.ts'
import {
  CATALOG_SCHEMA,
  type Catalog,
  type CatalogPaths,
  folderCatalog,
  gameCatalogs,
  languagesOnDisk,
  translationProblems,
} from './catalog.ts'
import { DEFAULT_LANGUAGES } from './default-languages.ts'
import { type SourcesFile, sourceHash, sourcesFileSchema, wordsState } from './sources.ts'
import type { WordsOptions } from './words-args.ts'
import { WordsModel, type WordsModelUnavailable } from './words-model.ts'

// `automata words`: an AI translates what is missing or stale into every language the game ships. This is the run, over
// the `Files`, `WordsModel` and `ShipConfigLoader` services, so a test drives it with fakes and no network.

/** Where the run writes: its report and its problems. The command line's `CliIo` is one. */
export interface WordsIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

const NO_KEY =
  'automata words needs ANTHROPIC_API_KEY set on this computer to reach the translator; nothing was changed.\n'

/** What a missed word costs, by where it lives: the report says it so the author knows how urgent it is. */
const COST_OF_A_MISS: Readonly<Record<string, string>> = {
  content: 'the content build fails on a missing word',
}
const PLAYER_SEES_ENGLISH = 'the player sees the English word'

/** A problem with the input, not with a word: the run stops and exits 2. */
class Problem extends Error {}

type Needs = Files | WordsModel | ShipConfigLoader

const fileProblem = (error: FileError): Problem => new Problem(error.message)

const readJson = (files: FilesService, path: string): Effect.Effect<unknown, Problem> =>
  files.readText(path).pipe(
    Effect.mapError(fileProblem),
    Effect.flatMap((text) =>
      Effect.try({
        try: () => JSON.parse(text) as unknown,
        catch: () => new Problem(`${path} is not valid JSON`),
      }),
    ),
  )

/** A catalog file as key to text, without `$schema`; a value that is not text is a problem. */
function toCatalog(path: string, value: unknown): Effect.Effect<Catalog, Problem> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return Effect.fail(new Problem(`${path} is not a message catalog (an object of key to text)`))
  }
  const out: Record<string, string> = {}
  for (const [key, text] of Object.entries(value)) {
    if (key === '$schema') continue
    if (typeof text !== 'string') return Effect.fail(new Problem(`${path}: "${key}" is not text`))
    out[key] = text
  }
  return Effect.succeed(out)
}

const readCatalog = (files: FilesService, path: string): Effect.Effect<Catalog, Problem> =>
  Effect.flatMap(readJson(files, path), (value) => toCatalog(path, value))

/** The edit distance between two keys, for suggesting the nearest when one is mistyped. */
function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        (row[j] ?? 0) + 1,
        (next[j - 1] ?? 0) + 1,
        (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    row = next
  }
  return row[b.length] ?? 0
}

const nearest = (key: string, known: readonly string[]): string[] =>
  [...known].sort((a, b) => distance(key, a) - distance(key, b)).slice(0, 3)

/** Two-space JSON with a final newline, keys sorted so a record's diff shows only what changed. */
function sortedJson(value: unknown): string {
  const sort = (node: unknown): unknown =>
    node !== null && typeof node === 'object' && !Array.isArray(node)
      ? Object.fromEntries(
          Object.entries(node)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, child]) => [key, sort(child)]),
        )
      : node
  return `${JSON.stringify(sort(value), null, 2)}\n`
}

interface Setup {
  readonly catalogs: readonly CatalogPaths[]
  readonly languages: readonly string[]
  /** The model `ship.config.ts` asks for (`words.model`), when the game has one. */
  readonly model: string | undefined
}

/** The catalogs to work on and the languages to translate them into. */
function setupFor(options: WordsOptions): Effect.Effect<Setup, Problem, Files | ShipConfigLoader> {
  return Effect.gen(function* () {
    const files = yield* Files
    if (options.catalog !== undefined) {
      const languages =
        options.to !== undefined ? [options.to] : DEFAULT_LANGUAGES.filter((lang) => lang !== options.source)
      return { catalogs: [folderCatalog(options.catalog, options.source)], languages, model: undefined }
    }
    const catalogs = yield* gameCatalogs(options.dir, options.source)
    if (catalogs.length === 0) {
      return yield* Effect.fail(
        new Problem(
          `no words found in ${options.dir}: expected messages/ui/${options.source}.json or content/generated/messages/${options.source}.json`,
        ),
      )
    }
    const loader = yield* ShipConfigLoader
    const config = yield* loader
      .load(options.dir)
      .pipe(Effect.mapError((error) => new Problem(error.message)))
    if (options.to !== undefined) return { catalogs, languages: [options.to], model: config.words?.model }
    const found = new Set<string>(config.content.languages)
    for (const catalog of catalogs)
      for (const lang of yield* languagesOnDisk(files, catalog, options.source)) found.add(lang)
    found.delete(options.source)
    return { catalogs, languages: [...found], model: config.words?.model }
  })
}

/** One language's tally across the catalogs. */
interface Tally {
  translated: number
  failed: number
  recorded: number
  costs: Set<string>
}

/** Runs `automata words`. Exit 0: done, or nothing to do. 1: some words could not be translated. 2: a problem with the input, or no key. */
export function runWords(options: WordsOptions, io: WordsIo): Effect.Effect<number, never, Needs> {
  const program = Effect.gen(function* () {
    const files = yield* Files
    const model = yield* WordsModel
    // Before any file is read: a translation run with no way to translate changes nothing.
    if (!options.mark) {
      const reachable = yield* Effect.either(model.check())
      if (reachable._tag === 'Left') {
        const reason = (reachable.left as WordsModelUnavailable).reason
        if (reason === 'no-key') {
          io.stderr(NO_KEY)
          return 2
        }
        return yield* Effect.fail(new Problem(reachable.left.message))
      }
    }

    const { catalogs, languages, model: configuredModel } = yield* setupFor(options)
    const sources = new Map<string, Catalog>()
    for (const catalog of catalogs) sources.set(catalog.name, yield* readCatalog(files, catalog.source))

    if (options.key !== undefined) {
      const known = [...sources.values()].flatMap((source) => Object.keys(source))
      if (!known.includes(options.key)) {
        return yield* Effect.fail(
          new Problem(`unknown key "${options.key}". Nearest: ${nearest(options.key, known).join(', ')}`),
        )
      }
    }

    // One record file per game (or per folder): read once, written once.
    const records = new Map<string, SourcesFile>()
    const dirty = new Set<string>()
    for (const catalog of catalogs) {
      if (records.has(catalog.record)) continue
      const parsed = (yield* files.exists(catalog.record))
        ? sourcesFileSchema.safeParse(yield* readJson(files, catalog.record))
        : { success: true as const, data: {} as SourcesFile }
      if (!parsed.success)
        return yield* Effect.fail(new Problem(`${catalog.record} is not a record of sources`))
      records.set(catalog.record, parsed.data)
    }

    const tallies = new Map<string, Tally>(
      languages.map((lang) => [lang, { translated: 0, failed: 0, recorded: 0, costs: new Set() }]),
    )
    const tally = (lang: string): Tally => tallies.get(lang) as Tally

    for (const catalog of catalogs) {
      const source = sources.get(catalog.name) as Catalog
      const sourceKeys = Object.keys(source)
      const notes =
        catalog.context !== undefined && (yield* files.exists(catalog.context))
          ? ((yield* readJson(files, catalog.context)) as Record<string, { note?: string }>)
          : {}
      for (const lang of languages) {
        const path = catalog.translation(lang)
        const onDisk = (yield* files.exists(path)) ? yield* readCatalog(files, path) : undefined
        const translated: Record<string, string> = { ...(onDisk ?? {}) }
        const file = records.get(catalog.record) as SourcesFile
        const record: Record<string, string> = { ...(file[catalog.name]?.[lang] ?? {}) }

        if (options.mark) {
          let recorded = 0
          for (const key of sourceKeys) {
            const text = translated[key]
            if (text === undefined || text.trim() === '') continue
            const hash = sourceHash(source[key] as string)
            if (record[key] !== hash) recorded += 1
            record[key] = hash
          }
          if (recorded > 0) {
            tally(lang).recorded += recorded
            records.set(catalog.record, {
              ...file,
              [catalog.name]: { ...file[catalog.name], [lang]: record },
            })
            dirty.add(catalog.record)
          }
          continue
        }

        const state = wordsState(source, translated, record)
        const wanted = new Set(
          options.key !== undefined
            ? sourceKeys.filter((key) => key === options.key)
            : options.all
              ? sourceKeys
              : [...state.missing, ...state.stale],
        )
        let wrote = false
        for (const key of sourceKeys.filter((candidate) => wanted.has(candidate))) {
          const text = source[key] as string
          const request = {
            lang,
            key,
            source: text,
            note: notes[key]?.note,
            terms: { ...translated },
            ...(configuredModel === undefined ? {} : { model: configuredModel }),
          }
          let answer: string | undefined
          let why = ''
          for (let attempt = 0; attempt < 2 && answer === undefined; attempt++) {
            const result = yield* Effect.either(model.translate(request))
            if (result._tag === 'Left') {
              why = result.left.message
              break
            }
            const candidate = result.right.trim()
            const problems =
              candidate === ''
                ? ['the answer was empty']
                : translationProblems({ [key]: text }, { [key]: candidate })
            if (problems.length === 0) answer = candidate
            else
              why =
                candidate === ''
                  ? 'the answer was empty'
                  : `the answer dropped or changed a placeholder (${problems.join('; ')})`
          }
          if (answer === undefined) {
            io.stderr(`${lang} "${key}": ${why}\n`)
            tally(lang).failed += 1
            tally(lang).costs.add(COST_OF_A_MISS[catalog.name] ?? PLAYER_SEES_ENGLISH)
            continue
          }
          translated[key] = answer
          record[key] = sourceHash(text)
          tally(lang).translated += 1
          wrote = true
        }
        if (!wrote) continue
        const out: Record<string, string> = { $schema: CATALOG_SCHEMA }
        for (const key of sourceKeys) if (translated[key] !== undefined) out[key] = translated[key] as string
        yield* files.writeText(path, `${JSON.stringify(out, null, 2)}\n`).pipe(Effect.mapError(fileProblem))
        records.set(catalog.record, { ...file, [catalog.name]: { ...file[catalog.name], [lang]: record } })
        dirty.add(catalog.record)
      }
    }

    for (const path of dirty) {
      yield* files.writeText(path, sortedJson(records.get(path))).pipe(Effect.mapError(fileProblem))
    }

    let failed = 0
    for (const lang of languages) {
      const { translated, failed: missed, recorded, costs } = tally(lang)
      failed += missed
      if (options.mark) {
        if (recorded > 0) io.stdout(`${lang}: ${recorded} sources recorded\n`)
      } else if (translated + missed > 0) {
        const miss = missed === 0 ? '' : `, ${missed} not (see above; ${[...costs].join('; ')})`
        io.stdout(`${lang}: ${translated} translated${miss}\n`)
      }
    }
    return failed > 0 ? 1 : 0
  })
  return Effect.catchAll(program, (problem: Problem) =>
    Effect.sync(() => {
      io.stderr(`Error: ${problem.message}\n`)
      return 2
    }),
  )
}
