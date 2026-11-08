// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { seal, unseal } from '../../../src/features/sign-in/server/seal'

const KEY = Buffer.from(new Uint8Array(32).map((_, i) => i + 1)).toString('base64')
const OTHER = Buffer.from(new Uint8Array(32).map((_, i) => 200 - i)).toString('base64')
const random = (n: number): Uint8Array => new Uint8Array(n).map((_, i) => (i * 37 + 11) % 256)

describe('seal and unseal', () => {
  it('gives the value back before it runs out, and nothing after', async () => {
    const sealed = await seal(KEY, 'refresh-token', 5000, random)
    expect(await unseal(KEY, sealed, 4999)).toBe('refresh-token')
    expect(await unseal(KEY, sealed, 5000)).toBeUndefined()
    expect(await unseal(KEY, sealed, 99999)).toBeUndefined()
  })

  it('does not show the value in what it makes', async () => {
    const sealed = await seal(KEY, 'refresh-token', 5000, random)
    expect(sealed).not.toContain('refresh')
    expect(Buffer.from(sealed, 'base64url').toString('latin1')).not.toContain('refresh-token')
  })

  it('does not open under another key, or after one byte is changed', async () => {
    const sealed = await seal(KEY, 'refresh-token', 5000, random)
    expect(await unseal(OTHER, sealed, 1)).toBeUndefined()
    const bytes = Buffer.from(sealed, 'base64url')
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1
    expect(await unseal(KEY, bytes.toString('base64url'), 1)).toBeUndefined()
  })

  it('uses a new iv for every seal', async () => {
    let n = 0
    const counting = (len: number) => new Uint8Array(len).fill(++n)
    const a = await seal(KEY, 'same', 5000, counting)
    const b = await seal(KEY, 'same', 5000, counting)
    expect(a).not.toBe(b)
  })

  it('is undefined for text that was never sealed', async () => {
    expect(await unseal(KEY, 'nonsense', 1)).toBeUndefined()
    expect(await unseal(KEY, '', 1)).toBeUndefined()
  })
})
