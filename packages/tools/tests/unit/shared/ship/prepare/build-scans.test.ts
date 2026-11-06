import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { FileError, tryFile } from '#src/shared/node/errors.ts'
import { checkTag, scanBuild } from '#src/shared/ship/prepare/build-scans.ts'

// The checks every target that publishes a build makes in the same words, written once.

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runSync(Effect.either(effect))
const failure = (result: Either.Either<unknown, { _tag: string }>) => {
  if (Either.isRight(result)) throw new Error('expected a failure')
  return result.left
}

function dist(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'build-scans-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

describe('checkTag', () => {
  it('passes a branch build and the matching tag', () => {
    expect(Either.isRight(run(checkTag('1.2.0', undefined)))).toBe(true)
    expect(Either.isRight(run(checkTag('1.2.0', 'v1.2.0')))).toBe(true)
  })

  it('stops on a tag that is not the version, and says how to fix it', () => {
    const error = failure(run(checkTag('1.2.0', 'v1.3.0')))
    expect(error._tag).toBe('VersionMismatch')
    expect((error as unknown as Error).message).toContain('tag it v1.2.0')
  })
})

describe('scanBuild', () => {
  const key = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_')

  it('passes a clean build', () => {
    expect(Either.isRight(run(scanBuild({ distDir: dist({ 'a.js': 'let a = 1' }) })))).toBe(true)
  })

  it('finds a secret first, then the closed beta, in a public build', () => {
    const both = dist({ 'a.js': `x("pixi3d-shadow-budget"); const k = "${key}"` })
    expect(failure(run(scanBuild({ distDir: both })))._tag).toBe('SecretInBuild')
    const beta = dist({ 'a.js': 'x("pixi3d-shadow-budget")' })
    expect(failure(run(scanBuild({ distDir: beta })))._tag).toBe('Pixi3dInPublicBuild')
  })

  it('lets a private build carry the closed beta, but never its extras', () => {
    const beta = dist({ 'a.js': 'x("pixi3d-shadow-budget")' })
    expect(Either.isRight(run(scanBuild({ distDir: beta, audience: 'private' })))).toBe(true)
    const extras = dist({ 'a.js': 'x("generateSpawnBurst")' })
    expect(failure(run(scanBuild({ distDir: extras, audience: 'private' })))._tag).toBe('Pixi3dExtrasInBuild')
  })

  it('reads the game folder’s .env values, so a leaked one is found', () => {
    const gameDir = dist({ '.env': 'API_TOKEN=hunter2-hunter2-hunter2\n' })
    const distDir = dist({ 'a.js': 'const k = "hunter2-hunter2-hunter2"' })
    expect(failure(run(scanBuild({ distDir, gameDir })))._tag).toBe('SecretInBuild')
  })

  it('says FileError, with the folder, when the build folder cannot be read', () => {
    const error = failure(run(scanBuild({ distDir: join(tmpdir(), 'build-scans-missing-folder') })))
    expect(error).toBeInstanceOf(FileError)
  })
})

describe('tryFile', () => {
  it('turns a throw into a FileError that names the path', () => {
    const result = run(
      tryFile('/some/path', () => {
        throw new Error('nope')
      }),
    )
    const error = failure(result)
    expect(error).toBeInstanceOf(FileError)
    expect((error as unknown as Error).message).toBe('/some/path: nope')
  })

  it('passes a value through', () => {
    expect(run(tryFile('/p', () => 7))).toEqual(Either.right(7))
  })
})
