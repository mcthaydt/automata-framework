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
})
