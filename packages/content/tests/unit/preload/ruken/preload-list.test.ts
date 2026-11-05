import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseManifest } from '@ruken/manifest'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { encodePng } from '../../assets/atlas-image'
import { buildAtlases } from '../../assets/build-atlases'
import { buildFonts } from '../../assets/build-fonts'
import { fontFilesSchema } from '../../assets/fonts.schema'
import { type Diagnostic, formatDiagnostic } from '../../diagnostics/diagnostic'
import { copyFixture, fixtureOptions } from '../../testing/fixture-game'
import { preloadList } from '../preload-list'

/** A built game folder holding `files` (a path ending in `/` is a folder). */
function dist(files: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'content-dist-'))
  for (const file of files) {
    if (file.endsWith('/')) mkdirSync(join(dir, file), { recursive: true })
    else {
      mkdirSync(dirname(join(dir, file)), { recursive: true })
      writeFileSync(join(dir, file), '')
    }
  }
  return dir
}

const FULL_BUILD = ['index.html', 'fonts/inter-latin.woff2', 'art/splash.png', 'audio/menu.m4a']

const run = (root: string, distDir: string) =>
  Effect.runPromise(Effect.either(preloadList({ options: fixtureOptions(root), distDir })))

async function listed(root: string, distDir: string): Promise<string[]> {
  const result = await run(root, distDir)
  if (Either.isLeft(result)) throw new Error(JSON.stringify(result.left))
  return result.right
}

async function refused(root: string, distDir: string): Promise<readonly Diagnostic[]> {
  const result = await run(root, distDir)
  if (Either.isRight(result) || result.left._tag !== 'ContentCompileFailed')
    throw new Error('expected failure')
  return result.left.diagnostics
}

/** Writes `files` below the project root (each a text, or bytes). */
function write(root: string, files: Readonly<Record<string, string | Uint8Array>>): string {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return root
}

/**
 * The fixture's two preloaded screens, Splash (`files` on line 2) and MainMenu (`files` on line 7), each
 * naming the atlases and fonts given, on the lines after its `files`.
 */
function assetsToml(splash: string, mainMenu = ''): string {
  return [
    '[screens.Splash]',
    'files = ["fonts/inter-latin.woff2", "art/splash.png"]',
    splash,
    '',
    '[screens.MainMenu]',
    'files = ["art/splash.png", "audio/*"]',
    mainMenu,
    '',
  ].join('\n')
}

// The asset build's declarations and committed outputs (M5.6, M5.5), as `automata-content assets` leaves them
// under the default outDir, `content/generated`. Only their names matter to the preload list.
const ATLASES_TOML = '[atlas.wick]\nframes = "art/wick"\n\n[atlas.ui]\nframes = "art/ui"\n'
const HASH = 'd830612ac9131788ebae754b9268f83f7c1d3ffa9bc0f9a5514207a8283fe71e'
const fontToml = (name: string) =>
  `[font.${name}]\nfile = "fonts/${name}.woff2"\nsha256 = "${HASH}"\nlicense = "OFL-1.1"\nlocales = ["en", "fr"]\n`
const FONTS_TOML = `${fontToml('pixel')}\n${fontToml('ui')}`
const WICK_PAGES = ['wick-0.json', 'wick-0.png', 'wick-1.json', 'wick-1.png']
const BUILT_ATLASES = Object.fromEntries(
  [...WICK_PAGES, 'ui-0.json', 'ui-0.png'].map((file) => [`content/generated/atlases/${file}`, '']),
)
const PIXEL_EN = 'pixel-en-0123abcd.woff2'
const PIXEL_FR = 'pixel-fr-4567cdef.woff2'
// Languages written out of order: the list sorts them.
const FONTS_JSON = JSON.stringify({
  pixel: { fr: PIXEL_FR, en: PIXEL_EN },
  ui: { en: 'ui-en-89ab0123.woff2' },
})

/** The fixture with the atlas and font declarations, their built outputs, and this `assets.toml`. */
const withAssetBuild = (assets: string): string =>
  write(copyFixture('valid'), {
    'content/assets.toml': assets,
    'content/atlases.toml': ATLASES_TOML,
    'content/fonts.toml': FONTS_TOML,
    ...BUILT_ATLASES,
    'content/generated/fonts/fonts.json': FONTS_JSON,
  })

/** A minimal `ruken.toml` around a `[loading] preload` list, for Ruken's own parser. */
function rukenToml(preload: readonly string[]): string {
  return [
    'schema = 1',
    '[game]',
    'id = "fixture"',
    'title = "Fixture"',
    'version = "0.1.0"',
    'entry = "index.html"',
    'sdk = "^0.0.0"',
    '[runtime]',
    'renderer = "webgl2"',
    'orientation = "any"',
    'inputs = ["touch"]',
    'pause_behavior = "pause"',
    '[network]',
    'connect = []',
    '[content]',
    'languages = ["en"]',
    'rating = "everyone"',
    'descriptors = []',
    '[analytics]',
    'custom_events = []',
    '[loading]',
    `preload = [${preload.map((path) => JSON.stringify(path)).join(', ')}]`,
  ].join('\n')
}

describe('preloadList', () => {
  it("lists each preload screen's files in order, each once", async () => {
    expect(await listed(copyFixture('valid'), dist(FULL_BUILD))).toEqual([
      'fonts/inter-latin.woff2',
      'art/splash.png',
      'audio/*',
    ])
  })

  it("defaults to the flow's entry screen", async () => {
    const root = copyFixture('valid')
    const game = join(root, 'content/game.toml')
    writeFileSync(game, readFileSync(game, 'utf8').replace('preload_screens = ["Splash", "MainMenu"]\n', ''))
    expect(await listed(root, dist(FULL_BUILD))).toEqual(['fonts/inter-latin.woff2', 'art/splash.png'])
  })

  it('is empty without game.toml, where ship reports the missing fields', async () => {
    const root = copyFixture('valid')
    rmSync(join(root, 'content/game.toml'))
    expect(await listed(root, dist(FULL_BUILD))).toEqual([])
  })

  it('lists every missing file at once, and a dir/* entry needs its folder', async () => {
    const result = await run(copyFixture('valid'), dist(['index.html', 'audio']))
    if (Either.isRight(result) || result.left._tag !== 'ContentCompileFailed')
      throw new Error('expected failure')
    expect(result.left.diagnostics.map(formatDiagnostic)).toEqual([
      'content/assets.toml:2:1  screens.Splash.files.0  missingAsset: fonts/inter-latin.woff2 is not in the build',
      'content/assets.toml:2:1  screens.Splash.files.1  missingAsset: art/splash.png is not in the build',
      'content/assets.toml:5:1  screens.MainMenu.files.1  missingAsset: audio/* needs the folder audio in the build',
    ])
  })

  it("gives a list Ruken's parser accepts as [loading] preload", async () => {
    const preload = await listed(copyFixture('valid'), dist(FULL_BUILD))
    const parsed = parseManifest(rukenToml(preload))
    expect(parsed.ok ? parsed.manifest.loading?.preload : parsed.errors).toEqual(preload)
  })
})

// M5 spec §4.7, M5.6F.2: a preloaded screen's atlases and fonts, named in `assets.toml`, bring the asset build's
// outputs into the list: each atlas page's Spritesheet JSON and image, and every language's font subset that
// `fonts.json` names. They are served in the build at `atlases/` and `fonts/`, the folders
// `automata-content assets` writes below `outDir`.
describe('preloadList with the asset build', () => {
  const ATLAS_BUILD = [...FULL_BUILD, ...WICK_PAGES.map((file) => `atlases/${file}`)]
  const FONT_BUILD = [...FULL_BUILD, `fonts/${PIXEL_EN}`, `fonts/${PIXEL_FR}`]

  it("adds each atlas page's JSON then its image after the screen's files, each once", async () => {
    const root = withAssetBuild(assetsToml('atlases = ["wick"]', 'atlases = ["wick"]'))
    expect(await listed(root, dist(ATLAS_BUILD))).toEqual([
      'fonts/inter-latin.woff2',
      'art/splash.png',
      'atlases/wick-0.json',
      'atlases/wick-0.png',
      'atlases/wick-1.json',
      'atlases/wick-1.png',
      'audio/*',
    ])
  })

  it("adds the font's subset for every language fonts.json names, in language order", async () => {
    const root = withAssetBuild(assetsToml('fonts = ["pixel"]'))
    expect(await listed(root, dist(FONT_BUILD))).toEqual([
      'fonts/inter-latin.woff2',
      'art/splash.png',
      `fonts/${PIXEL_EN}`,
      `fonts/${PIXEL_FR}`,
      'audio/*',
    ])
  })

  it('adds nothing for a screen that is not preloaded, and reads nothing for it', async () => {
    // Only the flow's entry, Splash, is preloaded. MainMenu names an atlas and a font that exist nowhere.
    const root = write(copyFixture('valid'), {
      'content/assets.toml': assetsToml('', 'atlases = ["nowhere"]\nfonts = ["nowhere"]'),
    })
    const game = join(root, 'content/game.toml')
    writeFileSync(game, readFileSync(game, 'utf8').replace('preload_screens = ["Splash", "MainMenu"]\n', ''))
    expect(await listed(root, dist(FULL_BUILD))).toEqual(['fonts/inter-latin.woff2', 'art/splash.png'])
  })

  it('reports every page and subset the build lacks at once, at the key that named it', async () => {
    const root = withAssetBuild(assetsToml('atlases = ["wick"]\nfonts = ["pixel"]'))
    const build = dist([...FULL_BUILD, 'atlases/wick-0.json', `fonts/${PIXEL_FR}`])
    expect((await refused(root, build)).map(formatDiagnostic)).toEqual([
      'content/assets.toml:3:1  screens.Splash.atlases.0  missingAsset: atlases/wick-0.png is not in the build',
      'content/assets.toml:3:1  screens.Splash.atlases.0  missingAsset: atlases/wick-1.json is not in the build',
      'content/assets.toml:3:1  screens.Splash.atlases.0  missingAsset: atlases/wick-1.png is not in the build',
      `content/assets.toml:4:1  screens.Splash.fonts.0  missingAsset: fonts/${PIXEL_EN} is not in the build`,
    ])
  })

  it('refuses a name atlases.toml or fonts.toml does not declare, and one the asset build has not written', async () => {
    const root = write(copyFixture('valid'), {
      'content/assets.toml': assetsToml('atlases = ["wick", "wik"]\nfonts = ["pixel", "pixl"]'),
      'content/atlases.toml': ATLASES_TOML,
      'content/fonts.toml': FONTS_TOML,
    })
    expect((await refused(root, dist(FULL_BUILD))).map(formatDiagnostic)).toEqual([
      'content/assets.toml:3:1  screens.Splash.atlases.0  missingAsset: atlas wick has no pages in content/generated/atlases; run automata-content assets',
      'content/assets.toml:3:1  screens.Splash.atlases.1  unknownReference: wik is not an atlas in content/atlases.toml',
      'content/assets.toml:4:1  screens.Splash.fonts.0  missingAsset: font pixel has no subsets in content/generated/fonts/fonts.json; run automata-content assets',
      'content/assets.toml:4:1  screens.Splash.fonts.1  unknownReference: pixl is not a font in content/fonts.toml',
    ])
  })

  it('names every atlas and font as unknown when atlases.toml and fonts.toml are absent', async () => {
    const root = write(copyFixture('valid'), {
      'content/assets.toml': assetsToml('atlases = ["wick"]\nfonts = ["pixel"]'),
    })
    expect((await refused(root, dist(FULL_BUILD))).map(formatDiagnostic)).toEqual([
      'content/assets.toml:3:1  screens.Splash.atlases.0  unknownReference: wick is not an atlas in content/atlases.toml',
      'content/assets.toml:4:1  screens.Splash.fonts.0  unknownReference: pixel is not a font in content/fonts.toml',
    ])
  })

  it("reports a broken fonts.toml with its own diagnostics, and a fonts.json not of the font build's shape", async () => {
    const brokenToml = write(withAssetBuild(assetsToml('fonts = ["pixel"]')), {
      'content/fonts.toml': `${fontToml('pixel')}weight = 400\n`,
    })
    const broken = await refused(brokenToml, dist(FONT_BUILD))
    expect(broken.map(({ file, code, keyPath }) => `${file} ${keyPath} ${code}`)).toEqual([
      'content/fonts.toml font.pixel.weight unknownField',
    ])

    const brokenJson = write(withAssetBuild(assetsToml('fonts = ["pixel"]')), {
      'content/generated/fonts/fonts.json': JSON.stringify({ pixel: [PIXEL_EN] }),
    })
    expect((await refused(brokenJson, dist(FONT_BUILD))).map(formatDiagnostic)).toEqual([
      'content/generated/fonts/fonts.json:1:1  invalidAsset: is not the map automata-content assets writes; run automata-content assets',
    ])
  })

  it('lists the real atlas and font builds, written where automata-content assets writes them', async () => {
    const pixel = new Uint8Array(
      readFileSync(
        new URL('../../assets/fixtures/fonts/pixelify-sans-latin-400-normal.woff2', import.meta.url),
      ),
    )
    const frame = encodePng({ width: 2, height: 2, data: new Uint8Array(16).fill(255) })
    const root = write(copyFixture('valid'), {
      'content/assets.toml': assetsToml('atlases = ["wick"]\nfonts = ["pixel"]'),
      'content/atlases.toml': '[atlas.wick]\nframes = "art/wick"\n',
      'content/fonts.toml': fontToml('pixel'),
      'art/wick/run-a.png': frame,
      'art/wick/run-b.png': frame,
      'fonts/pixel.woff2': pixel,
    })
    const atlases = await Effect.runPromise(buildAtlases(root))
    const fonts = await Effect.runPromise(buildFonts(fixtureOptions(root)))
    const build = dist(FULL_BUILD)
    for (const [file, bytes] of atlases.files) {
      write(root, { [`content/generated/atlases/${file}`]: bytes })
      write(build, { [`atlases/${file}`]: bytes })
    }
    for (const [file, bytes] of fonts.files) {
      write(root, { [`content/generated/fonts/${file}`]: bytes })
      write(build, { [`fonts/${file}`]: bytes })
    }
    // The font build's own fonts.json, read with the schema the preload list reads it with.
    const subsets = fontFilesSchema.parse(JSON.parse(new TextDecoder().decode(fonts.files.get('fonts.json'))))
    const preload = await listed(root, build)
    expect(preload).toEqual([
      'fonts/inter-latin.woff2',
      'art/splash.png',
      'atlases/wick-0.json',
      'atlases/wick-0.png',
      `fonts/${subsets.pixel?.en}`,
      `fonts/${subsets.pixel?.fr}`,
      'audio/*',
    ])
    const parsed = parseManifest(rukenToml(preload))
    expect(parsed.ok ? parsed.manifest.loading?.preload : parsed.errors).toEqual(preload)
  })
})
