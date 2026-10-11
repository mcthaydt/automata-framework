import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { listFiles, readTextIfPresent, writeFileAtomically } from './content-files'

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

describe('writeFileAtomically', () => {
  it('creates folders, writes the text and leaves no temp file', async () => {
    const dir = scratch()
    await Effect.runPromise(writeFileAtomically(join(dir, 'generated', 'content.json'), '{}\n'))
    expect(readFileSync(join(dir, 'generated', 'content.json'), 'utf8')).toBe('{}\n')
    expect(readdirSync(join(dir, 'generated'))).toEqual(['content.json'])
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
