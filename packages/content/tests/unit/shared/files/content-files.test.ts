import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  listFiles,
  pathKind,
  readBytesIfPresent,
  readTextIfPresent,
  writeFileAtomically,
} from '#src/shared/files/content-files.ts'

const scratch = (): string => mkdtempSync(join(tmpdir(), 'content-files-'))

describe('listFiles', () => {
  it('lists every file below a folder, relative and sorted', async () => {
    const dir = scratch()
    mkdirSync(join(dir, 'melee'))
    writeFileSync(join(dir, 'zeta.toml'), '')
    writeFileSync(join(dir, 'melee', 'sword.toml'), '')
    writeFileSync(join(dir, 'alpha.toml'), '')
    expect(await Effect.runPromise(listFiles(dir))).toEqual(['alpha.toml', 'melee/sword.toml', 'zeta.toml'])
  })

  it('treats an absent folder as empty', async () => {
    expect(await Effect.runPromise(listFiles(join(scratch(), 'nope')))).toEqual([])
  })
})

describe('readTextIfPresent', () => {
  it('reads text, and answers undefined for a missing file', async () => {
    const dir = scratch()
    writeFileSync(join(dir, 'a.toml'), 'x = 1\n')
    expect(await Effect.runPromise(readTextIfPresent(join(dir, 'a.toml')))).toBe('x = 1\n')
    expect(await Effect.runPromise(readTextIfPresent(join(dir, 'b.toml')))).toBeUndefined()
  })

  it('fails for a path it cannot read', async () => {
    const result = await Effect.runPromise(Effect.either(readTextIfPresent(scratch())))
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('readBytesIfPresent', () => {
  it('reads bytes, and answers undefined for a missing file', async () => {
    const dir = scratch()
    writeFileSync(join(dir, 'a.png'), new Uint8Array([137, 80, 0, 255]))
    expect(await Effect.runPromise(readBytesIfPresent(join(dir, 'a.png')))).toEqual(
      new Uint8Array([137, 80, 0, 255]),
    )
    expect(await Effect.runPromise(readBytesIfPresent(join(dir, 'b.png')))).toBeUndefined()
  })
})

describe('writeFileAtomically', () => {
  it('creates folders, writes the text and leaves no temp file', async () => {
    const dir = scratch()
    await Effect.runPromise(writeFileAtomically(join(dir, 'generated', 'content.json'), '{}\n'))
    expect(readFileSync(join(dir, 'generated', 'content.json'), 'utf8')).toBe('{}\n')
    expect(readdirSync(join(dir, 'generated'))).toEqual(['content.json'])
  })

  it('writes bytes as they are', async () => {
    const dir = scratch()
    await Effect.runPromise(writeFileAtomically(join(dir, 'page.png'), new Uint8Array([137, 0, 255])))
    expect([...readFileSync(join(dir, 'page.png'))]).toEqual([137, 0, 255])
  })

  it('fails without a temp file when the target cannot be replaced', async () => {
    const dir = scratch()
    mkdirSync(join(dir, 'content.json'))
    const result = await Effect.runPromise(
      Effect.either(writeFileAtomically(join(dir, 'content.json'), '{}')),
    )
    expect(Either.isLeft(result)).toBe(true)
    expect(readdirSync(dir)).toEqual(['content.json'])
  })
})

describe('pathKind', () => {
  it('tells a file from a folder from nothing', async () => {
    const dir = scratch()
    writeFileSync(join(dir, 'a.png'), '')
    expect(await Effect.runPromise(pathKind(join(dir, 'a.png')))).toBe('file')
    expect(await Effect.runPromise(pathKind(dir))).toBe('folder')
    expect(await Effect.runPromise(pathKind(join(dir, 'b.png')))).toBeUndefined()
  })
})
