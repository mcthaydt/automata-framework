import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineShipConfig, type ShipConfig } from '../../config/ship-config.ts'
import { type PrepareItchInput, prepareItch } from './prepare-itch.ts'

const config: ShipConfig = defineShipConfig({
  game: { id: 'emberwick', title: 'Emberwick', version: '1.2.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'canvas2d', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  itch: { project: 'mcthaydt/emberwick' },
})

const goodBuild = {
  'index.html': '<script type="module" src="./assets/main.js"></script>',
  'assets/main.js': 'console.log("hi")',
}

/** A game folder holding `dist/` with these files; the zip goes beside `dist/`. */
function game(files: Record<string, string> = goodBuild): { gameDir: string; distDir: string } {
  const gameDir = mkdtempSync(join(tmpdir(), 'ship-prepare-itch-'))
  const distDir = join(gameDir, 'dist')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(distDir, path)), { recursive: true })
    writeFileSync(join(distDir, path), text)
  }
  return { gameDir, distDir }
}

const prepare = (input: PrepareItchInput) => Effect.runSync(Effect.either(prepareItch(input)))

function failure(input: PrepareItchInput): { _tag: string; check?: string; message: string } {
  const result = prepare(input)
  if (Either.isRight(result)) throw new Error('expected a failure')
  return result.left as unknown as { _tag: string; check?: string; message: string }
}

const zips = (gameDir: string) => readdirSync(gameDir).filter((name) => name.endsWith('.zip'))

describe('prepareItch', () => {
  it('writes <id>-<version>-itch.zip beside the build, and the same bytes twice', () => {
    const { gameDir, distDir } = game()
    const first = prepare({ distDir, config, tag: 'v1.2.0' })
    expect(first).toEqual(Either.right({ zipPath: join(gameDir, 'emberwick-1.2.0-itch.zip') }))
    const bytes = readFileSync(join(gameDir, 'emberwick-1.2.0-itch.zip'))
    prepare({ distDir, config })
    expect(readFileSync(join(gameDir, 'emberwick-1.2.0-itch.zip')).equals(bytes)).toBe(true)
    expect(existsSync(join(distDir, 'ruken.toml'))).toBe(false)
  })

  it('stops on a tag that is not the version, writing nothing', () => {
    const { gameDir, distDir } = game()
    expect(failure({ distDir, config, tag: 'v1.3.0' })._tag).toBe('VersionMismatch')
    expect(zips(gameDir)).toEqual([])
  })

  it('stops on a root-absolute path before the itch.io checks', () => {
    const { gameDir, distDir } = game({
      'game.html': '<script src="/assets/main.js"></script>',
      'assets/main.js': '',
    })
    expect(failure({ distDir, config })._tag).toBe('RootAbsoluteReference')
    expect(zips(gameDir)).toEqual([])
  })

  // QB.2: a page on itch.io is public, so the build that goes there is held to the same secret scan as Ruken's.
  it('stops on a secret in the build, naming the file and place but never the secret, writing nothing', () => {
    const key = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_')
    const { gameDir, distDir } = game({ ...goodBuild, 'assets/main.js': `const k="${key}"` })
    const error = failure({ distDir, config })
    expect(error._tag).toBe('SecretInBuild')
    expect(error.message).toContain('assets/main.js:1:10 (byte 9): stripe-access-token')
    expect(error.message).not.toContain(key)
    expect(zips(gameDir)).toEqual([])
  })

  // X-b (M3 spec §4.8): an itch.io page is public, so the closed beta never goes there; nor do its extras (S7-g).
  it.each([
    ['View3D.screenToRay:degenerate', 'Pixi3dInPublicBuild'],
    ['generateSpawnBurst', 'Pixi3dExtrasInBuild'],
  ])('stops on a build carrying %j (%s), writing nothing', (marker, tag) => {
    const { gameDir, distDir } = game({ ...goodBuild, 'assets/main.js': `"${marker}"` })
    const error = failure({ distDir, config })
    expect(error._tag).toBe(tag)
    expect(error.message).toContain('assets/main.js')
    expect(zips(gameDir)).toEqual([])
  })

  it("stops on the value of a game's .env variable copied into the build", () => {
    const { gameDir, distDir } = game({
      ...goodBuild,
      'assets/main.js': 'fetch("x",{headers:{a:"do-not-ship-this"}})',
    })
    writeFileSync(join(gameDir, '.env.local'), 'SERVER_SECRET=do-not-ship-this\n')
    const error = failure({ distDir, gameDir, config })
    expect(error._tag).toBe('SecretInBuild')
    expect(error.message).toContain('env-value: the value of SERVER_SECRET from .env.local')
    expect(zips(gameDir)).toEqual([])
  })

  it('stops on each itch.io check with its own name, the file and the limit, writing nothing', () => {
    const cases: [string, Record<string, string>, ShipConfig, string][] = [
      ['entry', { 'play.html': '' }, config, 'index.html: not at the root of the build'],
      [
        'entry',
        goodBuild,
        { ...config, game: { ...config.game, entry: 'play.html' } },
        'game.entry is play.html, but itch.io opens index.html',
      ],
      [
        'file-count',
        Object.fromEntries([
          ...Array.from({ length: 1000 }, (_, index) => [`f/${index}.txt`, '']),
          ...Object.entries(goodBuild),
        ]),
        config,
        'the build has 1002 files; itch.io allows at most 1000',
      ],
      [
        'path-length',
        { ...goodBuild, [`assets/${'a'.repeat(230)}.png`]: '' },
        config,
        `assets/${'a'.repeat(230)}.png: 241 characters; itch.io allows paths of at most 240`,
      ],
      [
        'case',
        { ...goodBuild, 'index.html': '<script type="module" src="./assets/Main.js"></script>' },
        config,
        'index.html: "./assets/Main.js" is assets/main.js on disk',
      ],
      [
        'ruken-toml',
        { ...goodBuild, 'ruken.toml': '' },
        config,
        'ruken.toml: a Ruken manifest is in the build',
      ],
    ]
    for (const [check, files, gameConfig, problem] of cases) {
      const { gameDir, distDir } = game(files)
      const error = failure({ distDir, config: gameConfig })
      expect(error._tag, check).toBe('ItchBuildInvalid')
      expect(error.check, check).toBe(check)
      expect(error.message, check).toContain(problem)
      expect(zips(gameDir), check).toEqual([])
    }
  })

  it('fails with FileError when the build folder does not exist', () => {
    expect(failure({ distDir: join(tmpdir(), 'ship-no-such-itch-dist'), config })._tag).toBe('FileError')
  })
})
