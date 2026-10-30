// @vitest-environment node
// The `listJsonLiterals` case of The Last Light editor/tests/json-edit.test.ts (92e6704), run on the scanner that
// replaces TypeScript's JSON parser, and four independent checks that the scanner reads spans the way it should.
import { describe, expect, it } from 'vitest'
import { FIXTURE_NAMES, loadFixture, loadGolden } from '../testing/fixtures'
import { type JsonPath, JsonScanError, scan } from './locate'

const SAMPLE = `{
  "scene": "x", "n": 1,
  "rooms": [
    { "id": "a", "floor": 0, "corners": [[-1.475, -0.875, { "next": "b" }], [2, 3.0]] }
  ],
  "light": 1.2
}
`

const at = (value: unknown, path: JsonPath): unknown =>
  path.reduce<unknown>((node, step) => (node as Record<string | number, unknown>)[step], value)

describe('scan', () => {
  it('lists each number with its path and span, minus included', () => {
    const numbers = scan(SAMPLE).literals.filter((literal) => literal.kind === 'number')
    expect(numbers.map((literal) => [literal.path, literal.text, literal.value])).toEqual([
      [['n'], '1', 1],
      [['rooms', 0, 'floor'], '0', 0],
      [['rooms', 0, 'corners', 0, 0], '-1.475', -1.475],
      [['rooms', 0, 'corners', 0, 1], '-0.875', -0.875],
      [['rooms', 0, 'corners', 1, 0], '2', 2],
      [['rooms', 0, 'corners', 1, 1], '3.0', 3],
      [['light'], '1.2', 1.2],
    ])
    for (const literal of numbers)
      expect(SAMPLE.slice(literal.span.start, literal.span.end)).toBe(literal.text)
  })

  it('lists strings, booleans and null as literals too, in document order', () => {
    const literals = scan('{"a": "x", "b": [true, false, null], "c": -0}').literals
    expect(literals.map((literal) => [literal.path, literal.kind, literal.value])).toEqual([
      [['a'], 'string', 'x'],
      [['b', 0], 'boolean', true],
      [['b', 1], 'boolean', false],
      [['b', 2], 'null', null],
      [['c'], 'number', -0],
    ])
  })

  it('gives every container the span of its braces and every member the span of its quoted key', () => {
    const text = '{ "a": { "b": [1, 2] }, "c": 3 }'
    const result = scan(text)
    expect(result.root.kind).toBe('object')
    expect(text.slice(result.root.span.start, result.root.span.end)).toBe(text)
    const a = result.node(['a'])
    expect(a && text.slice(a.span.start, a.span.end)).toBe('{ "b": [1, 2] }')
    expect(a?.keySpan && text.slice(a.keySpan.start, a.keySpan.end)).toBe('"a"')
    const list = result.node(['a', 'b'])
    expect(list?.kind).toBe('array')
    expect(list && text.slice(list.span.start, list.span.end)).toBe('[1, 2]')
    expect(list?.children.map((child) => text.slice(child.span.start, child.span.end))).toEqual(['1', '2'])
    expect(list?.children[0]?.keySpan).toBeUndefined()
    expect(result.root.children.map((child) => child.path)).toEqual([['a'], ['c']])
    expect(result.node(['a', 'missing'])).toBeUndefined()
  })

  it('keeps the escaped text of a string literal and the decoded value', () => {
    const [literal] = scan('"a\\"b\\u00e9"').literals
    expect(literal?.text).toBe('"a\\"b\\u00e9"')
    expect(literal?.value).toBe('a"bé')
  })

  describe('against Last Light, on the five shipped files', () => {
    const golden = JSON.parse(loadGolden('literals')) as Record<string, [JsonPath, number, number][]>
    for (const name of FIXTURE_NAMES) {
      const text = loadFixture(name)

      it(`${name}: its number spans are the ones Last Light's TypeScript-based scanner reported`, () => {
        const numbers = scan(text).literals.filter((literal) => literal.kind === 'number')
        expect(numbers.map((literal) => [literal.path, literal.span.start, literal.span.end])).toEqual(
          golden[name],
        )
      })

      it(`${name}: every literal's span parses to the value JSON.parse finds at its path`, () => {
        const document = JSON.parse(text)
        const literals = scan(text).literals
        expect(literals.length).toBeGreaterThan(10)
        for (const literal of literals) {
          expect(JSON.parse(text.slice(literal.span.start, literal.span.end))).toEqual(literal.value)
          expect(at(document, literal.path)).toEqual(literal.value)
        }
      })
    }
  })

  describe('accepts what JSON.parse accepts', () => {
    const valid = [
      '1e3',
      '-0',
      '"\\u00e9"',
      '[]',
      '{}',
      '[[],{}]',
      '{"a":{"b":{}}}',
      '\t[ 1 ,\r\n 2 ]\n',
      'true',
      'null',
      '0.5E-2',
    ]
    for (const text of valid) {
      it(JSON.stringify(text), () => {
        expect(() => JSON.parse(text)).not.toThrow()
        expect(() => scan(text)).not.toThrow()
      })
    }
  })

  describe('refuses what JSON.parse refuses, with an offset inside the text', () => {
    const invalid: [string, string][] = [
      ['a trailing comma in an array', '[1, 2,]'],
      ['a trailing comma in an object', '{"a": 1,}'],
      ['single quotes', "{'a': 1}"],
      ['a comment', '{"a": 1 /* x */}'],
      ['a leading zero', '[01]'],
      ['a number with no integer part', '[.5]'],
      ['NaN', '[NaN]'],
      ['a raw newline inside a string', '"a\nb"'],
      ['an unterminated string', '"abc'],
      ['a missing colon', '{"a" 1}'],
      ['trailing garbage', '{"a": 1} x'],
      ['a no-break space as whitespace', '[1, 2]'],
      ['a byte order mark', '﻿{}'],
      ['a bad escape', '"\\q"'],
      ['empty input', ''],
      ['only whitespace', '  \n'],
    ]
    for (const [what, text] of invalid) {
      it(what, () => {
        expect(() => JSON.parse(text)).toThrow()
        try {
          scan(text)
          expect.unreachable('scan accepted the text')
        } catch (error) {
          expect(error).toBeInstanceOf(JsonScanError)
          expect((error as JsonScanError).offset).toBeGreaterThanOrEqual(0)
          expect((error as JsonScanError).offset).toBeLessThanOrEqual(text.length)
        }
      })
    }
  })

  it('refuses a duplicate key in one object, naming the key', () => {
    expect(() => scan('{"a": 1, "b": {"c": 1, "c": 2}}')).toThrow(/duplicate key "c"/)
    expect(() => scan('{"a": {"c": 1}, "b": {"c": 2}}')).not.toThrow()
  })
})
