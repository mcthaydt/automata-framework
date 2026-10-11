import { expect, test } from 'vitest'
import { canonicalJson, utf8 } from './canonical'

test('object keys are sorted at every depth; arrays keep their order', () => {
  expect(canonicalJson({ b: 1, a: { d: [3, 1], c: true } })).toBe('{"a":{"c":true,"d":[3,1]},"b":1}')
})

test('equal values with different insertion order serialize identically', () => {
  expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }))
})

test('strings are JSON-escaped; null is kept', () => {
  expect(canonicalJson({ s: 'a"b\n', n: null })).toBe('{"n":null,"s":"a\\"b\\n"}')
})

test.each([
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['undefined', undefined],
  ['bigint', 1n],
  ['function', () => 1],
])('rejects %s (not representable canonically)', (_name, v) => {
  expect(() => canonicalJson({ v })).toThrow(/canonicalJson/)
})

test('utf8 encodes 1-, 2-, 3- and 4-byte code points and lone surrogates as U+FFFD', () => {
  expect([...utf8('aé€😀')]).toEqual([0x61, 0xc3, 0xa9, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80])
  expect([...utf8('\ud800')]).toEqual([0xef, 0xbf, 0xbd])
})

test('-0 is written as -0, so it survives a JSON round trip (audit, spec M2.1 §10.1)', () => {
  expect(canonicalJson(-0)).toBe('-0')
  expect(canonicalJson({ a: [-0, 0] })).toBe('{"a":[-0,0]}')
  expect(Object.is(JSON.parse(canonicalJson(-0)), -0)).toBe(true)
})
