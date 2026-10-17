// The words players read, as a message catalog for translators.
// Extracted from FloorFifty packages/content/src/messages.ts (122a220). The TOML stays the source-language
// text; every build writes `messages/<source>.json` from it in the inlang message format, keyed
// `content_<kind>_<id>_<field>` in snake_case. The catalog is derived beside the artifact, never inside it,
// so it does not move the content hash (editing the text in TOML still does, as any authored change does).
//
// Changed from FloorFifty: the fields are the ones a schema marks with `localized()`, not a hand-written
// list, and each translation in `content/messages/<lang>.json` is checked to have exactly the source keys.

import type { DataPath, Problem } from '../diagnostics/diagnostic'
import { canonicalFile } from '../hash/canonical-file'
import type { FoundText } from '../schema/references'

export const INLANG_SCHEMA = 'https://inlang.com/schema/inlang-message-format'

/** `snow-shrine` → `snow_shrine`, `fastFall` → `fast_fall`, `melee/sword` → `melee_sword`. */
export function snakeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replaceAll('-', '_')
    .replaceAll('/', '_')
    .toLowerCase()
}

/** The message key of one text. `id` is absent for a single-document kind. */
export function messageKey(kind: string, id: string | undefined, path: DataPath): string {
  const parts = [kind, ...(id === undefined ? [] : [id]), ...path.map(String)]
  return `content_${parts.map(snakeKey).join('_')}`
}

/** One locale's messages: message key to translated text. */
export type MessageCatalog = Readonly<Record<string, string>>

export interface TextsOfItem {
  readonly kind: string
  readonly id?: string | undefined
  readonly texts: readonly FoundText[]
}

export interface MessageCollision {
  /** Which item in the input list, so the caller can name its file. */
  readonly index: number
  readonly path: DataPath
  readonly key: string
  /** The text that already has the key: its item's index and its path. */
  readonly first: { readonly index: number; readonly path: DataPath }
}

/** Keys every localized text. Snake-casing can map two different fields to one key; those are reported. */
export function collectMessages(items: readonly TextsOfItem[]): {
  messages: MessageCatalog
  /** Where each key's text is: its item's index and its path, so a problem with the key can name the text. */
  origins: ReadonlyMap<string, MessageCollision['first']>
  collisions: MessageCollision[]
} {
  const messages: Record<string, string> = {}
  const owners = new Map<string, MessageCollision['first']>()
  const collisions: MessageCollision[] = []
  items.forEach((item, index) => {
    for (const { path, text } of item.texts) {
      const key = messageKey(item.kind, item.id, path)
      const first = owners.get(key)
      if (first !== undefined) collisions.push({ index, path, key, first })
      else {
        owners.set(key, { index, path })
        messages[key] = text
      }
    }
  })
  return { messages, origins: owners, collisions }
}

/** The catalog file's exact text. `$schema` sorts first because `$` comes before every letter. */
export function renderMessages(messages: MessageCatalog): string {
  return canonicalFile({ $schema: INLANG_SCHEMA, ...messages })
}

/** Compares a translation file (parsed JSON) with the source catalog. */
export function checkTranslation(source: MessageCatalog, translation: unknown): Problem[] {
  if (typeof translation !== 'object' || translation === null || Array.isArray(translation)) {
    return [{ path: [], code: 'staleTranslation', message: 'a translation is a JSON object of message keys' }]
  }
  const entries = translation as Record<string, unknown>
  const keys = new Set([...Object.keys(source), ...Object.keys(entries)].filter((key) => key !== '$schema'))
  const problems: Problem[] = []
  for (const key of [...keys].sort()) {
    // `Object.hasOwn`, not `in`: `in` also finds `constructor` or `toString` on Object.prototype.
    const inSource = Object.hasOwn(source, key)
    const inTranslation = Object.hasOwn(entries, key)
    if (!inTranslation) problems.push({ path: [key], code: 'staleTranslation', message: `missing ${key}` })
    else if (!inSource) {
      problems.push({ path: [key], code: 'staleTranslation', message: `${key} is not a source key` })
    } else if (typeof entries[key] !== 'string') {
      problems.push({ path: [key], code: 'staleTranslation', message: `${key} must be text` })
    }
  }
  return problems
}
