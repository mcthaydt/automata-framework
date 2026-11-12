import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { catalogCharacters as contentCatalogCharacters } from '@automata/content/locale'
import { describe, expect, it } from 'vitest'
import { catalogCharacters, fontCoverage, undrawable } from '#src/shared/words/characters.ts'

// What the `words` step needs to know about letters. Tools never imports `@automata/content` at run time (the bin runs
// from source under plain Node, which cannot load its assets entry), so it keeps its own small copies; these tests keep
// them equal to content's where they overlap.

const FIXTURES = resolve(import.meta.dirname, '../../../../../content/src/shared/assets/fixtures/fonts')
const LATIN = new Uint8Array(readFileSync(resolve(FIXTURES, 'pixelify-sans-latin-400-normal.woff2')))
const ENDONYM_JA = new Uint8Array(readFileSync(resolve(FIXTURES, 'noto-sans-jp-endonym.woff2')))

describe('undrawable', () => {
  const covers = [(c: string) => 'abc '.includes(c)]

  it('names each character no font draws, once, with the first key that uses it', () => {
    expect(undrawable({ one: 'ab日', two: 'c日本日' }, covers)).toEqual([
      { key: 'one', character: '日' },
      { key: 'two', character: '本' },
    ])
  })

  it('counts a character any one of the fonts draws', () => {
    expect(undrawable({ one: 'a日' }, [...covers, (c) => c === '日'])).toEqual([])
  })

  it('skips control characters, which draw nothing', () => {
    expect(undrawable({ one: 'a\nb\t' }, covers)).toEqual([])
  })

  it('walks code points, so a character outside the BMP is one character', () => {
    expect(undrawable({ one: '𠮷' }, covers)).toEqual([{ key: 'one', character: '𠮷' }])
  })
})

describe('catalogCharacters', () => {
  const catalog = { a: 'Play {x}', b: '日本 ✓', $schema: 'https://inlang.com/schema/inlang-message-format' }

  it('holds every character of every message, and none of the schema line', () => {
    expect([...catalogCharacters(catalog)].sort()).toEqual(
      [...'Play {x}日本 ✓'].sort().filter((c, i, all) => all.indexOf(c) === i),
    )
  })

  it('equals content’s catalogCharacters', () => {
    expect(catalogCharacters(catalog)).toEqual(contentCatalogCharacters(catalog))
  })
})

describe('fontCoverage', () => {
  it('says which characters a Latin font and a Japanese one can draw', () => {
    const latin = fontCoverage(LATIN)
    expect(latin('A')).toBe(true)
    expect(latin('日')).toBe(false)
    expect(fontCoverage(ENDONYM_JA)('日')).toBe(true)
  })

  it('answers as content’s fontCoverage does, over every printable ASCII and a few more', async () => {
    const { fontCoverage: contentCoverage } = await import('@automata/content/assets')
    const sample = [
      ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(0x20 + i)),
      '日',
      '本',
      'é',
      '한',
      '…',
    ]
    for (const bytes of [LATIN, ENDONYM_JA]) {
      const ours = fontCoverage(bytes)
      const theirs = contentCoverage(bytes)
      for (const character of sample)
        expect([character, ours(character)]).toEqual([character, theirs(character)])
    }
  })
})
