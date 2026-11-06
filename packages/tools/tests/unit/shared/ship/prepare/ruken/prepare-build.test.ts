import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseManifest } from '@ruken/manifest'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { FilesLive } from '#src/shared/node/files.ts'
import { defineShipConfig, type ShipConfig } from '#src/shared/ship/config/ship-config.ts'
import { checkBuild, type PrepareInput, prepareBuild } from '#src/shared/ship/prepare/prepare-build.ts'

const prepare = (input: PrepareInput) => Effect.provide(prepareBuild(input), FilesLive)
const check = (input: PrepareInput) => Effect.provide(checkBuild(input), FilesLive)

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

  // M4.1 follow-up: with no bindings given, the inputs the game's keys() calls bind are read from its sources.
  describe("runtime.inputs against the game's keys() calls", () => {
    const gameWith = (source: string): string => {
      const game = mkdtempSync(join(tmpdir(), 'ship-prepare-game-'))
      mkdirSync(join(game, 'src'))
      writeFileSync(join(game, 'src/game.ts'), `import { keys } from '@mcthaydt/automata-game'\n${source}\n`)
      return game
    }
    const padGame = (): string =>
      gameWith('export const input = keys(Move, { KeyA: { x: -1 } }, { pad: { 14: { x: -1 } } })')

    it('stops on a pad binding the config leaves out, naming the call, writing nothing', () => {
      const dir = dist()
      const error = failure(prepare({ distDir: dir, gameDir: padGame(), config }))
      expect(error._tag).toBe('ManifestInputsMismatch')
      expect((error as unknown as { message: string }).message).toContain(
        'action "src/game.ts:2:22 pad" binds pad buttons but runtime.inputs has no "gamepad"',
      )
      expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
    })

    it('writes the manifest when the keys() calls agree with runtime.inputs', () => {
      const dir = dist()
      const withPad = { ...config, runtime: { ...config.runtime, inputs: ['touch', 'gamepad'] as const } }
      Effect.runSync(prepare({ distDir: dir, gameDir: padGame(), config: withPad }))
      expect(existsSync(join(dir, 'ruken.toml'))).toBe(true)
    })

    it('takes bindings the caller gives over the sources: they are the real input map', () => {
      const dir = dist()
      Effect.runSync(
        prepare({ distDir: dir, gameDir: padGame(), config, inputBindings: { jump: { touch: true } } }),
      )
      expect(existsSync(join(dir, 'ruken.toml'))).toBe(true)
    })
  })

  // X-b and S7-g (M3 spec §4.8): the closed beta never reaches a public build, and its extras never reach any.
  describe('@pixi/3d in the build', () => {
    const with3d = () => {
      const dir = dist()
      writeFileSync(join(dir, 'assets/main.js'), 'throw Error("View3D.screenToRay:degenerate")')
      return dir
    }

    it('stops a public build that contains @pixi/3d, saying why and where it may go, writing nothing', () => {
      const dir = with3d()
      const error = failure(prepare({ distDir: dir, config }))
      expect(error._tag).toBe('Pixi3dInPublicBuild')
      const message = (error as unknown as { message: string }).message
      expect(message).toContain('assets/main.js')
      expect(message).toContain('may not be shipped publicly yet')
      expect(message).not.toContain('D-1')
      expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
    })

    it('prepares a private build (the dev host, Ruken’s local stack) that contains @pixi/3d', () => {
      const dir = with3d()
      expect(Effect.runSync(prepare({ distDir: dir, config, audience: 'private' })).manifestPath).toBe(
        join(dir, 'ruken.toml'),
      )
    })

    // CI's `prepare` of a game whose ship config says `audience: 'private'` (base-3d until Pixi 3D's public
    // release): every check runs, but no ruken.toml is written, so a raw `ruken publish` of the folder has no
    // manifest to upload (the review of #241 refused a private prepare that wrote one).
    it('checks a private build without writing ruken.toml (checkBuild)', () => {
      const dir = with3d()
      expect(Effect.runSync(check({ distDir: dir, config, audience: 'private' })).toml).toContain('[game]')
      expect(existsSync(join(dir, 'ruken.toml'))).toBe(false)
    })

    it('still refuses what Ruken refuses when it writes nothing', () => {
      const dir = with3d()
      const bad = { ...config, content: { ...config.content, languages: ['fr'] } }
      expect(failure(check({ distDir: dir, config: bad, audience: 'private' }))._tag).toBe('ManifestInvalid')
    })

    it('stops any build that contains @pixi/3d/extras, private too', () => {
      const dir = dist()
      writeFileSync(join(dir, 'assets/main.js'), 'const s = "ctx.packedFrames"')
      const error = failure(prepare({ distDir: dir, config, audience: 'private' }))
      expect(error._tag).toBe('Pixi3dExtrasInBuild')
      expect((error as unknown as { message: string }).message).toContain('assets/main.js')
    })
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
