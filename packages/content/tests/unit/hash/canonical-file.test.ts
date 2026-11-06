import { describe, expect, it } from 'vitest'
import { canonicalFile } from '#src/hash/canonical-file.ts'

// Ported from FloorFifty tests/content/determinism.test.ts "canonicalizeValue" (122a220).
describe('canonicalFile', () => {
  it('sorts keys recursively, keeps array order, and ends with one newline', () => {
    expect(canonicalFile({ b: 1, a: { d: [3, 1, 2], c: 4 } })).toBe(
      '{\n  "a": {\n    "c": 4,\n    "d": [\n      3,\n      1,\n      2\n    ]\n  },\n  "b": 1\n}\n',
    )
  })

  it('sorts by code unit, not by locale', () => {
    // localeCompare would put "a" before "B"; the code-unit order is the same on every machine.
    expect(canonicalFile({ a: 1, B: 2, $schema: 3 })).toBe('{\n  "$schema": 3,\n  "B": 2,\n  "a": 1\n}\n')
  })
})
