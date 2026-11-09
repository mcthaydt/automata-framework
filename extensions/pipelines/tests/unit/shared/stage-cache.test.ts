import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilesLive } from '#src/shared/node/files.ts'
import type { StageContext, StageDef } from '#src/shared/pipeline.ts'
import { inputHash, missingPaths } from '#src/shared/stage-cache.ts'

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pipe-cache-'))
  writeFileSync(join(dir, 'src.txt'), 'source\n')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const ctx = (): StageContext => ({ dir, specPath: join(dir, 'toy.toml'), spec: {}, tasks: {} })
const stage = (inputs: readonly string[], params?: unknown): StageDef => ({
  id: 'one',
  inputs: () => inputs,
  ...(params === undefined ? {} : { params: () => params }),
  run: () => Effect.succeed({}),
})
const hash = (def: StageDef) => Effect.runPromise(inputHash(def, ctx()).pipe(Effect.provide(FilesLive)))
const xxh = (text: string) => hex64(xxhash64(utf8(text)))

describe('the stage cache hash', () => {
  it('is XXH64 over each input file and its content hash, then the canonical params', async () => {
    const expected = xxh(`src.txt\0${xxh('source\n')}\nparams\0{"a":1,"b":[2]}`)
    expect(await hash(stage(['src.txt'], { b: [2], a: 1 }))).toBe(expected)
    expect(expected).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is stable, and ignores the order of the param keys', async () => {
    expect(await hash(stage(['src.txt'], { a: 1, b: 2 }))).toBe(
      await hash(stage(['src.txt'], { b: 2, a: 1 })),
    )
  })

  it("changes with an input's content, an input's name and the params", async () => {
    const before = await hash(stage(['src.txt'], { a: 1 }))
    expect(await hash(stage(['src.txt'], { a: 2 }))).not.toBe(before)
    writeFileSync(join(dir, 'other.txt'), 'source\n')
    expect(await hash(stage(['other.txt'], { a: 1 }))).not.toBe(before)
    writeFileSync(join(dir, 'src.txt'), 'changed\n')
    expect(await hash(stage(['src.txt'], { a: 1 }))).not.toBe(before)
  })

  it('counts every file below a folder input, by its path from the target folder', async () => {
    mkdirSync(join(dir, 'refs/deep'), { recursive: true })
    writeFileSync(join(dir, 'refs/b.txt'), 'b')
    writeFileSync(join(dir, 'refs/deep/a.txt'), 'a')
    expect(await hash(stage(['refs']))).toBe(
      xxh(`refs/b.txt\0${xxh('b')}\nrefs/deep/a.txt\0${xxh('a')}\nparams\0null`),
    )
  })

  it('is null when a required input is missing, or is an empty folder', async () => {
    expect(await hash(stage(['nowhere.txt']))).toBeNull()
    mkdirSync(join(dir, 'empty'))
    expect(await hash(stage(['src.txt', 'empty']))).toBeNull()
  })
})

describe('missingPaths', () => {
  it('names each path with no file, relative to the target folder', async () => {
    mkdirSync(join(dir, 'full'))
    writeFileSync(join(dir, 'full/x.txt'), 'x')
    mkdirSync(join(dir, 'empty'))
    const missing = await Effect.runPromise(
      missingPaths(dir, ['src.txt', 'full', 'empty', 'gone.txt']).pipe(Effect.provide(FilesLive)),
    )
    expect(missing).toEqual(['empty', 'gone.txt'])
  })
})
