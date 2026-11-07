import { describe, expect, it } from 'vitest'
import { parseCoreRef } from './core-ref.ts'

// Test 1 (PRODUCT.5e): core.ref names the framework commit Plus builds core from. Only a full commit is a pin: a
// branch or a tag moves, and a short hash can become ambiguous, so either would let core change under Plus.

const COMMIT = 'b7ef19d978d4751eaf08d1374dcfbcf2459d8c2b'

describe('parseCoreRef', () => {
  it('reads a full commit, with or without the final newline', () => {
    expect(parseCoreRef(`${COMMIT}\n`)).toBe(COMMIT)
    expect(parseCoreRef(COMMIT)).toBe(COMMIT)
  })

  it.each([
    ['a branch name', 'main\n'],
    ['a tag', 'v0.1.0\n'],
    ['a short hash', `${COMMIT.slice(0, 12)}\n`],
    ['39 characters', `${COMMIT.slice(0, 39)}\n`],
    ['41 characters', `${COMMIT}0\n`],
    ['upper-case hex', `${COMMIT.toUpperCase()}\n`],
    ['a non-hex character', `${COMMIT.slice(0, 39)}g\n`],
    ['a leading space', ` ${COMMIT}\n`],
    ['a trailing space', `${COMMIT} \n`],
    ['a comment after the commit', `${COMMIT} # AF main\n`],
    ['a second line', `${COMMIT}\nmain\n`],
    ['a blank second line', `${COMMIT}\n\n`],
    ['a Windows line ending', `${COMMIT}\r\n`],
    ['an empty file', ''],
  ])('rejects %s and says what it found', (_case, text) => {
    expect(() => parseCoreRef(text)).toThrow(
      `core.ref must hold one full commit (40 lower-case hex characters) and nothing else; found ${JSON.stringify(text)}`,
    )
  })
})
