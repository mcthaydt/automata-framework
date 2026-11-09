// Authored TOML text in the active locale.
//
// The sim and the content artifact hold IDs and the source-language text; the words a player reads are looked
// up at run time by the text's message key, built by `messageKey`, the one owner of the key format. A key with
// no message (an item added to TOML before the catalogs were compiled again) shows the authored text and is
// reported once.
//
// One lookup by kind, ID and field path instead of a helper per field, and the report
// is the caller's callback rather than a development-only `console.warn`.

import type { DataPath } from '../diagnostics/diagnostic'
import { messageKey } from './messages'

/** Options for `createContentText`. */
export interface ContentTextOptions {
  /** Called once per key the messages lack. */
  readonly onMissing?: ((key: string) => void) | undefined
}

/** `text(kind, id, path, authored, inputs?)`: the text in the active locale, or the authored text. */
export type ContentText = (
  kind: string,
  id: string | undefined,
  path: DataPath,
  authored: string,
  inputs?: Readonly<Record<string, unknown>>,
) => string

/** A lookup over the messages module Paraglide compiles into `paraglide.outdir` (its `messages.js`, imported whole). */
export function createContentText(
  messages: Readonly<Record<string, unknown>>,
  options: ContentTextOptions = {},
): ContentText {
  const reported = new Set<string>()
  return (kind, id, path, authored, inputs) => {
    const key = messageKey(kind, id, path)
    // `Object.hasOwn`: a key named like `constructor` must not find Object.prototype's.
    const message = Object.hasOwn(messages, key) ? messages[key] : undefined
    if (typeof message === 'function') return (message as (inputs?: unknown) => string)(inputs)
    if (!reported.has(key)) {
      reported.add(key)
      options.onMissing?.(key)
    }
    return authored
  }
}
