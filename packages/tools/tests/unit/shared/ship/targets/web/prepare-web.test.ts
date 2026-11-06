import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'
import { type PrepareWebInput, prepareWeb } from '#src/shared/ship/targets/web/prepare-web.ts'

// The web target has no packaging step: the build is the thing to upload. `prepare --target web` is the checks every
// public target runs, so the folder is safe to put on any static host.

const config: ShipConfig = defineShipConfig({
  game: { id: 'emberwick', title: 'Emberwick', version: '1.2.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'canvas2d', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

const goodBuild = {
  'index.html': '<script type="module" src="./assets/main.js"></script>',
  'assets/main.js': 'console.log("hi")',
}

function game(files: Record<string, string> = goodBuild): { gameDir: string; distDir: string } {
  const gameDir = mkdtempSync(join(tmpdir(), 'ship-prepare-web-'))
  const distDir = join(gameDir, 'dist')
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(distDir, path)), { recursive: true })
    writeFileSync(join(distDir, path), text)
  }
  return { gameDir, distDir }
}

const prepare = (input: PrepareWebInput) => Effect.runSync(Effect.either(prepareWeb(input)))

function failure(input: PrepareWebInput): { _tag: string; message: string } {
  const result = prepare(input)
  if (Either.isRight(result)) throw new Error('expected a failure')
  return result.left as unknown as { _tag: string; message: string }
}

describe('prepareWeb', () => {
  it('accepts a clean build and writes nothing into it', () => {
    const { distDir } = game()
    expect(prepare({ distDir, config, tag: 'v1.2.0' })).toEqual(Either.right({ files: 2 }))
    expect(readdirSync(distDir).sort()).toEqual(['assets', 'index.html'])
  })

  it('stops on a tag that is not the version', () => {
    const { distDir } = game()
    expect(failure({ distDir, config, tag: 'v1.3.0' })._tag).toBe('VersionMismatch')
  })

  it('stops when the entry page is missing', () => {
    const { distDir } = game({ 'assets/main.js': '' })
    expect(failure({ distDir, config })._tag).toBe('EntryMissing')
  })

  it('stops on a root-absolute path, which is a 404 on a host that serves the game from a folder', () => {
    const { distDir } = game({ ...goodBuild, 'index.html': '<script src="/assets/main.js"></script>' })
    expect(failure({ distDir, config })._tag).toBe('RootAbsoluteReference')
  })

  it('stops on a secret in the build, naming the place but never the secret', () => {
    const key = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_')
    const { distDir } = game({ ...goodBuild, 'assets/main.js': `const k="${key}"` })
    const error = failure({ distDir, config })
    expect(error._tag).toBe('SecretInBuild')
    expect(error.message).not.toContain(key)
  })

  it('reads the game folder’s .env values, so a leaked one is found', () => {
    const { gameDir, distDir } = game({ ...goodBuild, 'assets/main.js': 'const k="hunter2-hunter2-hunter2"' })
    writeFileSync(join(gameDir, '.env'), 'API_TOKEN=hunter2-hunter2-hunter2\n')
    expect(failure({ distDir, config, gameDir })._tag).toBe('SecretInBuild')
  })

  // A web page is public: the closed beta never goes there, nor its extras.
  it('stops on the private Pixi 3D beta, and on its extras', () => {
    const core = game({ ...goodBuild, 'assets/main.js': 'x("pixi3d-shadow-budget")' })
    expect(failure({ distDir: core.distDir, config })._tag).toBe('Pixi3dInPublicBuild')
    const extras = game({ ...goodBuild, 'assets/main.js': 'x("generateSpawnBurst")' })
    expect(failure({ distDir: extras.distDir, config })._tag).toBe('Pixi3dExtrasInBuild')
  })

  it('stops on eval in the bundle, naming the file', () => {
    const { distDir } = game({ ...goodBuild, 'assets/main.js': 'eval("1+1")' })
    const error = failure({ distDir, config })
    expect(error._tag).toBe('WebBuildInvalid')
    expect(error.message).toContain('no-eval')
    expect(error.message).toContain('assets/main.js:1:1')
  })

  it('stops on an asset Vite inlined as a data: URL', () => {
    const inlined = 'new URL("data:image/png;base64,AAAA", "" + import.meta.url)'
    const { distDir } = game({ ...goodBuild, 'assets/main.js': inlined })
    const error = failure({ distDir, config })
    expect(error._tag).toBe('WebBuildInvalid')
    expect(error.message).toContain('data-urls')
  })
})
