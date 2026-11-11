import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Catalog } from './catalog.ts'

// Each catalog keeps a record of the source text every translation was made from, so `automata words` can tell that a
// source changed since. The record is bookkeeping, not approval: nothing here says a translation is good.

/** Key to the sha256 (hex) of the source text the translation was made from. */
export type SourceRecord = Readonly<Record<string, string>>

/** Catalog name, then language, then key. */
export type SourcesFile = Readonly<Record<string, Readonly<Record<string, SourceRecord>>>>

const hash = z.string().regex(/^[0-9a-f]{64}$/, 'a sha256 in hex')

/** The shape of a record file. */
export const sourcesFileSchema: z.ZodType<SourcesFile> = z.record(
  z.string(),
  z.record(z.string(), z.record(z.string(), hash)),
)

/** The record's value for a source text. */
export function sourceHash(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

/** What a language still needs: words with no translation, and translations whose source has changed. */
export interface WordsState {
  readonly missing: string[]
  readonly stale: string[]
}

const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * `missing` is a source key with no translation, or an empty one. `stale` is a translated key whose record is absent or
 * differs from the source as it is now (a translation with no record is made again once). Both are sorted. A
 * translated key the source no longer has is neither.
 */
export function wordsState(source: Catalog, translated: Catalog, record: SourceRecord): WordsState {
  const missing: string[] = []
  const stale: string[] = []
  for (const [key, text] of Object.entries(source)) {
    const done = translated[key]
    if (done === undefined || done.trim() === '') missing.push(key)
    else if (record[key] !== sourceHash(text)) stale.push(key)
  }
  return { missing: missing.sort(byKey), stale: stale.sort(byKey) }
}
