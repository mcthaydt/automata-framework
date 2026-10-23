import { describe, expect, it } from 'vitest'
import { richProjectFile } from '../testing/projects'
import { findJsonError } from './json-syntax'
import { decodeProject, printProject } from './project-codec'

describe('findJsonError', () => {
  it('finds nothing in valid JSON', () => {
    const valid = [
      '{}',
      '[]',
      ' \n\t\r{"a":[1,-2.5e+3,true,false,null,"x\\n\\u00e9\\"\\/"]}\n',
      '0',
      '-0',
      '"a lone string"',
      '{"nested":{"deeper":{"deepest":[[[]]]}}}',
    ]
    for (const text of valid) expect(findJsonError(text), text).toBeUndefined()
  })

  // [text, line, column, what the message mentions]; both counted from 1, in UTF-16 code units.
  const malformed: [string, number, number, RegExp][] = [
    ['', 1, 1, /end of input/],
    ['   ', 1, 4, /end of input/],
    ['{"a": }', 1, 7, /unexpected/i],
    ['{"a" 1}', 1, 6, /":"/],
    ['{"a":1,}', 1, 8, /key/],
    ['{a: 1}', 1, 2, /key/],
    ['[1,2', 1, 5, /end of input/],
    ['[1 2]', 1, 4, /","/],
    ['{"a": "x', 1, 9, /end of input/],
    ['{\r\n"a":}', 2, 5, /unexpected/i],
    ['{\n  "a": 1,\n  "b": tru\n}', 3, 11, /unexpected/i],
    ['01', 1, 2, /number/],
    ['1.', 1, 3, /number/],
    ['-', 1, 2, /number/],
    ['1e', 1, 3, /number/],
    ['"\\x"', 1, 3, /escape/],
    ['"\\u12G4"', 1, 6, /escape/],
    ['"a\nb"', 1, 3, /control/i],
    ['{} x', 1, 4, /after the value/],
    ['{"a":1} {"b":2}', 1, 9, /after the value/],
    ["{'a': 1}", 1, 2, /key/],
    ['[1,]', 1, 4, /unexpected/i],
  ]
  it.each(malformed)('%j fails at line %i, column %i', (text, line, column, message) => {
    const error = findJsonError(text)
    expect(error, text).toMatchObject({ line, column })
    expect(error?.message).toMatch(message)
  })

  it('refuses nesting deeper than any project needs, without overflowing the stack', () => {
    const error = findJsonError('['.repeat(100_000))
    expect(error?.message).toMatch(/nested/i)
  })

  it('agrees with JSON.parse about which texts are valid, over seeded edits of real files', () => {
    const base = printProject(richProjectFileDecoded())
    let state = 12345
    const next = (limit: number): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state % limit
    }
    const noise = ['"', '{', '}', '[', ']', ',', ':', '\\', '0', '-', 'e', ' ', '\n', 'x']
    let rejected = 0
    for (let round = 0; round < 3000; round++) {
      const at = next(base.length)
      const edit = next(3)
      const piece = noise[next(noise.length)] ?? ''
      const text =
        edit === 0
          ? base.slice(0, at) + base.slice(at + 1)
          : edit === 1
            ? base.slice(0, at) + piece + base.slice(at)
            : base.slice(0, at) + piece + base.slice(at + 1)
      let parses = true
      try {
        JSON.parse(text)
      } catch {
        parses = false
      }
      if (!parses) rejected++
      expect(findJsonError(text) === undefined, `edit ${round} at ${at}`).toBe(parses)
    }
    expect(rejected).toBeGreaterThan(500)
  })
})

function richProjectFileDecoded() {
  const result = decodeProject(richProjectFile())
  if (!result.ok) throw new Error('the rich fixture should decode')
  return result.project
}
