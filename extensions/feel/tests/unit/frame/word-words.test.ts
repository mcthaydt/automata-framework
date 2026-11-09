// A word row keeps its words, translatable, like a line in Writer: the table says what pops up, and the content kind
// hands translators the words. The word's `key` stays what it was, the name of the word.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContentResult } from '@automata/content'
import { fakeClock } from '@automata/framework/testing'
import { parse } from 'smol-toml'
import { afterEach, describe, expect, it } from 'vitest'
import { feelContent } from '#src/features/frame/feel.content.ts'
import { createFeel, DEFAULT_SETTINGS } from '#src/features/frame/feel.ts'
import { type FeelContent, feelSchema } from '#src/shared/feel.schema.ts'

const TABLE = `
[[entry]]
on = "player.hit"
word = [{ key = "player.hit.word", words = "Ouch!", at = "subject" }]

[[entry]]
on = "coin.picked"
word = [{ key = "coin.picked.word", words = "Cha-ching" }, { key = "coin.picked.word2" }]
`
const table = parse(TABLE) as unknown as FeelContent
const hit = { type: 'player.hit', payload: { entity: 4 } }
const pick = { type: 'coin.picked', payload: {} }

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('a word keeps its words', () => {
  it('parses a word row with words, and still takes one without', () => {
    expect(feelSchema.safeParse(table).success).toBe(true)
    expect(feelSchema.safeParse({ entry: [{ on: 'a', word: [{ key: 'k' }] }] }).success).toBe(true)
  })

  it('puts the words in the source catalog under the word’s place, and refuses empty words', async () => {
    root = mkdtempSync(join(tmpdir(), 'feel-words-'))
    mkdirSync(join(root, 'content', 'feel'), { recursive: true })
    writeFileSync(join(root, 'content', 'feel', 'feel.toml'), TABLE)
    const result = await compileContentResult({ root, schemas: [feelContent] })
    if (!result.ok) throw new Error(`the compile failed: ${result.error.message}`)
    expect(result.content.catalogs.get('en') ?? {}).toMatchObject({
      content_feel_feel_entry_0_word_0_words: 'Ouch!',
      content_feel_feel_entry_1_word_0_words: 'Cha-ching',
    })
    writeFileSync(join(root, 'content', 'feel', 'feel.toml'), TABLE.replace('Ouch!', ''))
    expect((await compileContentResult({ root, schemas: [feelContent] })).ok).toBe(false)
  })

  it('hands the words and where they sit in the file to the frame that shows them', () => {
    const feel = createFeel({
      content: () => table,
      settings: () => DEFAULT_SETTINGS,
      reducedMotion: () => false,
      clock: fakeClock(),
    })
    feel.hear(1, [hit, pick])
    expect(feel.frame(1, 0, 1 / 60).words).toEqual([
      {
        key: 'player.hit.word',
        at: 4,
        age: 0,
        still: false,
        words: 'Ouch!',
        path: ['entry', 0, 'word', 0, 'words'],
      },
      {
        key: 'coin.picked.word',
        at: null,
        age: 0,
        still: false,
        words: 'Cha-ching',
        path: ['entry', 1, 'word', 0, 'words'],
      },
      { key: 'coin.picked.word2', at: null, age: 0, still: false },
    ])
  })
})
