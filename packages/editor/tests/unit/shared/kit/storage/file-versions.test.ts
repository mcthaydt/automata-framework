import { describe, expect, test, vi } from 'vitest'
import { createFileVersions } from '#src/shared/kit/storage/file-versions.ts'
import type { FileLike } from '#src/shared/kit/storage/handle-store.ts'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

/** A file whose bytes are counted when read, so a test can say they were not. */
function file(lastModified: number, text: string): FileLike & { reads: () => number } {
  const data = bytes(text)
  const arrayBuffer = vi.fn(async () => data.slice().buffer)
  return { lastModified, size: data.byteLength, arrayBuffer, reads: () => arrayBuffer.mock.calls.length }
}

describe('file versions', () => {
  test('a file never written or read is its lastModified, and its bytes are not read', async () => {
    const versions = createFileVersions()
    const seen = file(5000, 'one')
    expect(await versions.observe('a.txt', seen)).toBe(5000)
    expect(seen.reads()).toBe(0)
  })

  test('a file whose clock moved past what the store saw is its lastModified, and its bytes are not read', async () => {
    const versions = createFileVersions()
    expect(await versions.wrote('a.txt', 5000, bytes('one'), undefined)).toBe(5000)
    const later = file(6000, 'two')
    expect(await versions.observe('a.txt', later)).toBe(6000)
    expect(later.reads()).toBe(0)
  })

  test('the same lastModified and size are checked against the bytes the store saw', async () => {
    const versions = createFileVersions()
    const token = await versions.wrote('a.txt', 5000, bytes('one'), undefined)
    const same = file(5000, 'one')
    expect(await versions.observe('a.txt', same)).toBe(token)
    expect(same.reads()).toBe(1)
    const changed = file(5000, 'two')
    expect(await versions.observe('a.txt', changed)).toBe(token + 1)
  })

  test('the same lastModified with another size is a change, and a later look at it keeps its new token', async () => {
    const versions = createFileVersions()
    const token = await versions.wrote('a.txt', 5000, bytes('one'), undefined)
    expect(await versions.observe('a.txt', file(5000, 'longer'))).toBe(token + 1)
    expect(await versions.observe('a.txt', file(5000, 'longer'))).toBe(token + 1)
  })

  test('a write in the same tick as the token before it gets the next token', async () => {
    const versions = createFileVersions()
    expect(await versions.wrote('a.txt', 5000, bytes('one'), 5000)).toBe(5001)
    expect(await versions.wrote('a.txt', 5000, bytes('two'), 5001)).toBe(5002)
  })

  test('a removed file keeps its token, so the next one at that path never repeats it', async () => {
    const versions = createFileVersions()
    await versions.wrote('a.txt', 5000, bytes('one'), undefined)
    versions.removed('a.txt')
    expect(await versions.wrote('a.txt', 5000, bytes('two'), undefined)).toBe(5001)
  })
})
