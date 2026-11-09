import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PAGES } from '#src/pages.ts'
import { FONTS_DIR, verifyRecord } from '#src/record.ts'

const copyOfFonts = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'hud-font-'))
  cpSync(FONTS_DIR, dir, { recursive: true })
  return dir
}

describe('verifyRecord', () => {
  it('finds nothing wrong with the committed outputs', () => {
    expect(verifyRecord(FONTS_DIR)).toEqual([])
  })

  it('names the file when one byte of it changes', () => {
    const dir = copyOfFonts()
    const file = join(dir, 'latin-font.ts')
    writeFileSync(file, `${readFileSync(file, 'utf8')} `)
    expect(verifyRecord(dir)).toEqual(['latin-font.ts: sha256 does not match fonts.record.json'])
  })

  it('names a file the record lists but the folder lacks', () => {
    const dir = copyOfFonts()
    writeFileSync(join(dir, 'cyrillic-chars.ts'), '')
    expect(verifyRecord(dir)).toEqual(['cyrillic-chars.ts: sha256 does not match fonts.record.json'])
  })

  it('records an atlas of at most 220,000 bytes for each page', () => {
    const record = JSON.parse(readFileSync(join(FONTS_DIR, 'fonts.record.json'), 'utf8'))
    for (const { id } of PAGES) {
      expect(record.pages[id].atlasBytes).toBeGreaterThan(0)
      expect(record.pages[id].atlasBytes).toBeLessThanOrEqual(220_000)
    }
  })

  it('records the source and its licence', () => {
    const record = JSON.parse(readFileSync(join(FONTS_DIR, 'fonts.record.json'), 'utf8'))
    expect(record.source.licence).toBe('OFL-1.1')
    expect(record.source.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('the committed pages', () => {
  for (const { id, chars } of PAGES) {
    it(`${id}: every character of the page has a glyph, and the chars module matches`, async () => {
      const font = await import(pathToFileURL(join(FONTS_DIR, `${id}-font.ts`)).href)
      const charsModule = await import(pathToFileURL(join(FONTS_DIR, `${id}-chars.ts`)).href)
      expect(charsModule.CHARS).toBe(chars)
      const missing = [...chars].filter((ch) => font.FONT.chars[ch] === undefined)
      expect(missing).toEqual([])
      expect(font.FONT.distanceField).toEqual({ type: 'msdf', range: 4 })
    })
  }
})

// A minifier drops `//` comments, so the notice the OFL asks each copy of the font to carry is a `/*!` one, which
// the game's build keeps; ship's prepare adds the full licence text beside it.
describe('the generated font modules', () => {
  it.each(['latin-font.ts', 'cyrillic-font.ts'])(
    '%s keeps the copyright and licence in a preserved comment',
    (name) => {
      const text = readFileSync(join(FONTS_DIR, name), 'utf8')
      const notice = /\/\*!([\s\S]*?)\*\//.exec(text)?.[1] ?? ''
      expect(notice).toContain('Geist')
      expect(notice).toContain('Vercel')
      expect(notice).toContain('SIL Open Font License')
    },
  )
})
