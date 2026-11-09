// A line keeps its words: `words` is translatable text in the `lines` content kind, plain text in the sim's schema,
// and `wordsOf` hands the dialogue box the words of each line by its `text` key.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContentResult } from '@automata/content'
import { createContentText } from '@automata/content/locale'
import { afterEach, describe, expect, it } from 'vitest'
import { linesContent } from '#src/shared/narrative.content.ts'
import { type LinesFile, lineSchema } from '#src/shared/sim/lines.schema.ts'
import { wordsOf } from '#src/shared/words.ts'

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

const SHOP = `[[lines]]
id = "shop.welcome_in"
kind = "dialogue"
speaker = "shopkeeper"
text = "shop.welcome_in"
words = "Welcome in. Mind the step."

[[lines]]
id = "shop.quiet"
kind = "bark"
text = "shop.quiet"
`

const shop: LinesFile = {
  lines: [
    {
      id: 'shop.welcome_in',
      kind: 'dialogue',
      speaker: 'shopkeeper',
      text: 'shop.welcome_in',
      words: 'Welcome in. Mind the step.',
    },
    { id: 'shop.quiet', kind: 'bark', text: 'shop.quiet' },
  ],
}

function game(lines: string): string {
  root = mkdtempSync(join(tmpdir(), 'narrative-words-'))
  mkdirSync(join(root, 'content', 'lines'), { recursive: true })
  writeFileSync(join(root, 'content', 'lines', 'shop.toml'), lines)
  return root
}

describe('words in the line', () => {
  it('the sim schema keeps words as plain text', () => {
    const parsed = lineSchema.parse(shop.lines[0])
    expect(parsed.words).toBe('Welcome in. Mind the step.')
  })

  it('the content compiler puts the words in the source catalog under the line’s place', async () => {
    const result = await compileContentResult({ root: game(SHOP), schemas: [linesContent] })
    if (!result.ok) throw new Error(`the compile failed: ${result.error.message}`)
    const catalog = result.content.catalogs.get('en') ?? {}
    expect(catalog).toMatchObject({ content_lines_shop_lines_0_words: 'Welcome in. Mind the step.' })
    // A line with no words is not an error, and it adds no message.
    expect(Object.keys(catalog).filter((key) => key.includes('lines_1'))).toEqual([])
  })

  it('refuses empty words, since an empty text is not text', async () => {
    const result = await compileContentResult({
      root: game(SHOP.replace('Welcome in. Mind the step.', '')),
      schemas: [linesContent],
    })
    expect(result.ok).toBe(false)
  })
})

describe('wordsOf', () => {
  it('maps each line’s text key to its source words, and skips a line with none', () => {
    expect([...wordsOf({ shop })]).toEqual([['shop.welcome_in', 'Welcome in. Mind the step.']])
  })

  it('reads the active locale through the game’s content text', () => {
    const french = createContentText({
      content_lines_shop_lines_0_words: () => 'Bienvenue. Attention à la marche.',
    })
    expect(wordsOf({ shop }, french).get('shop.welcome_in')).toBe('Bienvenue. Attention à la marche.')
  })
})
