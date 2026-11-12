import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The five languages besides English: every string the game shows, as a catalog next to the English one. The story's lines and the
// credits are `content/messages/<lang>.json` (the keys the English build generates), the interface's words are
// `messages/ui/<lang>.json`. The English is the Owner's and is never changed here; a translation keeps the terms a translator never
// touches and the shape of each text (its lines, its key name, its placeholders).

const ROOT = join(import.meta.dirname, '../../..')
const LANGUAGES = ['es-419', 'ja', 'ko', 'pt-BR', 'zh-Hans'] as const
const NEVER_TRANSLATED = ['Bed 04', 'St. Agnes', 'A. Voss', '2000', '0800'] as const
/** Words the game keeps in Latin letters in every language: its name. */
const KEPT_AS_IS = new Set(['The Last Light', 'Bed 04'])

type Catalog = Record<string, string>
const read = (path: string): Catalog => {
  const { $schema: _, ...rest } = JSON.parse(readFileSync(path, 'utf8')) as Catalog
  return rest
}

const contentEn = read(join(ROOT, 'content/generated/messages/en.json'))
const uiEn = read(join(ROOT, 'messages/ui/en.json'))

describe.each(LANGUAGES)('the %s translation', (language) => {
  const content = read(join(ROOT, `content/messages/${language}.json`))
  const ui = read(join(ROOT, `messages/ui/${language}.json`))

  it('has every one of the 78 story and credits strings and no other', () => {
    expect(Object.keys(contentEn)).toHaveLength(78)
    expect(Object.keys(content).sort()).toEqual(Object.keys(contentEn).sort())
  })

  it('has every one of the 22 interface words (19 hotspot names, the two controls, the opening card) and no other', () => {
    expect(Object.keys(uiEn)).toHaveLength(22)
    expect(Object.keys(ui).sort()).toEqual(Object.keys(uiEn).sort())
  })

  it('says something in every string, and not the English, but for the names kept as they are', () => {
    for (const [key, english] of [...Object.entries(contentEn), ...Object.entries(uiEn)]) {
      const text = { ...content, ...ui }[key] as string
      expect(text.trim(), key).not.toBe('')
      if (!KEPT_AS_IS.has(english)) expect(text, key).not.toBe(english)
    }
  })

  it('keeps the terms a translator never touches, wherever the English has them', () => {
    for (const [key, english] of [...Object.entries(contentEn), ...Object.entries(uiEn)]) {
      const text = { ...content, ...ui }[key] as string
      for (const term of NEVER_TRANSLATED) if (english.includes(term)) expect(text, key).toContain(term)
    }
  })

  it('keeps the shape of each text: its lines, its placeholders and the key it names', () => {
    for (const [key, english] of [...Object.entries(contentEn), ...Object.entries(uiEn)]) {
      const text = { ...content, ...ui }[key] as string
      expect(text.split('\n').length, key).toBe(english.split('\n').length)
      expect(text.match(/\{[^}]*\}/g) ?? [], key).toEqual(english.match(/\{[^}]*\}/g) ?? [])
    }
    // The lamp's key is F in the objective that teaches it.
    expect(content.content_lines_prologue_lines_69_words).toMatch(/\bF\b/)
  })
})

describe('the translators’ notes', () => {
  it('give every interface word a note', () => {
    const ui = JSON.parse(readFileSync(join(ROOT, 'messages/ui/context.json'), 'utf8')) as Record<
      string,
      { note: string }
    >
    expect(Object.keys(ui).sort()).toEqual(Object.keys(uiEn).sort())
    expect(Object.values(ui).every((entry) => entry.note.length > 0)).toBe(true)
  })

  it('leave no language out of the story’s folder, which holds catalogs only (the compiler refuses any other file)', () => {
    expect(readdirSync(join(ROOT, 'content/messages')).sort()).toEqual(
      LANGUAGES.map((language) => `${language}.json`).sort(),
    )
  })
})
