import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gameWords } from '#src/shared/locale/game-words.ts'

// `gameWords` is every word a game shows in one language, by catalog, so the font build and `automata check` hold the
// same words to the font.

const made: string[] = []
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const write = (root: string, path: string, content: unknown): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), typeof content === 'string' ? content : JSON.stringify(content))
}

/** A game folder with an interface catalog, and a stand-in for `@automata/framework` that exports its words folder. */
function game(files: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'game-words-'))
  made.push(root)
  for (const [path, content] of Object.entries(files)) write(root, path, content)
  return root
}

const framework = (words: Record<string, Record<string, string>>): Record<string, unknown> => ({
  'node_modules/@automata/framework/package.json': {
    name: '@automata/framework',
    exports: { './words/*.json': './words/*.json' },
  },
  ...Object.fromEntries(
    Object.entries(words).map(([lang, text]) => [
      `node_modules/@automata/framework/words/${lang}.json`,
      text,
    ]),
  ),
})

describe('gameWords', () => {
  it('returns the content catalog it is given, the game’s interface catalog and each package’s words', async () => {
    const root = game({
      'messages/ui/ja.json': { $schema: 'x', play: 'あそぶ' },
      ...framework({ ja: { paused_title: '一時停止' } }),
    })
    const words = await gameWords(root, 'ja', { stage: '朝' })
    expect([...words.keys()]).toEqual(['content', 'ui', '@automata/framework'])
    expect(words.get('content')).toEqual({ stage: '朝' })
    expect(words.get('ui')).toEqual({ play: 'あそぶ' })
    expect(words.get('@automata/framework')).toEqual({ paused_title: '一時停止' })
  })

  it('reads a game’s interface words from src/messages/ui when that is where its source lives', async () => {
    const root = game({ 'src/messages/ui/ko.json': { play: '시작' } })
    expect((await gameWords(root, 'ko', {})).get('ui')).toEqual({ play: '시작' })
  })

  it('skips a package the game does not have, and a package with no words for the language', async () => {
    const root = game(framework({ ja: { paused_title: '一時停止' } }))
    const words = await gameWords(root, 'ko', { a: 'b' })
    expect([...words.keys()]).toEqual(['content'])
  })

  it('has no ui catalog for a game without one', async () => {
    expect([...(await gameWords(game(), 'en', {})).keys()]).toEqual(['content'])
  })
})
