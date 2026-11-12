import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fontCoverage } from '#src/shared/assets/font-subset.ts'
import { DEFAULT_LOCALES, ENDONYMS } from '#src/shared/locale/default-locales.ts'

// The pixel font set every game draws its words in (`vendor/fonts/README.md`): three flavours of one font, so a Han
// character takes each language's shape. These tests are the proof the choice rests on: the files are the ones the
// README records, and between them they draw every word the framework's own screens show, in every default language.

const ROOT = resolve(import.meta.dirname, '../../../../../..')
const SET = join(ROOT, 'vendor/fonts/fusion-pixel-12')
const CORE = join(ROOT, 'packages/automata/src')

/** The flavour each default language is drawn in. English, Spanish and Portuguese are Latin: any flavour holds it. */
const FLAVOUR: Readonly<Record<(typeof DEFAULT_LOCALES)[number], string>> = {
  en: 'ja',
  ja: 'ja',
  ko: 'ko',
  'es-419': 'ja',
  'pt-BR': 'ja',
  'zh-Hans': 'zh_hans',
}

const bytes = (flavour: string) => new Uint8Array(readFileSync(join(SET, `${flavour}.woff2`)))

/** Every file below `dir` that ends with `suffix`. */
function filesBelow(dir: string, suffix: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => join(entry.parentPath, entry.name))
}

describe('the pixel font set', () => {
  it('is the files the README records', () => {
    const readme = readFileSync(join(ROOT, 'vendor/fonts/README.md'), 'utf8')
    for (const file of ['ja.woff2', 'ko.woff2', 'zh_hans.woff2', 'OFL.txt']) {
      const hash = createHash('sha256')
        .update(readFileSync(join(SET, file)))
        .digest('hex')
      expect(readme, file).toContain(hash)
    }
  })

  it('carries the SIL Open Font License and its Reserved Font Name', () => {
    const licence = readFileSync(join(SET, 'OFL.txt'), 'utf8')
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1')
    expect(licence).toContain("Reserved Font Name 'Fusion Pixel'")
  })

  describe.each(DEFAULT_LOCALES)('%s', (locale) => {
    const covers = fontCoverage(bytes(FLAVOUR[locale]))

    it('draws every word of core’s screens in this language', () => {
      const words = JSON.parse(
        readFileSync(join(CORE, `app/screens/words/${locale}.json`), 'utf8'),
      ) as Record<string, string>
      const missing = new Set<string>()
      for (const [key, text] of Object.entries(words))
        if (key !== '$schema')
          for (const char of text) if (!/\p{Cc}/u.test(char) && !covers(char)) missing.add(char)
      expect([...missing]).toEqual([])
    })

    it('draws every language’s name, because the language picker shows them all', () => {
      const missing = [...Object.values(ENDONYMS).join('')].filter((char) => !covers(char))
      expect(missing).toEqual([])
    })
  })

  // Core draws its three icons itself, so the font need not hold one; what is left in its markup is text.
  it('draws every non-ASCII character in core’s Svelte files, in every flavour', () => {
    const found = new Set<string>()
    for (const file of filesBelow(CORE, '.svelte'))
      for (const char of readFileSync(file, 'utf8')) if (char.charCodeAt(0) > 127) found.add(char)
    for (const flavour of new Set(Object.values(FLAVOUR))) {
      const covers = fontCoverage(bytes(flavour))
      expect(
        [...found].filter((char) => !covers(char)),
        flavour,
      ).toEqual([])
    }
  })
})
