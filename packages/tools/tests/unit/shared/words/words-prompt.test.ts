import { describe, expect, it } from 'vitest'
import { wordsPrompt } from '#src/shared/words/words-prompt.ts'

describe('wordsPrompt', () => {
  const prompt = wordsPrompt({
    lang: 'ja',
    key: 'saves_slots_more',
    source: '+{count} more',
    note: 'How many more slots are hidden in a long list.',
    terms: { paused_back: '戻る' },
  })

  it('names the language, the key, the note and the source text', () => {
    expect(prompt).toContain('ja')
    expect(prompt).toContain('saves_slots_more')
    expect(prompt).toContain('How many more slots are hidden in a long list.')
    expect(prompt).toContain('+{count} more')
  })

  it('lists the words already chosen so a term stays the same', () => {
    expect(prompt).toContain('paused_back')
    expect(prompt).toContain('戻る')
  })

  it('tells the model to keep every {placeholder} exactly and answer with the translation alone', () => {
    expect(prompt).toMatch(/\{placeholder\}|placeholders/)
    expect(prompt).toMatch(/only the translation/i)
  })

  it('leaves out the note and the terms when there are none', () => {
    const bare = wordsPrompt({ lang: 'ko', key: 'k', source: 'Play', note: undefined, terms: {} })
    expect(bare).not.toContain('Note')
    expect(bare).not.toContain('Words already chosen')
  })
})
