import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { describe, expect, it } from 'vitest'
import { contentHash } from '#src/hash/content-hash.ts'

describe('contentHash', () => {
  it("is the sim's XXH64 of the sim's canonical JSON, so the sim can check it on restore", () => {
    const data = { song: { 'dusk-run': { bpm: 120 } }, tuning: { GRAVITY: -275 } }
    expect(contentHash(data)).toBe(hex64(xxhash64(utf8(canonicalJson(data)))))
    expect(contentHash(data)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('ignores key order and sees any value change', () => {
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }))
    expect(contentHash({ a: 1, b: [1, 2] })).not.toBe(contentHash({ a: 1, b: [2, 1] }))
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }))
  })
})
