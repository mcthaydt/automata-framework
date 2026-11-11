import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fontCoverage, gameWords } from '@automata/content/assets'
import { DEFAULT_LOCALES } from '@automata/content/locale'
import { describe, expect, it } from 'vitest'
import { emberwickWords } from '#src/features/screens/words.ts'

// Emberwick's own words, in the six default languages (messages/ui/<lang>.json), and the proof that the fonts the game
// ships draw every one of them. The catalogs are plain JSON; the screens are plain DOM, so there is no Paraglide.

const GAME = join(import.meta.dirname, '../../..')

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(GAME, path), 'utf8')) as T

/** A catalog without its `$schema` line. */
const catalog = (lang: string): Record<string, string> => {
  const { $schema: _schema, ...words } = readJson<Record<string, string>>(`messages/ui/${lang}.json`)
  return words
}

/** The `{name}` slots of a text, sorted. */
const slots = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()

describe('the six languages', () => {
  it('are the framework’s default set', () => {
    expect(DEFAULT_LOCALES).toEqual(['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])
  })

  describe.each(DEFAULT_LOCALES)('%s', (lang) => {
    it('has every word, with the time placeholder kept', () => {
      const source = catalog('en')
      const words = catalog(lang)
      expect(Object.keys(words).sort()).toEqual(Object.keys(source).sort())
      for (const [key, text] of Object.entries(words)) {
        expect(text.trim(), key).not.toBe('')
        expect(slots(text), key).toEqual(slots(source[key] ?? ''))
      }
      expect(slots(words.end_time ?? '')).toEqual(['seconds'])
    })

    it('reads through emberwickWords, with the time put into its slot', () => {
      const words = emberwickWords(lang)
      for (const [field, value] of Object.entries(words))
        if (typeof value === 'string') expect(value.trim(), field).not.toBe('')
      expect(words.time('12.34')).toContain('12.34')
      expect(words.time('12.34')).not.toContain('{')
    })

    it('is drawn whole by the fonts the game ships', async () => {
      // The committed output of `automata-content assets`: the file each language's face is, cut to the game's words.
      const fonts = readJson<Record<string, Record<string, string>>>('content/generated/fonts/fonts.json')
      const files = Object.values(fonts).flatMap((byLocale) =>
        byLocale[lang] === undefined ? [] : [byLocale[lang]],
      )
      expect(files, `a font that serves ${lang}`).not.toEqual([])
      const covers = files.map((file) =>
        fontCoverage(new Uint8Array(readFileSync(join(GAME, 'content/generated/fonts', file)))),
      )
      const content =
        lang === 'en' ? readJson<Record<string, string>>('content/generated/messages/en.json') : {}
      const missing = new Set<string>()
      for (const words of (await gameWords(GAME, lang, content)).values())
        for (const text of Object.values(words))
          for (const char of text)
            if (!/\p{Cc}/u.test(char) && !covers.some((covered) => covered(char))) missing.add(char)
      expect([...missing]).toEqual([])
    })
  })

  it('falls back to English for a language the game does not ship, and finds pt for pt-BR', () => {
    expect(emberwickWords('fr').play).toBe(emberwickWords('en').play)
    expect(emberwickWords('pt').play).toBe(emberwickWords('pt-BR').play)
    expect(emberwickWords('zh-CN').play).toBe(emberwickWords('zh-Hans').play)
  })
})
