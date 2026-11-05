import { describe, expect, it } from 'vitest'
import { locateJsonKeys } from '#src/shared/parse/locate-json-keys.ts'
import { positionOf } from '#src/shared/parse/locate-keys.ts'

describe('locateJsonKeys', () => {
  it('finds each top-level key of an object', () => {
    const index = locateJsonKeys('{\n  "$schema": "x",\n  "content_a": "A"\n}\n')
    expect(index.get('$schema')).toEqual({ line: 2, column: 3 })
    expect(index.get('content_a')).toEqual({ line: 3, column: 3 })
  })

  it('does not take text inside a string value, or keys of a nested value, for a key', () => {
    const index = locateJsonKeys('{"a": "\\"b\\": 1", "c": {"d": 1}, "e": [{"f": 2}], "g": 3}')
    expect([...index.keys()]).toEqual(['a', 'c', 'e', 'g'])
    expect(index.get('g')).toEqual({ line: 1, column: 51 })
  })

  it('reads escapes in a key, and counts a byte order mark as no column', () => {
    const index = locateJsonKeys('\uFEFF{"tab\\tkey": 1,\n "é": 2}')
    expect(index.get('tab\tkey')).toEqual({ line: 1, column: 2 })
    expect(index.get('é')).toEqual({ line: 2, column: 2 })
  })

  it('places an unknown key at the top of the file', () => {
    expect(positionOf(locateJsonKeys('{"a": 1}'), ['z'])).toEqual({ line: 1, column: 1 })
  })
})
