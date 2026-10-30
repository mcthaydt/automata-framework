// @vitest-environment node
import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import { JsonWriteError } from '../json/print'
import { writeTomlScalar } from './toml-scalar'

/** The value a written literal reads back as, through the same parser the documents use. */
const readBack = (literal: string): unknown => parse(`v = ${literal}`).v

describe('writeTomlScalar', () => {
  it('writes a number by the kit rule: no exponent, float noise trimmed to four decimals', () => {
    expect(writeTomlScalar(0.1 + 0.2, '1')).toBe('0.3')
    expect(writeTomlScalar(357, '356')).toBe('357')
    expect(writeTomlScalar(-1341.25, '-1341')).toBe('-1341.25')
    expect(writeTomlScalar(0.000001, '1')).toBe('0')
  })

  it('keeps a float literal a float when the new number is whole', () => {
    expect(writeTomlScalar(357, '356.0')).toBe('357.0')
    expect(writeTomlScalar(2, '1.5e3')).toBe('2.0')
    expect(writeTomlScalar(-0, '0.5')).toBe('0.0')
    expect(readBack(writeTomlScalar(357, '356.0'))).toBe(357)
  })

  it('writes an integer literal given a fraction as a float', () => {
    expect(writeTomlScalar(48.5, '48')).toBe('48.5')
  })

  it('refuses a number it cannot write without an exponent, and a number that is not finite', () => {
    expect(() => writeTomlScalar(1e21, '1')).toThrow(JsonWriteError)
    expect(() => writeTomlScalar(Number.NaN, '1.0')).toThrow(JsonWriteError)
    expect(() => writeTomlScalar(Number.POSITIVE_INFINITY, 'inf')).toThrow(JsonWriteError)
  })

  it('writes a bigint as an integer', () => {
    expect(writeTomlScalar(9007199254740993n, '1')).toBe('9007199254740993')
  })

  it('writes booleans', () => {
    expect(writeTomlScalar(true, 'false')).toBe('true')
    expect(writeTomlScalar(false, undefined)).toBe('false')
  })

  it('keeps a literal string literal when the new text allows it', () => {
    expect(writeTomlScalar('C:\\games', "'C:\\old'")).toBe("'C:\\games'")
    expect(writeTomlScalar("it's", "'old'")).toBe('"it\'s"')
    expect(writeTomlScalar('two\nlines', "'old'")).toBe('"two\\nlines"')
  })

  it('writes a basic string with the escapes TOML requires, and reads back as the same text', () => {
    const texts = [
      'plain',
      'quote " here',
      'back \\ slash',
      'tab\there',
      'bell\u0007',
      'del\u007f',
      'ünïcode 😀',
      '',
    ]
    for (const text of texts) {
      const literal = writeTomlScalar(text, '"old"')
      expect(literal.startsWith('"'), text).toBe(true)
      expect(readBack(literal), text).toBe(text)
    }
    expect(writeTomlScalar('del\u007f', '"old"')).toBe('"del\\u007F"')
  })

  it('writes an edited multi-line string as a one-line basic string', () => {
    expect(writeTomlScalar('a\nb', '"""\nold\n"""')).toBe('"a\\nb"')
    expect(writeTomlScalar('a', "'''old'''")).toBe('"a"')
  })
})
