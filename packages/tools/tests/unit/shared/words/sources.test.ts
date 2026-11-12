import { describe, expect, it } from 'vitest'
import { sourceHash, sourcesFileSchema, wordsState } from '#src/shared/words/sources.ts'

// Each catalog keeps a record of the source every translation was made from, so a changed source reads as stale. The
// record is not a review: nothing approves a translation.

describe('wordsState', () => {
  const record = { a: sourceHash('Play') }

  it('calls a source key with no translation missing', () => {
    expect(wordsState({ a: 'Play', b: 'Back' }, { a: 'Jugar' }, record)).toEqual({
      missing: ['b'],
      stale: [],
    })
  })

  it('calls an empty translation missing, too', () => {
    expect(wordsState({ a: 'Play' }, { a: '  ' }, record)).toEqual({ missing: ['a'], stale: [] })
  })

  it('calls a translation stale when its source changed since it was made', () => {
    expect(wordsState({ a: 'Play now' }, { a: 'Jugar' }, record)).toEqual({ missing: [], stale: ['a'] })
  })

  it('calls a translation with no record stale, so it is made again once', () => {
    expect(wordsState({ a: 'Play' }, { a: 'Jugar' }, {})).toEqual({ missing: [], stale: ['a'] })
  })

  it('leaves a translation whose record matches alone, and sorts both lists', () => {
    expect(wordsState({ a: 'Play' }, { a: 'Jugar' }, record)).toEqual({ missing: [], stale: [] })
    const state = wordsState({ z: 'Z', y: 'Y', x: 'X' }, { z: 'z' }, {})
    expect(state).toEqual({ missing: ['x', 'y'], stale: ['z'] })
  })

  it('ignores a translated key the source no longer has', () => {
    expect(wordsState({ a: 'Play' }, { a: 'Jugar', gone: 'x' }, record)).toEqual({ missing: [], stale: [] })
  })
})

describe('sourceHash', () => {
  it('is the sha256 of the text, in hex', () => {
    expect(sourceHash('Play')).toMatch(/^[0-9a-f]{64}$/)
    expect(sourceHash('Play')).toBe(sourceHash('Play'))
    expect(sourceHash('Play')).not.toBe(sourceHash('Play '))
  })
})

describe('sourcesFileSchema', () => {
  it('reads catalog -> language -> key -> hash', () => {
    const ok = { ui: { ja: { a: sourceHash('Play') } } }
    expect(sourcesFileSchema.safeParse(ok).success).toBe(true)
  })

  it('refuses a value that is not a hash', () => {
    expect(sourcesFileSchema.safeParse({ ui: { ja: { a: 'not a hash' } } }).success).toBe(false)
  })
})
