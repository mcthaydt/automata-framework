// The compiler (M1.3 spec §3.2). Extracted from FloorFifty packages/content/src/compiler.ts (122a220).
//
// Reads, parses, checks and assembles, and writes nothing. Every check runs on every file even when an
// earlier one failed, so one save reports every independent problem rather than the first file the
// compiler happened to open. Writing is `buildContent`'s job (write-outputs.ts).
//
// Changed from FloorFifty: the kinds are the game's registered schemas, the hash is one XXH64 over the
// canonical data, and the result is an Effect that fails with a typed error.

import { Effect } from 'effect'
import type { z } from 'zod'
import { type Diagnostic, type Problem, sortDiagnostics } from '../diagnostics/diagnostic'
import { checkFlow, type FlowCapabilities, type FlowGraph, flowSchema } from '../flow/check-flow'
import {
  type AssetsSource,
  assetsSchema,
  checkAssets,
  checkGame,
  gameSchema,
  languagesOf,
  rukenFields,
} from '../game/game-facts'
import { checkWithRuken } from '../game/ruken/ruken-check'
import { type ContentData, type ContentGenerator, runGenerators } from '../generate/content-generator'
import { contentHash } from '../hash/content-hash'
import { type ParaglideOptions, paraglideProblems } from '../locale/compile-messages'
import { checkTranslation, collectMessages, type MessageCatalog } from '../locale/messages'
import { checkPalette, paletteSchema } from '../palette/palette'
import { locateJsonKeys } from '../parse/locate-json-keys'
import { positionOf } from '../parse/locate-keys'
import {
  diagnosticAt,
  type ParsedToml,
  parseDocument,
  parseTomlFile,
  type SourceFile,
} from '../parse/parse-document'
import { type ContentSchemaDef, configProblems } from '../schema/content-schema'
import { checkReferences, type FoundRef, type FoundText, resolveMarkers } from '../schema/references'
import { checkTuning, type TunableDeclarations, type TuningMeta } from '../tuning/check-tuning'
import { builtInGenerators } from './built-in-generators'
import { ContentCompileFailed, InvalidContentConfig } from './errors'
import { readSources, type SourceTree } from './read-sources'
import { type SimPartition, simKindsOf, simPartition, simReferenceProblems } from './sim-partition'

/**
 * What the content compiler is given: the project root, the registered kinds, and optionally tunables,
 * invariants, flow capabilities, generators, an output folder and Paraglide.
 */
export interface ContentOptions {
  /** The project root; content is read from `<root>/content`. */
  readonly root: string
  readonly schemas: readonly ContentSchemaDef[]
  /** Code-owned tunable names and ranges. Absent: ranges are authored in `tuning.toml`. */
  readonly tunables?: TunableDeclarations | undefined
  /** Code-only constants an author may not write in `tuning.toml`. */
  readonly invariants?: readonly string[] | undefined
  /** Code-owned screens, pairs and styles for `flow.toml`. */
  readonly flow?: FlowCapabilities | undefined
  readonly generators?: readonly ContentGenerator[] | undefined
  /** Relative to `root`. Default `content/generated`. */
  readonly outDir?: string | undefined
  /** Compile the catalogs with Paraglide on each build (PRODUCT.L2). Absent: no Paraglide output. */
  readonly paraglide?: ParaglideOptions | undefined
}

/**
 * The result of a compile: the content and its hash, the sim partition, every output file's text, warnings,
 * the languages and each language's message catalog.
 */
export interface CompiledContent {
  readonly data: ContentData
  /** Over all of `data`: the boot check and evidence identity. Never compared with `sim.hash`. */
  readonly hash: string
  /** What the sim receives, and the hash that gates snapshots and replays (M2.2 spec §3.2). */
  readonly sim: SimPartition
  /** Each output path, relative to the output folder, to its exact text. Build and verify use the same bytes. */
  readonly files: ReadonlyMap<string, string>
  /** Problems that do not stop a compile (`skippedFile`), sorted. They are not part of the hash or the outputs. */
  readonly warnings: readonly Diagnostic[]
  /** The source language, then each translation's language, sorted. */
  readonly languages: readonly string[]
  /**
   * Each language's checked catalog (without `$schema`), in `languages` order. Derived beside the hashed data,
   * never inside it, so a translation edit moves neither hash. Paraglide and the glyph sets read these.
   */
  readonly catalogs: ReadonlyMap<string, MessageCatalog>
  /**
   * Where each language's messages are written, in `languages` order: a source message at its text in the
   * TOML, a translated one at its key in `messages/<lang>.json`. The glyph gate names a message by these (M5.5).
   */
  readonly messageLocations: ReadonlyMap<string, ReadonlyMap<string, MessageLocation>>
}

/** A message's place in its file, 1-based. */
export interface MessageLocation {
  readonly file: string
  readonly line: number
  readonly column: number
}

/** Where outputs go when `outDir` is not set: `content/generated`, relative to the project root. */
export const DEFAULT_OUT_DIR = 'content/generated'

export const outDirOf = (options: Pick<ContentOptions, 'outDir'>): string => options.outDir ?? DEFAULT_OUT_DIR

const isRelativeFolder = (path: string): boolean =>
  path !== '' &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')

/** Mistakes in the game's code, found before any file is read. */
function optionProblems(options: ContentOptions): string[] {
  const problems = configProblems(options.schemas)
  const names = new Set<string>()
  for (const { name } of options.generators ?? []) {
    if (names.has(name)) problems.push(`generator "${name}" is registered twice`)
    names.add(name)
  }
  const outDir = outDirOf(options)
  if (!isRelativeFolder(outDir))
    problems.push(`outDir ${outDir} must be a relative folder inside the project`)
  if (options.paraglide !== undefined) problems.push(...paraglideProblems(options.paraglide, outDir))
  return problems
}

/** One parsed file whose references and localized text are found, ready to check. */
interface ParsedItem {
  readonly kind: string
  /** Absent for a single document. */
  readonly id?: string | undefined
  readonly toml: ParsedToml
  readonly refs: readonly FoundRef[]
  readonly texts: readonly FoundText[]
}

type CompileOutcome =
  | { readonly ok: true; readonly content: CompiledContent }
  | { readonly ok: false; readonly error: ContentCompileFailed | InvalidContentConfig }

const NO_KEYS: ParsedToml['keys'] = new Map()

const atFile = (file: string, message: string): Diagnostic => ({
  code: 'missingField',
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

const REQUIRED = 'this file is required and could not be read'

/** The pure part of a compile: everything after the files are read. */
function compileTree(tree: SourceTree, options: ContentOptions): CompileOutcome {
  const diagnostics: Diagnostic[] = [...tree.diagnostics]
  const place = (toml: Pick<ParsedToml, 'file' | 'keys'>, problems: readonly Problem[]): void => {
    for (const p of problems) diagnostics.push(diagnosticAt(toml, p.code, p.path, p.message))
  }
  // A file that does not parse contributes no message keys, so checking translations against the rest would
  // report every key of that file as stale. Translations are checked only when every source parsed.
  let everySourceParsed = true
  // A schema is the game's code: one that throws (a transform or refinement with a bug) is reported as a
  // mistake in that code, naming the file it was reading, never as a crash of the compiler.
  const codeProblems: string[] = []
  const parse = <T>(
    source: SourceFile,
    schema: z.ZodType<T>,
    kind: string,
  ): { value: T; toml: ParsedToml } | undefined => {
    let result: ReturnType<typeof parseDocument<T>>
    try {
      result = parseDocument(source, schema)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      codeProblems.push(`the schema for ${kind} threw while reading ${source.file}: ${reason}`)
      everySourceParsed = false
      return undefined
    }
    if (result.ok) return result
    everySourceParsed = false
    diagnostics.push(...result.diagnostics)
    return undefined
  }

  // 1. The game's kinds. An ID counts as existing even when its file failed to parse, so a reference to it
  //    is not reported a second time as dangling.
  const data: Record<string, unknown> = {}
  const items: ParsedItem[] = []
  const ids = new Map<string, Set<string>>()
  const addItem = (kind: string, id: string | undefined, parsed: { value: unknown; toml: ParsedToml }) => {
    const { value, refs, texts } = resolveMarkers(parsed.value)
    items.push({ kind, id, toml: parsed.toml, refs, texts })
    return value
  }
  for (const def of options.schemas) {
    if ('folder' in def.place) {
      const entries: Record<string, unknown> = {}
      const kindIds = new Set<string>()
      for (const { id, source } of tree.collections.get(def.kind) ?? []) {
        kindIds.add(id)
        const parsed = parse(source, def.schema, def.kind)
        if (parsed !== undefined) entries[id] = addItem(def.kind, id, parsed)
      }
      ids.set(def.kind, kindIds)
      data[def.kind] = entries
      continue
    }
    const source = tree.documents.get(def.kind)
    if (source === undefined) {
      // Missing is only an error when the schema does not accept an absent document.
      const absent = def.schema.safeParse(undefined)
      if (!absent.success) {
        everySourceParsed = false
        diagnostics.push(atFile(`content/${def.place.file}`, REQUIRED))
      } else if (absent.data !== undefined) data[def.kind] = resolveMarkers(absent.data).value
      continue
    }
    const parsed = parse(source, def.schema, def.kind)
    if (parsed !== undefined) data[def.kind] = addItem(def.kind, undefined, parsed)
  }

  // 2. References between items, and none from sim content out to a kind the sim does not receive.
  const simKinds = simKindsOf(options.schemas)
  for (const item of items) {
    place(item.toml, checkReferences(item.refs, ids))
    place(item.toml, simReferenceProblems(item.kind, item.refs, simKinds))
  }

  // 3. The source-language messages. A key two texts share is reported where the second one is.
  const { messages, origins, collisions } = collectMessages(items)
  for (const collision of collisions) {
    const item = items[collision.index] as ParsedItem
    const first = items[collision.first.index] as ParsedItem
    const firstPath = collision.first.path.join('.')
    const owner = first === item ? firstPath : `${first.toml.file} ${firstPath}`
    place(item.toml, [
      {
        path: collision.path,
        code: 'duplicateMessageKey',
        message: `${collision.key} is also the key of ${owner}`,
      },
    ])
  }

  // 4. Built-in documents.
  const tuning = checkBuiltInTuning(tree, options, place, diagnostics)
  data.tuning = tuning.values

  let flow: FlowGraph | undefined
  const flowSource = tree.documents.get('flow')
  if (flowSource === undefined) {
    if (options.flow !== undefined) diagnostics.push(atFile('content/flow.toml', REQUIRED))
  } else {
    const parsed = parse(flowSource, flowSchema, 'flow')
    if (parsed !== undefined) {
      const checked = checkFlow(parsed.value, options.flow)
      place(parsed.toml, checked.problems)
      flow = checked.graph
      data.flow = flow
    }
  }

  const paletteSource = tree.documents.get('palette')
  const authoredPalette =
    paletteSource === undefined ? undefined : parse(paletteSource, paletteSchema, 'palette')
  const palette = checkPalette(authoredPalette?.value)
  if (authoredPalette !== undefined) place(authoredPalette.toml, palette.problems)
  data.palette = palette.palette

  // Assets: undefined when the file is absent, null when it is present but broken (so its screens are
  // unknown and nothing that depends on them is checked).
  let assets: AssetsSource | undefined | null
  const assetsSource = tree.documents.get('assets')
  const assetsFile = assetsSource === undefined ? undefined : parse(assetsSource, assetsSchema, 'assets')
  if (assetsSource !== undefined) {
    assets = assetsFile === undefined ? null : assetsFile.value
    if (assetsFile !== undefined) {
      place(assetsFile.toml, checkAssets(assetsFile.value, flow?.screens))
      data.assets = assetsFile.value
    }
  }

  const gameSource = tree.documents.get('game')
  const game = gameSource === undefined ? undefined : parse(gameSource, gameSchema, 'game')
  const languages = languagesOf(
    game?.value.source_language ?? 'en',
    tree.translations.map((translation) => translation.language),
  )
  if (game !== undefined) {
    const assetScreens = assets === null ? undefined : Object.keys(assets?.screens ?? {})
    place(game.toml, checkGame(game.value, { assetScreens }))
    data.game = game.value
  }
  // Ruken's own parser has the last word on the fields and preload paths content hands to ruken.toml. The
  // assets are checked even when game.toml did not parse, with placeholder fields, so one broken file does
  // not hide the other's problems.
  const ruken = checkWithRuken({
    fields: game === undefined ? undefined : rukenFields(game.value, languages),
    assets: assetsFile?.value,
  })
  if (game !== undefined) place(game.toml, ruken.game)
  if (assetsFile !== undefined) place(assetsFile.toml, ruken.assets)

  // 5. Translations must have exactly the source keys.
  const translated = new Map<string, MessageCatalog>()
  const translatedAt = new Map<string, Map<string, MessageLocation>>()
  for (const { language, source } of everySourceParsed ? tree.translations : []) {
    let parsed: unknown
    try {
      parsed = JSON.parse(source.text)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      place({ file: source.file, keys: NO_KEYS }, [
        { path: [], code: 'staleTranslation', message: `not valid JSON: ${reason}` },
      ])
      continue
    }
    // A key the translation lacks has no place in its file, so it is reported at the source text it
    // translates (L-d); every other problem is placed at its own key in the translation.
    const keys = locateJsonKeys(source.text)
    for (const problem of checkTranslation(messages, parsed)) {
      const key = String(problem.path[0])
      const origin = origins.get(key)
      const missing = origin !== undefined && !Object.hasOwn(parsed as object, key)
      if (!missing) {
        place({ file: source.file, keys }, [problem])
        continue
      }
      const item = items[origin.index] as ParsedItem
      place(item.toml, [{ ...problem, path: origin.path, message: `${key} is missing from ${source.file}` }])
    }
    // Only read once the whole compile passed, when every value is known to be text.
    const { $schema: _schema, ...catalog } = parsed as Record<string, string>
    translated.set(language, catalog)
    translatedAt.set(
      language,
      new Map(Object.keys(catalog).map((key) => [key, { file: source.file, ...positionOf(keys, [key]) }])),
    )
  }

  if (codeProblems.length > 0) {
    return { ok: false, error: new InvalidContentConfig({ message: codeProblems.join('; ') }) }
  }
  if (diagnostics.length > 0) {
    return { ok: false, error: new ContentCompileFailed({ diagnostics: sortDiagnostics(diagnostics) }) }
  }

  // 6. Hashes and generators. Generators only ever see content that passed every check.
  const hash = contentHash(data)
  const sim = simPartition(data, options.schemas)
  const generators = [
    ...builtInGenerators({ flow, game: game?.value, languages, hasAssets: assets !== undefined }),
    ...(options.generators ?? []),
  ]
  const run = runGenerators(generators, {
    data,
    hash,
    sim,
    schemas: options.schemas,
    messages,
    tuning: tuning.meta,
  })
  if (run.configProblems.length > 0) {
    return { ok: false, error: new InvalidContentConfig({ message: run.configProblems.join('; ') }) }
  }
  if (run.diagnostics.length > 0) {
    return { ok: false, error: new ContentCompileFailed({ diagnostics: sortDiagnostics(run.diagnostics) }) }
  }
  return {
    ok: true,
    content: {
      data,
      hash,
      sim,
      files: withOutputList(run.files),
      warnings: sortDiagnostics(tree.warnings),
      languages,
      // The source catalog is the TOML's text, so an authored translation named after the source language
      // never replaces it.
      catalogs: new Map(
        languages.map((language, index) => [
          language,
          index === 0 ? messages : (translated.get(language) as MessageCatalog),
        ]),
      ),
      messageLocations: new Map(
        languages.map((language, index) => [
          language,
          index === 0
            ? new Map(
                [...origins].map(([key, origin]) => {
                  const { toml } = items[origin.index] as ParsedItem
                  return [key, { file: toml.file, ...positionOf(toml.keys, origin.path) }]
                }),
              )
            : (translatedAt.get(language) as ReadonlyMap<string, MessageLocation>),
        ]),
      ),
    },
  }
}

/** The list of everything a build writes, kept in the output folder so the next build can remove what it no longer produces. */
export const OUTPUT_LIST = 'outputs.txt'

/**
 * Adds `outputs.txt`: every other output path, sorted, one per line. `buildContent` reads the previous list
 * to delete outputs that are no longer produced (a deleted game.toml must not leave its ruken-fields.json
 * for ship to read), and never touches a file the list does not name.
 */
function withOutputList(files: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const paths = [...files.keys()].filter((path) => path !== OUTPUT_LIST).sort()
  return new Map([...files, [OUTPUT_LIST, paths.map((path) => `${path}\n`).join('')]])
}

/** `tuning.toml`: required when the game declares its tunables in code, optional otherwise. */
function checkBuiltInTuning(
  tree: SourceTree,
  options: ContentOptions,
  place: (toml: ParsedToml, problems: readonly Problem[]) => void,
  diagnostics: Diagnostic[],
): { values: Readonly<Record<string, unknown>>; meta: TuningMeta } {
  const source = tree.documents.get('tuning')
  if (source === undefined) {
    if (options.tunables !== undefined) diagnostics.push(atFile('content/tuning.toml', REQUIRED))
    return { values: {}, meta: {} }
  }
  const parsed = parseTomlFile(source)
  if (!parsed.ok) {
    diagnostics.push(...parsed.diagnostics)
    return { values: {}, meta: {} }
  }
  const checked = checkTuning(parsed.toml.raw, { tunables: options.tunables, invariants: options.invariants })
  place(parsed.toml, checked.problems)
  return { values: checked.values, meta: checked.meta }
}

/** Compiles `<root>/content` in memory. Writes nothing. */
export const compileContent = (
  options: ContentOptions,
): Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig> =>
  Effect.gen(function* () {
    const problems = optionProblems(options)
    if (problems.length > 0) return yield* new InvalidContentConfig({ message: problems.join('; ') })
    const tree = yield* readSources(options.root, options.schemas)
    const outcome = compileTree(tree, options)
    if (!outcome.ok) return yield* outcome.error
    return outcome.content
  })
