// Registering a game's content kinds (A0+A1 spec §5; `ContentSchemaDef` in the M1 shared contracts §2).
//
// FloorFifty declared its twelve kinds and the joins between them by hand (packages/content/src/parse.ts,
// validate/references.ts at 122a220). Here a game registers each kind once with a Zod schema, and marks
// fields that point at other content (`contentRef`) and fields players read (`localized`) inside the schema.

import { z } from 'zod'

/** Where a kind's files are: every TOML file under a folder (a collection), or one file (a document). */
export type ContentSchemaPlace = { readonly folder: string } | { readonly file: string }

export interface ContentSchemaDef<K extends string = string, S extends z.ZodType = z.ZodType> {
  readonly kind: K
  readonly schema: S
  readonly place: ContentSchemaPlace
}

export function defineContentSchema<const K extends string, S extends z.ZodType>(
  kind: K,
  schema: S,
  place: ContentSchemaPlace,
): ContentSchemaDef<K, S> {
  return Object.freeze({ kind, schema, place })
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
  for (const { kind, place } of schemas) {
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

/** A parsed reference to another content item, before it is checked. */
export class ContentRefMarker {
  constructor(
    readonly kind: string,
    readonly id: string,
  ) {}
}

/** A parsed player-facing text, before it gets its message key. */
export class LocalizedMarker {
  constructor(readonly text: string) {}
}

/** The kind each `contentRef` schema points at, for the `content.d.ts` generator. */
export const contentRefKinds: z.core.$ZodRegistry<{ kind: string }> = z.registry<{ kind: string }>()
/** Every `localized` schema, for the `content.d.ts` generator. */
export const localizedTexts: z.core.$ZodRegistry<{ localized: true }> = z.registry<{ localized: true }>()

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
