import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PACKAGE_ROOT } from '#src/testing/copy-screens.ts'

// The package's words are message catalogs in the six languages the framework ships, so `automata words` translates them as it
// does a game's: every language has exactly the English keys, with the same `{placeholders}`, and a note for the translator.

const LANGUAGES = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'] as const
const folder = join(PACKAGE_ROOT, 'src', 'shared', 'words')
const read = (name: string): Record<string, string> =>
  JSON.parse(readFileSync(join(folder, `${name}.json`), 'utf8')) as Record<string, string>
const keys = (catalog: Record<string, string>): string[] =>
  Object.keys(catalog)
    .filter((k) => k !== '$schema')
    .sort()
const placeholders = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()

describe('the package’s words', () => {
  const en = read('en')

  it.each(LANGUAGES)(
    '%s has exactly the English keys, each written out, with the English placeholders',
    (language) => {
      const catalog = read(language)
      expect(keys(catalog)).toEqual(keys(en))
      for (const key of keys(en)) {
        expect(catalog[key]?.trim(), `${language} ${key}`).toBeTruthy()
        expect(placeholders(catalog[key] ?? ''), `${language} ${key}`).toEqual(placeholders(en[key] ?? ''))
      }
    },
  )

  it('has a note for the translator on every key', () => {
    const context = JSON.parse(readFileSync(join(folder, 'context.json'), 'utf8')) as Record<
      string,
      { note: string }
    >
    expect(Object.keys(context).sort()).toEqual(keys(en))
  })

  it('records the source each translation was made from, so a changed English line is found stale', () => {
    const sources = JSON.parse(readFileSync(join(folder, 'sources.json'), 'utf8')) as {
      words: Record<string, Record<string, string>>
    }
    for (const language of LANGUAGES.filter((l) => l !== 'en')) {
      expect(Object.keys(sources.words[language] ?? {}).sort(), language).toEqual(keys(en))
    }
  })
})
