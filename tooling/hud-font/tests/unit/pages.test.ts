import { describe, expect, it } from 'vitest'
import { PAGES } from '#src/pages.ts'

const page = (id: string): string => PAGES.find((p) => p.id === id)?.chars ?? ''

describe('PAGES', () => {
  it('has the two pages the spec names, in the order the chooser tries them', () => {
    expect(PAGES.map((p) => p.id)).toEqual(['latin', 'cyrillic'])
  })

  it('leaves out the soft hyphen, which Geist has no glyph for', () => {
    expect(page('latin')).not.toContain('­')
    expect(page('cyrillic')).not.toContain('­')
  })

  it('holds every Polish and Turkish letter on the latin page', () => {
    for (const ch of 'ĄąĆćĘęŁłŃńŚśŹźŻżĞğİıŞşŒœ') expect(page('latin')).toContain(ch)
  })

  it('holds both Ukrainian apostrophes on the cyrillic page', () => {
    expect(page('cyrillic')).toContain('’')
    expect(page('cyrillic')).toContain('ʼ')
  })

  it('holds all of ASCII on both pages, so a Russian name with a digit stays on one page', () => {
    for (let c = 0x20; c < 0x7f; c++) {
      expect(page('latin')).toContain(String.fromCharCode(c))
      expect(page('cyrillic')).toContain(String.fromCharCode(c))
    }
  })

  it('holds the Ukrainian Ґ and the numero sign, and the whole basic Cyrillic block', () => {
    for (const ch of 'Ґґ№') expect(page('cyrillic')).toContain(ch)
    for (let c = 0x400; c <= 0x45f; c++) expect(page('cyrillic')).toContain(String.fromCharCode(c))
  })

  it('lists no character twice', () => {
    for (const { chars } of PAGES) expect(new Set(chars).size).toBe([...chars].length)
  })
})
