import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseManifest } from '@ruken/manifest'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { formatDiagnostic } from '../diagnostics/diagnostic'
import { copyFixture, fixtureOptions } from '../testing/fixture-game'
import { preloadList } from './preload-list'

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
    const toml = [
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
    const parsed = parseManifest(toml)
    expect(parsed.ok ? parsed.manifest.loading?.preload : parsed.errors).toEqual(preload)
  })
})
