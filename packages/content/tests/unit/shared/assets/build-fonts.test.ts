import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildFonts } from '#src/shared/assets/build-fonts.ts'
import { fontCoverage } from '#src/shared/assets/font-subset.ts'
import { type Diagnostic, formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'
import { copyFixture, fixtureOptions } from '#src/testing/fixture-game.ts'

// The font build (M5 spec §4.7 Fonts, M5-D7): each font in `content/fonts.toml` is cut to each language it serves,
// the same bytes every time (G-a), and every character of every message in a language must be in that language's
// subsets, or the build fails at the message's `file:line:col` with the code point (G-b, PRODUCT.L's L-e).

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(new URL(`../../../../src/shared/assets/fixtures/fonts/${name}`, import.meta.url)),
  )
/** Latin only: no CJK glyph. */
const FONT = fixture('pixelify-sans-latin-400-normal.woff2')
const HASH = 'd830612ac9131788ebae754b9268f83f7c1d3ffa9bc0f9a5514207a8283fe71e'
/** Three CJK glyphs, 日本語, and nothing Latin. */
const CJK = fixture('noto-sans-jp-endonym.woff2')
const CJK_HASH = 'bd498710082abd038bce0c7ac71bd0ee12ac3917dd2d0e9df3f20af6e3082ded'

const fontEntry = (name: string, locales: string, sha256 = HASH, file = 'fonts/pixel.woff2') =>
  `[font.${name}]\nfile = "${file}"\nsha256 = "${sha256}"\nlicense = "OFL-1.1"\nlocales = ${locales}\n`

/** The fixture game (`en` source, `fr` translation) with the fixture font and `fonts.toml`. */
function project(fontsToml: string | undefined): string {
  const root = copyFixture('valid')
  if (fontsToml !== undefined) writeFileSync(join(root, 'content/fonts.toml'), fontsToml)
  return root
}

function withFont(root: string, file = 'fonts/pixel.woff2', bytes: Uint8Array = FONT): string {
  const path = join(root, file)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, bytes)
  return root
}

const edit = (root: string, file: string, change: (text: string) => string): void => {
  const path = join(root, file)
  writeFileSync(path, change(readFileSync(path, 'utf8')))
}

const build = (root: string) => Effect.runPromise(Effect.either(buildFonts(fixtureOptions(root))))

async function built(root: string): Promise<ReadonlyMap<string, Uint8Array>> {
  const result = await build(root)
  if (Either.isLeft(result)) throw new Error(JSON.stringify(result.left))
  return result.right.files
}

async function refused(root: string): Promise<readonly Diagnostic[]> {
  const result = await build(root)
  if (Either.isRight(result)) throw new Error('expected the build to fail')
  if (result.left._tag !== 'ContentCompileFailed') throw new Error(result.left.message)
  return result.left.diagnostics
}

const ONE_FONT = fontEntry('pixel', '["en", "fr"]')

/** Adds a `ja` translation to the fixture game; its text is the French text, which the Latin face draws. */
function withJapanese(root: string): string {
  writeFileSync(join(root, 'content/messages/ja.json'), readFileSync(join(root, 'content/messages/fr.json')))
  return root
}

/** The fixture game with `ja`, the Latin face serving every language and the 日本語 face serving `cjkLocales`. */
function japaneseProject(cjkLocales: string): string {
  const fonts = `${fontEntry('pixel', '["en", "fr", "ja"]')}${fontEntry('cjk', cjkLocales, CJK_HASH, 'fonts/cjk.woff2')}`
  return withFont(withFont(withJapanese(project(fonts))), 'fonts/cjk.woff2', CJK)
}

const fileOf = (files: ReadonlyMap<string, Uint8Array>, prefix: string): Uint8Array => {
  const name = [...files.keys()].find((file) => file.startsWith(prefix))
  if (name === undefined) throw new Error(`no ${prefix}* file in ${[...files.keys()].join(', ')}`)
  return files.get(name) as Uint8Array
}

describe('buildFonts', () => {
  it('cuts a subset per language the font serves, with hashed names, and lists them in fonts.json', async () => {
    const files = await built(withFont(project(ONE_FONT)))
    const names = [...files.keys()]
    expect(names).toHaveLength(3)
    expect(names[0]).toBe('fonts.json')
    expect(names[1]).toMatch(/^pixel-en-[0-9a-f]{8}\.woff2$/)
    expect(names[2]).toMatch(/^pixel-fr-[0-9a-f]{8}\.woff2$/)
    expect(JSON.parse(new TextDecoder().decode(files.get('fonts.json')))).toEqual({
      pixel: { en: names[1], fr: names[2] },
    })
    // Each subset holds its language's text: the French name of a stage.
    expect(fontCoverage(files.get(names[2] as string) as Uint8Array)('A')).toBe(true)
  })

  it('gives the same bytes on every build (G-a)', async () => {
    const first = await built(withFont(project(ONE_FONT)))
    const second = await built(withFont(project(ONE_FONT)))
    expect(second).toEqual(first)
  })

  it('refuses a translated message with a character no subset holds, at its key, naming the code point (G-b)', async () => {
    const root = withFont(project(ONE_FONT))
    edit(root, 'content/messages/fr.json', (text) => text.replace('"Aube"', '"Aube 日"'))
    expect((await refused(root)).map(formatDiagnostic)).toEqual([
      'content/messages/fr.json:10:3  content_stage_dawn_display_name  missingGlyph: U+65E5 "日" is not in the fr subset of pixel',
    ])
  })

  it('refuses a source message with a missing character at its text in the TOML (G-b)', async () => {
    const root = withFont(project(ONE_FONT))
    edit(root, 'content/stages/dawn.toml', (text) =>
      text.replace('displayName = "Dawn"', 'displayName = "Dawn 日"'),
    )
    expect((await refused(root)).map(formatDiagnostic)).toEqual([
      'content/stages/dawn.toml:2:1  content_stage_dawn_display_name  missingGlyph: U+65E5 "日" is not in the en subset of pixel',
    ])
  })

  it('passes when another font for the language holds the character: a language is covered by all its fonts', async () => {
    const root = withFont(project(`${ONE_FONT}${fontEntry('cjk', '["fr"]', CJK_HASH, 'fonts/cjk.woff2')}`))
    withFont(root, 'fonts/cjk.woff2', CJK)
    edit(root, 'content/messages/fr.json', (text) => text.replace('"Aube"', '"Aube 日"'))
    expect([...(await built(root)).keys()].filter((name) => name.startsWith('cjk-'))).toHaveLength(1)
    // A character neither font holds names both.
    edit(root, 'content/messages/fr.json', (text) => text.replace('"Aube 日"', '"Aube 月"'))
    expect((await refused(root)).map((d) => d.message)).toEqual([
      'U+6708 "月" is not in the fr subset of cjk or pixel',
    ])
  })

  // The language picker names every language in its own language, whichever one the game is showing (M5 spec
  // §4.7, M5.5F), so every subset also holds every content language's name: 日本語 is cut into English too.
  it('cuts every content language’s name into every subset, so the picker can draw them all', async () => {
    const files = await built(japaneseProject('["en", "fr", "ja"]'))
    for (const locale of ['en', 'fr', 'ja']) {
      const covers = fontCoverage(fileOf(files, `cjk-${locale}-`))
      expect([...'日本語'].map(covers), locale).toEqual([true, true, true])
    }
    // The Latin face holds the Latin names, in each language's subset.
    const latin = fontCoverage(fileOf(files, 'pixel-ja-'))
    expect([...'Français'].every(latin)).toBe(true)
  })

  // The gate holds the names to the same rule as the messages (M5.5F): a language's subsets together must hold the
  // name of every language a font serves, or the picker draws one in a face the game did not choose.
  it('refuses a language whose subsets lack another served language’s name, at its place in fonts.toml', async () => {
    expect((await refused(japaneseProject('["ja"]'))).map(formatDiagnostic)).toEqual([
      'content/fonts.toml:5:1  font.pixel.locales.0  missingGlyph: U+65E5 "日", U+672C "本", U+8A9E "語" are not in the en subset of pixel (the language picker names ja 日本語)',
      'content/fonts.toml:5:1  font.pixel.locales.1  missingGlyph: U+65E5 "日", U+672C "本", U+8A9E "語" are not in the fr subset of pixel (the language picker names ja 日本語)',
    ])
  })

  it('does not check the name of a language no font serves, which draws in the game’s own CSS face', async () => {
    const root = withFont(withJapanese(project(ONE_FONT)))
    expect([...(await built(root)).keys()].filter((name) => name.endsWith('.woff2'))).toHaveLength(2)
  })

  // The cut takes every content language's name, served or not (the plan's contract, item 1): `ja` here has no
  // font, yet the 日本語 face serving `en` and `fr` still holds its name.
  it('still cuts the name of a language no font serves into every subset', async () => {
    const fonts = `${ONE_FONT}${fontEntry('cjk', '["en", "fr"]', CJK_HASH, 'fonts/cjk.woff2')}`
    const files = await built(withFont(withFont(withJapanese(project(fonts))), 'fonts/cjk.woff2', CJK))
    for (const locale of ['en', 'fr']) {
      const covers = fontCoverage(fileOf(files, `cjk-${locale}-`))
      expect([...'日本語'].map(covers), locale).toEqual([true, true, true])
    }
  })

  it('does not check a control character such as a newline', async () => {
    const root = withFont(project(ONE_FONT))
    edit(root, 'content/messages/fr.json', (text) => text.replace('"Aube"', '"Au\\nbe"'))
    expect((await built(root)).size).toBe(3)
  })

  it('refuses a source whose sha256 differs from the recorded one, and cuts nothing from it', async () => {
    const other = '0'.repeat(64)
    expect(
      (await refused(withFont(project(fontEntry('pixel', '["en"]', other))))).map(formatDiagnostic),
    ).toEqual([
      `content/fonts.toml:3:1  font.pixel.sha256  invalidAsset: fonts/pixel.woff2 has sha256 ${HASH}, not the recorded ${other}`,
    ])
  })

  it('refuses a missing source file at its file key', async () => {
    expect((await refused(project(ONE_FONT))).map(formatDiagnostic)).toEqual([
      'content/fonts.toml:2:1  font.pixel.file  missingAsset: fonts/pixel.woff2 does not exist',
    ])
  })

  it('refuses a language the content does not compile', async () => {
    expect(
      (await refused(withFont(project(fontEntry('pixel', '["en", "de"]'))))).map(formatDiagnostic),
    ).toEqual([
      'content/fonts.toml:5:1  font.pixel.locales.1  unknownReference: de is not a content language (en, fr)',
    ])
  })

  it('builds nothing without fonts.toml', async () => {
    expect((await built(project(undefined))).size).toBe(0)
  })

  it('fails with the content compile’s diagnostics when the content does not compile', async () => {
    const root = withFont(project(ONE_FONT))
    edit(root, 'content/stages/dawn.toml', (text) => `${text}\nunknownField = 1\n`)
    expect((await refused(root)).map((d) => d.file)).toContain('content/stages/dawn.toml')
  })
})
