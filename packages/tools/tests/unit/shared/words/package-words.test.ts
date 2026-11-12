import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gameWords } from '@automataframework/content/assets'
import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { FilesLive } from '#src/shared/node/files.ts'
import { packageCatalogs } from '#src/shared/words/package-words.ts'

// Tools finds the framework packages' words as the font build does, with its own small copy of the lookup (tools never
// imports content at run time). This pins the two together over the same folders.

const made: string[] = []
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function game(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'package-words-'))
  made.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), JSON.stringify(content))
  }
  return root
}

const pkg = (name: string, exported: unknown, words: Record<string, unknown>) => ({
  [`node_modules/${name}/package.json`]: { name, exports: { './words/*.json': exported } },
  ...Object.fromEntries(
    Object.entries(words).map(([lang, text]) => [`node_modules/${name}/words/${lang}.json`, text]),
  ),
})

const ours = (dir: string, lang: string) =>
  Effect.runPromise(Effect.provide(packageCatalogs(dir, lang), FilesLive))

describe('packageCatalogs', () => {
  it('finds each framework package that exports its words, and nothing else', async () => {
    const dir = game({
      ...pkg('@automataframework/framework', './words/*.json', { ja: { $schema: 'x', a: 'あ' } }),
      ...pkg('@automataframework/ui-screens', { default: './words/*.json' }, { ja: { b: 'い' } }),
      ...pkg('@automataframework/net-ui', './words/*.json', { ko: { c: '우' } }),
    })
    expect([...(await ours(dir, 'ja'))]).toEqual([
      ['@automataframework/framework', { a: 'あ' }],
      ['@automataframework/ui-screens', { b: 'い' }],
    ])
  })

  it('answers what content’s gameWords answers for the packages', async () => {
    const dir = game({
      ...pkg('@automataframework/framework', './words/*.json', { ja: { a: 'あ' }, ko: { a: '가' } }),
      ...pkg('@automataframework/net-ui', { default: './words/*.json' }, { ja: { c: 'う' } }),
    })
    for (const lang of ['ja', 'ko', 'en']) {
      const theirs = [...(await gameWords(dir, lang, {}))].filter(([name]) => name.startsWith('@'))
      expect([...(await ours(dir, lang))], lang).toEqual(theirs)
    }
  })
})
