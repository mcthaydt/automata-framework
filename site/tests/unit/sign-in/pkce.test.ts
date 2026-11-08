// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { pkcePair } from '../../../src/features/sign-in/server/pkce'

describe('pkcePair', () => {
  it('makes a verifier of 43 URL-safe characters and its S256 challenge', async () => {
    const { verifier, challenge } = await pkcePair((n) => new Uint8Array(n).fill(7))
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  it('makes a different pair from different randomness', async () => {
    const a = await pkcePair((n) => new Uint8Array(n).fill(1))
    const b = await pkcePair((n) => new Uint8Array(n).fill(2))
    expect(a.verifier).not.toBe(b.verifier)
  })
})
