import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The package's words are message catalogs in the six languages, so `automata words` translates them as it does a game's.

const LANGUAGES = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'] as const
const folder = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src', 'shared', 'words')
const read = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(folder, `${name}.json`), 'utf8')) as Record<string, unknown>
const keys = (catalog: Record<string, unknown>): string[] =>
  Object.keys(catalog)
    .filter((k) => k !== '$schema')
    .sort()

describe('the stale-build words', () => {
  const en = read('en')
  it.each(LANGUAGES)('%s has exactly the English keys, each written out', (language) => {
    const catalog = read(language)
    expect(keys(catalog)).toEqual(keys(en))
    for (const key of keys(en)) expect(String(catalog[key]).trim(), `${language} ${key}`).not.toBe('')
  })

  it('has a note for the translator on every key, and records each translation’s source', () => {
    expect(Object.keys(read('context')).sort()).toEqual(keys(en))
    const sources = read('sources') as { words: Record<string, Record<string, string>> }
    for (const language of LANGUAGES.filter((l) => l !== 'en'))
      expect(Object.keys(sources.words[language] ?? {}).sort(), language).toEqual(keys(en))
  })
})
