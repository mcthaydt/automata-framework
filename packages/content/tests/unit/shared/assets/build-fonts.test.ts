import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { buildFonts } from '#src/shared/assets/build-fonts.ts'
import { fontCoverage } from '#src/shared/assets/font-subset.ts'
import { type Diagnostic, formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'
import { copyFixture, fixtureOptions } from '#src/testing/fixture-game.ts'
import { openFont } from '#src/testing/open-font.ts'

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
    expect(names).toHaveLength(4)
    expect(names.slice(0, 2)).toEqual(['fonts.css', 'fonts.json'])
    expect(names[2]).toMatch(/^pixel-en-[0-9a-f]{8}\.woff2$/)
    expect(names[3]).toMatch(/^pixel-fr-[0-9a-f]{8}\.woff2$/)
    expect(JSON.parse(new TextDecoder().decode(files.get('fonts.json')))).toEqual({
      pixel: { en: names[2], fr: names[3] },
    })
    // Each subset holds its language's text: the French name of a stage.
    expect(fontCoverage(files.get(names[3] as string) as Uint8Array)('A')).toBe(true)
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

  // With a `fonts.toml`, a game's languages are all drawn by its fonts: no language falls back to the device's.
  it('refuses a content language no font serves, at the font file', async () => {
    const root = withFont(withJapanese(project(ONE_FONT)))
    expect((await refused(root)).map(formatDiagnostic)).toEqual([
      "content/fonts.toml:1:1  missingAsset: no font serves ja: add it to a font's locales",
    ])
  })

  it('does not check a control character such as a newline', async () => {
    const root = withFont(project(ONE_FONT))
    edit(root, 'content/messages/fr.json', (text) => text.replace('"Aube"', '"Au\\nbe"'))
    expect((await built(root)).size).toBe(4)
  })

  it('refuses a source whose sha256 differs from the recorded one, and cuts nothing from it', async () => {
    const other = '0'.repeat(64)
    expect(
      (await refused(withFont(project(fontEntry('pixel', '["en", "fr"]', other))))).map(formatDiagnostic),
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
      (await refused(withFont(project(fontEntry('pixel', '["en", "fr", "de"]'))))).map(formatDiagnostic),
    ).toEqual([
      'content/fonts.toml:5:1  font.pixel.locales.2  unknownReference: de is not a content language (en, fr)',
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

  // Every word a game shows is cut into the subset, not the content's alone: its interface catalog and the words of
  // the framework packages it uses are drawn in the same face.
  describe('the words a game shows besides its content', () => {
    const ui = (root: string, lang: string, words: Record<string, string>): string => {
      mkdirSync(join(root, 'messages/ui'), { recursive: true })
      writeFileSync(join(root, `messages/ui/${lang}.json`), JSON.stringify(words))
      return root
    }

    it('cuts a word that is only in the interface catalog into the subset', async () => {
      const without = await built(withFont(project(ONE_FONT)))
      expect(fontCoverage(fileOf(without, 'pixel-fr-'))('ö')).toBe(false)
      const files = await built(ui(withFont(project(ONE_FONT)), 'fr', { only_here: 'ö' }))
      expect(fontCoverage(fileOf(files, 'pixel-fr-'))('ö')).toBe(true)
    })

    it('refuses an interface word the font lacks, naming the catalog and the key', async () => {
      const root = ui(withFont(project(ONE_FONT)), 'fr', { quit_now: 'Quitter 日' })
      const [problem] = await refused(root)
      expect(problem).toMatchObject({
        code: 'missingGlyph',
        file: 'messages/ui/fr.json',
        keyPath: 'quit_now',
      })
      expect(problem?.message).toBe('U+65E5 "日" is not in the fr subset of pixel (in the ui words)')
    })

    it('cuts in the words of a framework package the game has, found through its exports', async () => {
      const root = withFont(project(ONE_FONT))
      const pkg = join(root, 'node_modules/@automata/framework')
      mkdirSync(join(pkg, 'words'), { recursive: true })
      writeFileSync(
        join(pkg, 'package.json'),
        JSON.stringify({ name: '@automata/framework', exports: { './words/*.json': './words/*.json' } }),
      )
      writeFileSync(join(pkg, 'words/fr.json'), JSON.stringify({ paused_title: 'Pâusé' }))
      expect(fontCoverage(fileOf(await built(root), 'pixel-fr-'))('â')).toBe(true)
    })
  })

  // A font whose licence reserves its name is cut and then renamed, and its licence travels with the subsets.
  describe('a font with a reserved name', () => {
    const reserved = (root: string): string => {
      mkdirSync(join(root, 'fonts'), { recursive: true })
      writeFileSync(join(root, 'fonts/OFL.txt'), 'SIL Open Font License\n')
      edit(
        root,
        'content/fonts.toml',
        (text) => `${text.trimEnd()}\nreserved_name = "Pixelify"\nlicense_file = "fonts/OFL.txt"\n`,
      )
      return root
    }

    it('comes out under "<font> <language>", keeps its copyright and ships its licence beside fonts.json', async () => {
      const files = await built(reserved(withFont(project(ONE_FONT))))
      const opened = openFont(fileOf(files, 'pixel-fr-'))
      expect(opened.familyName).toBe('pixel fr')
      expect(JSON.stringify(opened.name.records)).toContain('The Pixelify Sans Project Authors')
      expect(new TextDecoder().decode(files.get('pixel-OFL.txt'))).toBe('SIL Open Font License\n')
    })

    it('refuses a licence file that is not there', async () => {
      const root = reserved(withFont(project(ONE_FONT)))
      edit(root, 'content/fonts.toml', (text) => text.replace('fonts/OFL.txt', 'fonts/none.txt'))
      expect((await refused(root)).map(formatDiagnostic)).toEqual([
        'content/fonts.toml:7:1  font.pixel.license_file  missingAsset: fonts/none.txt does not exist',
      ])
    })
  })

  // `fonts.css` is how a game loads its faces: one face per font and language, and one `:lang()` rule per language, so
  // core's theme, which draws in `var(--af-font)`, switches faces when the language changes.
  describe('fonts.css', () => {
    it('holds one face per font and language and one :lang() rule per language, in fonts.toml order', async () => {
      const files = await built(japaneseProject('["en", "fr", "ja"]'))
      const css = new TextDecoder().decode(files.get('fonts.css'))
      expect(css.match(/@font-face/g) ?? []).toHaveLength(6)
      expect(css).toContain('font-family: "pixel en"')
      expect(css).toContain('font-family: "cjk ja"')
      expect(css).toContain('font-display: block')
      expect(css).toContain(':root:lang(fr) {\n  --af-font: "pixel fr", "cjk fr";\n}')
      expect(css).toContain(':root:lang(ja) {\n  --af-font: "pixel ja", "cjk ja";\n}')
      expect(css).not.toMatch(/sans-serif|system-ui/)
      expect(css).toContain(`url("${[...files.keys()].find((name) => name.startsWith('cjk-ja-'))}")`)
    })

    it('is the same bytes on every build', async () => {
      const first = await built(withFont(project(ONE_FONT)))
      const second = await built(withFont(project(ONE_FONT)))
      expect(second.get('fonts.css')).toEqual(first.get('fonts.css'))
    })
  })
})
