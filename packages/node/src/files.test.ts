import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { Files, FilesLive } from './files.ts'

const run = <A, E>(effect: Effect.Effect<A, E, Files>): A => Effect.runSync(Effect.provide(effect, FilesLive))
const temp = (): string => mkdtempSync(join(tmpdir(), 'automata-node-files-'))

describe('Files (node:fs)', () => {
  it('writes text, creating parent folders, and reads it back', () => {
    const path = join(temp(), 'a/b/c.txt')
    const text = run(
      Effect.flatMap(Files, (files) => Effect.andThen(files.writeText(path, 'héllo'), files.readText(path))),
    )
    expect(text).toBe('héllo')
  })

  it('says whether a path exists', () => {
    const dir = temp()
    expect(run(Effect.flatMap(Files, (files) => files.exists(dir)))).toBe(true)
    expect(run(Effect.flatMap(Files, (files) => files.exists(join(dir, 'nope'))))).toBe(false)
  })

  it('lists every file below a folder as sorted forward-slash paths', () => {
    const dir = temp()
    const listed = run(
      Effect.gen(function* () {
        const files = yield* Files
        yield* files.writeText(join(dir, 'z.txt'), '')
        yield* files.writeText(join(dir, 'a/b.txt'), '')
        yield* files.writeText(join(dir, 'a/a.txt'), '')
        return yield* files.listFiles(dir)
      }),
    )
    expect(listed).toEqual(['a/a.txt', 'a/b.txt', 'z.txt'])
  })

  it('removes folders recursively and does not mind a missing path', () => {
    const dir = temp()
    run(
      Effect.gen(function* () {
        const files = yield* Files
        yield* files.writeText(join(dir, 'x/y.txt'), '')
        yield* files.remove(join(dir, 'x'))
        yield* files.remove(join(dir, 'never-there'))
      }),
    )
    expect(run(Effect.flatMap(Files, (files) => files.exists(join(dir, 'x'))))).toBe(false)
  })

  it('fails with FileError naming the path when a file cannot be read', () => {
    const path = join(temp(), 'missing.txt')
    const result = run(Effect.either(Effect.flatMap(Files, (files) => files.readText(path))))
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left._tag).toBe('FileError')
    expect(result.left.path).toBe(path)
    expect(result.left.message).toContain(path)
  })

  it('reads a file’s bytes exactly, including bytes that are not UTF-8', () => {
    // 0xff and 0xfe never occur in UTF-8, 0xc3 0x28 is a broken pair, 0x80 a lone continuation byte and
    // 0xe2 0x82 a truncated sequence: decoding these as text would turn each into U+FFFD.
    const written = [0x00, 0xff, 0xfe, 0xc3, 0x28, 0x80, 0xe2, 0x82, 0x41, 0x0a]
    const path = join(temp(), 'image.bin')
    writeFileSync(path, new Uint8Array(written))
    const bytes = run(Effect.flatMap(Files, (files) => files.readBytes(path)))
    // A plain Uint8Array that owns its bytes, not a Buffer that may be a view into Node's shared pool.
    expect(bytes).toStrictEqual(new Uint8Array(written))
    expect(bytes.buffer.byteLength).toBe(written.length)
  })

  it('fails with FileError naming the path when a file’s bytes cannot be read', () => {
    const path = join(temp(), 'missing.bin')
    const result = run(Effect.either(Effect.flatMap(Files, (files) => files.readBytes(path))))
    if (Either.isRight(result)) throw new Error('expected a failure')
    expect(result.left._tag).toBe('FileError')
    expect(result.left.path).toBe(path)
    expect(result.left.message).toContain(path)
  })
})
