// @vitest-environment node
// The share link (spec §5.6): `#code=1.<payload>`, the UTF-8 source compressed with deflate-raw, in base64url; decoding
// stops at MAX_SHARED_SOURCE_BYTES decompressed and refuses a fragment longer than MAX_FRAGMENT_CHARS.
import { describe, expect, it } from 'vitest'
import {
  decodeShare,
  encodeShare,
  MAX_FRAGMENT_CHARS,
  MAX_SHARED_SOURCE_BYTES,
  ShareError,
} from '../../src/lib/playground/share'

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return Buffer.from(await new Response(stream).arrayBuffer()).toString('base64url')
}

describe('the share link', () => {
  it('round-trips the source, non-ASCII text included', async () => {
    const source = "const name = 'Ünïcödé 日本 🎮'\nexport default 1\n"
    const fragment = await encodeShare(source)
    expect(fragment).toMatch(/^code=1\.[A-Za-z0-9_-]+$/)
    expect(await decodeShare('#' + fragment)).toBe(source)
  })

  it('has nothing to decode without a code fragment', async () => {
    expect(await decodeShare('')).toBeUndefined()
    expect(await decodeShare('#top')).toBeUndefined()
  })

  it('refuses a corrupted payload', async () => {
    await expect(decodeShare('#code=1.not*base64')).rejects.toBeInstanceOf(ShareError)
    await expect(
      decodeShare('#code=1.' + Buffer.from('plainly not deflate').toString('base64url')),
    ).rejects.toBeInstanceOf(ShareError)
  })

  it('refuses an unknown format', async () => {
    const [, payload] = (await encodeShare('x')).split('.')
    await expect(decodeShare('#code=2.' + payload)).rejects.toBeInstanceOf(ShareError)
  })

  it('stops decompressing past the byte limit', async () => {
    const payload = await deflate(new Uint8Array(MAX_SHARED_SOURCE_BYTES + 1).fill(0x61))
    expect(payload.length).toBeLessThan(MAX_FRAGMENT_CHARS)
    await expect(decodeShare('#code=1.' + payload)).rejects.toBeInstanceOf(ShareError)
    const fits = await deflate(new Uint8Array(MAX_SHARED_SOURCE_BYTES).fill(0x61))
    expect(await decodeShare('#code=1.' + fits)).toHaveLength(MAX_SHARED_SOURCE_BYTES)
  })

  it('refuses a fragment longer than the character limit', async () => {
    await expect(decodeShare('#code=1.' + 'A'.repeat(MAX_FRAGMENT_CHARS))).rejects.toBeInstanceOf(ShareError)
  })

  it('refuses bytes that are not UTF-8', async () => {
    await expect(
      decodeShare('#code=1.' + (await deflate(new Uint8Array([0xff, 0xfe, 0x00])))),
    ).rejects.toBeInstanceOf(ShareError)
  })
})
