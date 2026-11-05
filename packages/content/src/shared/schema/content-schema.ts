// Registering a game's content kinds (`ContentSchemaDef`).
//
// FloorFifty declared its twelve kinds and the joins between them by hand (packages/content/src/parse.ts,
// validate/references.ts at 122a220). Here a game registers each kind once with a Zod schema, and marks
// fields that point at other content (`contentRef`) and fields players read (`localized`) inside the schema.

import { z } from 'zod'

/** Where a kind's files are: every TOML file under a folder (a collection), or one file (a document). */
export type ContentSchemaPlace = { readonly folder: string } | { readonly file: string }

/**
 * A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live,
 * and whether the sim receives it. Create one with `defineContentSchema`.
 */
export interface ContentSchemaDef<K extends string = string, S extends z.ZodType = z.ZodType> {
  readonly kind: K
  readonly schema: S
  readonly place: ContentSchemaPlace
  /**
   * Whether the sim receives this kind. Default true: content is gameplay unless the game
   * says otherwise, so a forgotten flag can only refuse a snapshot, never let a gameplay change through.
   */
  readonly sim: boolean
}

/** Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash. */
export interface ContentSchemaOptions {
  readonly sim?: boolean
}

/**
 * Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one
 * file (a single document). The sim receives the kind unless `{ sim: false }`. A bad registration (a name
 * that does not start with a lower-case letter followed by lower-case letters, digits and dashes, a built-in
 * name, a duplicate, or a place two kinds share) is reported when content compiles, as `InvalidContentConfig`.
 */
export function defineContentSchema<const K extends string, S extends z.ZodType>(
  kind: K,
  schema: S,
  place: ContentSchemaPlace,
  options: ContentSchemaOptions = {},
): ContentSchemaDef<K, S> {
  return Object.freeze({ kind, schema, place, sim: options.sim ?? true })
}

/** Kinds the compiler owns: each is a built-in file in `content/`. */
export const RESERVED_KINDS: readonly string[] = ['tuning', 'flow', 'palette', 'game', 'assets']

/** One ID segment is FloorFifty's ID rule; nested folders join segments with `/`. */
export const ID_PATTERN: RegExp = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/
const KIND_PATTERN = /^[a-z][a-z0-9-]*$/

const placeName = (place: ContentSchemaPlace): string => ('folder' in place ? `${place.folder}/` : place.file)

/** Everything wrong with a set of registrations, as sentences. Empty when the set is usable. */
export function configProblems(schemas: readonly ContentSchemaDef[]): string[] {
  const problems: string[] = []
  const kinds = new Set<string>()
  const places = new Map<string, string>()
  for (const { kind, place, sim } of schemas) {
    if (typeof sim !== 'boolean') problems.push(`kind "${kind}": sim must be true or false`)
    if (!KIND_PATTERN.test(kind)) {
      problems.push(`kind "${kind}" must match ${KIND_PATTERN.source}`)
      continue
    }
    if (RESERVED_KINDS.includes(kind)) {
      problems.push(`kind "${kind}" is reserved for the built-in ${kind}.toml`)
      continue
    }
    if (kinds.has(kind)) {
      problems.push(`kind "${kind}" is registered twice`)
      continue
    }
    kinds.add(kind)
    const where = placeName(place)
    const owner = places.get(where)
    if (owner !== undefined) problems.push(`kinds "${owner}" and "${kind}" both read ${where}`)
    else places.set(where, kind)
  }
  return problems
}

// Why markers: Zod 4 cannot report extra facts out of a refinement, so `contentRef` and `localized` turn
// their value into a small marker object during parsing. After validation `resolveMarkers` walks the parsed
// data, records every marker with its path, and puts the plain string back. Walking the data finds markers
// inside arrays, records and unions without re-implementing Zod's traversal. The declared output type stays
// `string` because nothing outside the compiler ever sees a marker.

// Markers and registrations must work across copies of this module. A game's `automata.content.ts` or Vite
// config can be loaded by a different module runner than the compiler, and each runner evaluates its own
// copy of this file. So a marker is recognized by its `automataContentMarker` brand, not by `instanceof`,
// and the registries live on `globalThis` under a global symbol (`Symbol.for` returns the same symbol in
// every copy) so every copy adds to and reads from the same ones.
const REGISTRIES: unique symbol = Symbol.for('@mcthaydt/automata-content/registries')

/** A parsed reference to another content item, before it is checked. */
export class ContentRefMarker {
  readonly automataContentMarker: 'ref' = 'ref'
  constructor(
    readonly kind: string,
    readonly id: string,
  ) {}
}

/** A parsed player-facing text, before it gets its message key. */
export class LocalizedMarker {
  readonly automataContentMarker: 'localized' = 'localized'
  constructor(readonly text: string) {}
}

const brandOf = (value: unknown): unknown =>
  typeof value === 'object' && value !== null
    ? (value as { automataContentMarker?: unknown }).automataContentMarker
    : undefined

export const isContentRefMarker = (value: unknown): value is ContentRefMarker => brandOf(value) === 'ref'
export const isLocalizedMarker = (value: unknown): value is LocalizedMarker => brandOf(value) === 'localized'

interface Registries {
  readonly refs: z.core.$ZodRegistry<{ kind: string }>
  readonly texts: z.core.$ZodRegistry<{ localized: true }>
}

const holder = globalThis as typeof globalThis & { [REGISTRIES]?: Registries }
holder[REGISTRIES] ??= { refs: z.registry<{ kind: string }>(), texts: z.registry<{ localized: true }>() }
const registries: Registries = holder[REGISTRIES]

/** The kind each `contentRef` schema points at, for the `content.d.ts` generator. */
export const contentRefKinds: z.core.$ZodRegistry<{ kind: string }> = registries.refs
/** Every `localized` schema, for the `content.d.ts` generator. */
export const localizedTexts: z.core.$ZodRegistry<{ localized: true }> = registries.texts

/** The ID of another content item of `kind`. Checked to exist, and to be that kind, after parsing. */
export function contentRef<const K extends string>(kind: K): z.ZodType<string, string> {
  const schema = z
    .string()
    .regex(ID_PATTERN, `expected a content ID like "melee/sword" (${ID_PATTERN.source})`)
    .transform((id) => new ContentRefMarker(kind, id) as unknown as string)
  contentRefKinds.add(schema, { kind })
  return schema
}

/** Text a player reads, written in the source language. It gets a message key for translators. */
export function localized(): z.ZodType<string, string> {
  const schema = z
    .string()
    .min(1)
    .transform((text) => new LocalizedMarker(text) as unknown as string)
  localizedTexts.add(schema, { localized: true })
  return schema
}
