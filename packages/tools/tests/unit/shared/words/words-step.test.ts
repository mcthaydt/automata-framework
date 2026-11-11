import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { FilesLive } from '#src/shared/node/files.ts'
import { wordsStep } from '#src/shared/words/words-step.ts'

// The `words` step reads a game folder. Each test copies a small fixture game (an English interface catalog and a font
// that draws only Latin) into a temp folder, changes one thing and reads the findings.

const FIXTURE = resolve(import.meta.dirname, '../../../fixtures/words-game')
const LATIN_FONT = resolve(
  import.meta.dirname,
  '../../../../../content/src/shared/assets/fixtures/fonts/pixelify-sans-latin-400-normal.woff2',
)
const SCHEMA = 'https://inlang.com/schema/inlang-message-format'
const made: string[] = []

const catalog = (words: Record<string, string>) =>
  `${JSON.stringify({ $schema: SCHEMA, ...words }, null, 2)}\n`

/** A copy of the fixture game with `files` written over it; a `null` removes a file's text by writing nothing. */
function game(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'words-step-'))
  made.push(dir)
  cpSync(FIXTURE, dir, { recursive: true })
  mkdirSync(join(dir, 'content/fonts'), { recursive: true })
  cpSync(LATIN_FONT, join(dir, 'content/fonts/latin.woff2'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const fontsToml = (locales: readonly string[]) =>
  readFileSync(join(FIXTURE, 'content/fonts.toml'), 'utf8').replace(
    'locales = ["en"]',
    `locales = ${JSON.stringify(locales)}`,
  )

const run = (dir: string) => Effect.runPromise(Effect.provide(wordsStep(dir), FilesLive))

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('wordsStep', () => {
  it('a font that covers the words passes', async () => {
    expect(await run(game())).toEqual([])
  })

  it('a character no font can draw is a finding', async () => {
    const dir = game({
      'messages/ui/ja.json': catalog({ play: '日本', more: '+{count}' }),
      'content/fonts.toml': fontsToml(['en', 'ja']),
    })
    const findings = await run(dir)
    expect(findings.map((f) => f.rule)).toEqual(['words-font', 'words-font'])
    expect(findings[0]?.message).toBe('U+65E5 "日" in ja "play" is not in any font that serves ja')
    expect(findings[0]?.file).toBe('messages/ui/ja.json')
  })

  it('two languages and no fonts.toml: one finding per language without a font', async () => {
    const dir = game({ 'messages/ui/ja.json': catalog({ play: 'Play', more: '+{count}' }) })
    rmSync(join(dir, 'content/fonts.toml'))
    const findings = await run(dir)
    expect(findings.map((f) => f.message)).toEqual([
      'no font is declared for en: name one in content/fonts.toml',
      'no font is declared for ja: name one in content/fonts.toml',
    ])
    expect(findings.every((f) => f.rule === 'words-font')).toBe(true)
  })

  it('a language fonts.toml does not list is a finding', async () => {
    const dir = game({ 'messages/ui/ja.json': catalog({ play: 'Play', more: '+{count}' }) })
    const findings = await run(dir)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      rule: 'words-font',
      file: 'content/fonts.toml',
      message: 'no font is declared for ja: name one in content/fonts.toml',
    })
  })

  it('one language and no fonts.toml: nothing to check', async () => {
    const dir = game()
    rmSync(join(dir, 'content/fonts.toml'))
    expect(await run(dir)).toEqual([])
  })

  it('a game with no catalogs has nothing to check', async () => {
    const dir = game()
    rmSync(join(dir, 'messages'), { recursive: true })
    expect(await run(dir)).toEqual([])
  })

  it('a missing key is a words-parity finding', async () => {
    const dir = game({
      'messages/ui/es-419.json': catalog({ play: 'Jugar' }),
      'content/fonts.toml': fontsToml(['en', 'es-419']),
    })
    expect(await run(dir)).toEqual([
      {
        file: 'messages/ui/es-419.json',
        line: 0,
        col: 0,
        rule: 'words-parity',
        message: 'es-419 "more" has no translation',
      },
    ])
  })

  it('a key the source does not have is a words-parity finding', async () => {
    const dir = game({
      'messages/ui/es-419.json': catalog({ play: 'Jugar', more: '+{count} más', extra: 'Sobra' }),
      'content/fonts.toml': fontsToml(['en', 'es-419']),
    })
    const findings = await run(dir)
    expect(findings.map((f) => [f.rule, f.message])).toEqual([
      ['words-parity', 'es-419 extra: not a source key'],
    ])
  })

  it('a translation that drops a source placeholder is a words-parity finding', async () => {
    const dir = game({
      'messages/ui/es-419.json': catalog({ play: 'Jugar', more: 'más' }),
      'content/fonts.toml': fontsToml(['en', 'es-419']),
    })
    const findings = await run(dir)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ rule: 'words-parity', file: 'messages/ui/es-419.json' })
    expect(findings[0]?.message).toBe('es-419 more: placeholders (none) are not {count}')
  })

  it('a language file a second catalog lacks is one finding, not one per key', async () => {
    const dir = game({
      'content/generated/messages/en.json': catalog({ a: 'A', b: 'B' }),
      'messages/ui/es-419.json': catalog({ play: 'Jugar', more: '+{count} más' }),
      'content/fonts.toml': fontsToml(['en', 'es-419']),
    })
    const findings = await run(dir)
    expect(findings.map((f) => [f.rule, f.file, f.message])).toEqual([
      ['words-parity', 'content/messages/es-419.json', 'es-419 has no content/messages/es-419.json'],
    ])
  })
})
