import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '#src/shared/create-game/create-game.ts'
import { DEFAULT_LANGUAGES } from '#src/shared/words/default-languages.ts'

// A new game ships in six languages and draws them: its font set (Fusion Pixel's three flavours) is copied in with the
// licence, `content/fonts.toml` names each file with its sha256 and the languages it serves, and every language has a
// catalog holding the starter's one word, so `automata check` and the font build have nothing to refuse.

let dir: string
const read = (path: string): string => readFileSync(join(dir, path), 'utf8')
const sha256 = (path: string): string =>
  createHash('sha256')
    .update(readFileSync(join(dir, path)))
    .digest('hex')

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'af-template-fonts-'))
  await Effect.runPromise(createGame({ targetDir: join(dir, 'game'), id: 'font-game', title: 'Font Game' }))
  dir = join(dir, 'game')
})
afterAll(() => rmSync(join(dir, '..'), { recursive: true, force: true }))

/** The key the content compiler gives the starter's one word, "Bump!" in content/feel/feel.toml. */
const BUMP_KEY = 'content_feel_feel_entry_0_word_0_words'

interface FontRow {
  file: string
  sha256: string
  license: string
  locales: string[]
  reserved_name?: string
  license_file?: string
}
const fonts = (): Record<string, FontRow> =>
  (parse(read('content/fonts.toml')) as unknown as { font: Record<string, FontRow> }).font

describe('the new game’s fonts', () => {
  it('names the three flavours, each serving its own languages, and every shipped language is served once', () => {
    const table = fonts()
    expect(Object.fromEntries(Object.entries(table).map(([name, row]) => [name, row.locales]))).toEqual({
      ja: ['en', 'es-419', 'pt-BR', 'ja'],
      ko: ['ko'],
      'zh-hans': ['zh-Hans'],
    })
    expect(
      Object.values(table)
        .flatMap((row) => row.locales)
        .sort(),
    ).toEqual([...DEFAULT_LANGUAGES].sort())
  })

  it('has every font file it names, with the sha256 it records', () => {
    for (const row of Object.values(fonts())) {
      expect(existsSync(join(dir, row.file)), row.file).toBe(true)
      expect(sha256(row.file), row.file).toBe(row.sha256)
    }
  })

  it('is licensed OFL-1.1, reserves the font’s name for the subsets to drop, and ships the licence text beside the fonts', () => {
    for (const row of Object.values(fonts())) {
      expect(row.license).toBe('OFL-1.1')
      expect(row.reserved_name).toBe('Fusion Pixel')
      expect(row.license_file).toBe('assets/fonts/OFL.txt')
    }
    expect(read('assets/fonts/OFL.txt')).toContain('SIL OPEN FONT LICENSE Version 1.1')
  })

  it('has a catalog for each language but the source, holding the one word the starter shows', () => {
    const messages = readdirSync(join(dir, 'content/messages')).sort()
    expect(messages).toEqual(
      DEFAULT_LANGUAGES.slice(1)
        .map((tag) => `${tag}.json`)
        .sort(),
    )
    // The bump word in content/feel/feel.toml is the starter's only text, so each translation has exactly that key.
    for (const file of messages)
      expect(Object.keys(JSON.parse(read(`content/messages/${file}`))), file).toEqual([BUMP_KEY])
  })

  it('draws in the framework’s face, not a generic family, and loads the faces the font build writes', () => {
    const style = read('style.css')
    expect(style).toContain('var(--af-font)')
    expect(style).not.toContain('sans-serif')
    expect(read('src/main.ts')).toContain("import '../content/generated/fonts/fonts.css'")
  })

  it('cuts the subsets before it runs or builds, with the content config the build reads', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts
    expect(scripts['fonts']).toBe('automata-content assets')
    expect(scripts['dev']).toBe('pnpm fonts && vite')
    expect(scripts['build:web']).toBe('pnpm fonts && vite build --mode web')
    expect(read('automata.content.ts')).toContain(
      'export default { schemas: [...level2dKinds(), controlsKind(), feelContent, audioContent] }',
    )
    expect(read('ship.config.ts')).toContain(
      `languages: ${JSON.stringify(DEFAULT_LANGUAGES).replaceAll('"', "'")}`,
    )
  })
})
