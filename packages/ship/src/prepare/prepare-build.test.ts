import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive } from '@mcthaydt/automata-node'
import { parseManifest } from '@ruken/manifest'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { defineShipConfig, type ShipConfig } from '../config/ship-config.ts'
import { type PrepareInput, prepareBuild } from './prepare-build.ts'

const prepare = (input: PrepareInput) => Effect.provide(prepareBuild(input), FilesLive)

const config: ShipConfig = defineShipConfig({
  game: { id: 'placeholder', title: 'Placeholder', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'canvas2d', orientation: 'any', inputs: ['touch'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

function dist(page = '<script type="module" src="./assets/main.js"></script>'): string {
  const dir = mkdtempSync(join(tmpdir(), 'ship-prepare-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), page)
  writeFileSync(join(dir, 'assets/main.js'), 'console.log("hi")')
  return dir
}

const failure = (effect: Effect.Effect<unknown, { readonly _tag: string }>) => {
  const result = Effect.runSync(Effect.either(effect))
  if (Either.isRight(result)) throw new Error('expected a failure')
  return result.left
}

describe('prepareBuild', () => {
  it('writes a ruken.toml Ruken accepts into the build', () => {
    const dir = dist()
    const { manifestPath } = Effect.runSync(prepare({ distDir: dir, config, tag: 'v0.1.0' }))
    expect(manifestPath).toBe(join(dir, 'ruken.toml'))
    expect(parseManifest(readFileSync(manifestPath, 'utf8')).ok).toBe(true)
  })

  it('stops on a tag that is not the version, writing nothing', () => {
    const dir = dist()
    expect(failure(prepare({ distDir: dir, config, tag: 'v0.2.0' }))._tag).toBe('VersionMismatch')
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
  })

  it('stops on a root-absolute reference, listing it, writing nothing', () => {
    const dir = dist('<script type="module" src="/assets/main.js"></script>')
    const error = failure(prepare({ distDir: dir, config }))
    expect(error._tag).toBe('RootAbsoluteReference')
    expect((error as unknown as { message: string }).message).toContain('index.html: src="/assets/main.js"')
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
  })

  // QB-b: a planted key or an .env value fails prepare with the file and offset, and nothing is written.
  it('stops on a planted sk_live_ key, naming the file and offset, writing nothing', () => {
    const dir = dist()
    const key = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_')
    writeFileSync(join(dir, 'assets/main.js'), `const k="${key}"`)
    const error = failure(prepare({ distDir: dir, config }))
    expect(error._tag).toBe('SecretInBuild')
    const message = (error as unknown as { message: string }).message
    expect(message).toContain('assets/main.js:1:10 (byte 9): stripe-access-token')
    expect(message).not.toContain(key)
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
  })

  it("stops on the value of a game's .env variable copied into the build", () => {
    const game = mkdtempSync(join(tmpdir(), 'ship-prepare-game-'))
    writeFileSync(join(game, '.env.local'), 'SERVER_SECRET=do-not-ship-this\n')
    const dir = dist()
    writeFileSync(join(dir, 'assets/main.js'), 'fetch("x",{headers:{a:"do-not-ship-this"}})')
    const error = failure(prepare({ distDir: dir, gameDir: game, config }))
    expect(error._tag).toBe('SecretInBuild')
    expect((error as unknown as { message: string }).message).toContain(
      'assets/main.js:1:24 (byte 23): env-value: the value of SERVER_SECRET from .env.local',
    )
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
  })

  // M5 spec §4.8, L-b: a board the game names must be declared, or Ruken has nowhere to put the score.
  it('stops on a board the game names that its config does not declare, naming the call site, writing nothing', () => {
    const game = mkdtempSync(join(tmpdir(), 'ship-prepare-game-'))
    mkdirSync(join(game, 'src'))
    writeFileSync(join(game, 'src/game.ts'), "export const done = (lb) => lb.submitScore('weekly', 3)\n")
    const dir = dist()
    const error = failure(prepare({ distDir: dir, gameDir: game, config }))
    expect(error._tag).toBe('UndeclaredBoard')
    expect((error as unknown as { message: string }).message).toContain('src/game.ts:1:44: "weekly"')
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)

    const declared = { ...config, leaderboards: { weekly: { order: 'desc' as const, min: 0, max: 100 } } }
    const passed = Effect.runSync(Effect.either(prepare({ distDir: dir, gameDir: game, config: declared })))
    expect(Either.isRight(passed)).toBe(true)
  })

  // M4.7 follow-up: the orientation the game plays in must be the one its config sends Ruken.
  it('stops on a game that plays in an orientation its config does not declare, naming both, writing nothing', () => {
    const game = mkdtempSync(join(tmpdir(), 'ship-prepare-game-'))
    mkdirSync(join(game, 'src'))
    writeFileSync(
      join(game, 'src/game.ts'),
      "export default defineGame({ id: 'g', orientation: 'landscape' })\n",
    )
    const dir = dist()
    const error = failure(prepare({ distDir: dir, gameDir: game, config }))
    expect(error._tag).toBe('OrientationMismatch')
    const message = (error as unknown as { message: string }).message
    expect(message).toContain(
      'src/game.ts:1:51: defineGame plays "landscape", but runtime.orientation is "any"',
    )
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)

    const landscape = { ...config, runtime: { ...config.runtime, orientation: 'landscape' as const } }
    const passed = Effect.runSync(Effect.either(prepare({ distDir: dir, gameDir: game, config: landscape })))
    expect(Either.isRight(passed)).toBe(true)
  })

  it('stops on a manifest Ruken refuses, writing nothing', () => {
    const dir = dist()
    const bad = { ...config, content: { ...config.content, languages: ['fr'] } }
    expect(failure(prepare({ distDir: dir, config: bad }))._tag).toBe('ManifestInvalid')
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
  })

  it('stops when the entry page is not in the build', () => {
    const dir = dist()
    const missing = { ...config, game: { ...config.game, entry: 'play.html' } }
    expect(failure(prepare({ distDir: dir, config: missing }))._tag).toBe('EntryMissing')
  })

  it('fails with FileError when the build folder does not exist', () => {
    expect(failure(prepare({ distDir: join(tmpdir(), 'ship-no-such-dist'), config }))._tag).toBe('FileError')
  })

  // M4 spec §4.13 (I-g): the game's bindings must agree with runtime.inputs.
  it('stops when the bindings use a device runtime.inputs leaves out, naming the action, writing nothing', () => {
    const dir = dist()
    const error = failure(
      prepare({ distDir: dir, config, inputBindings: { jump: { pad: [0], touch: true } } }),
    )
    expect(error._tag).toBe('ManifestInputsMismatch')
    expect((error as unknown as { message: string }).message).toContain(
      'action "jump" binds pad buttons but runtime.inputs has no "gamepad"',
    )
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
  })

  it('writes the manifest when the bindings agree with runtime.inputs', () => {
    const dir = dist()
    Effect.runSync(prepare({ distDir: dir, config, inputBindings: { jump: { touch: true } } }))
    expect(existsSync(join(dir, 'ruken.toml'))).toBe(true)
  })
})
