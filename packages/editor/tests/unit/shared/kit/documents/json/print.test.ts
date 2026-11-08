// @vitest-environment node
// The `formatJsonNumber` case of The Last Light editor/tests/json-edit.test.ts (92e6704), and the scalar printing
// the model diff uses for a value it has to write.
import { describe, expect, it } from 'vitest'
import { scan } from '#src/shared/kit/documents/json/locate.ts'
import { formatJsonNumber, formatJsonScalar, JsonWriteError } from '#src/shared/kit/documents/json/print.ts'
import { FIXTURE_NAMES, loadFixture } from '#src/shared/kit/documents/testing/fixtures.ts'

describe('formatJsonNumber', () => {
  it('writes no exponent and trims float noise to 4 decimals', () => {
    expect(formatJsonNumber(0.1 + 0.2)).toBe('0.3')
    expect(formatJsonNumber(-1.23456)).toBe('-1.2346')
    expect(formatJsonNumber(-0.00001)).toBe('0')
    expect(formatJsonNumber(12)).toBe('12')
    expect(formatJsonNumber(0.0001)).toBe('0.0001')
    expect(() => formatJsonNumber(Number.NaN)).toThrow(JsonWriteError)
    expect(() => formatJsonNumber(1e22)).toThrow(/exponent/)
  })

  it('refuses infinity and writes a negative zero as 0', () => {
    expect(() => formatJsonNumber(Number.POSITIVE_INFINITY)).toThrow(JsonWriteError)
    expect(formatJsonNumber(-0)).toBe('0')
  })

  for (const name of FIXTURE_NAMES) {
    it(`${name}: prints each number the file already has as the same number`, () => {
      const numbers = scan(loadFixture(name)).literals.filter((literal) => literal.kind === 'number')
      for (const literal of numbers) {
        const decimals = literal.text.split('.')[1]?.length ?? 0
        if (decimals > 4 || /e/i.test(literal.text)) continue
        expect(Number(formatJsonNumber(literal.value as number))).toBe(
          literal.value === 0 ? 0 : literal.value,
        )
      }
    })
  }
})

describe('formatJsonScalar', () => {
  it('writes strings as JSON strings, booleans and null as words, numbers through formatJsonNumber', () => {
    expect(formatJsonScalar('hall')).toBe('"hall"')
    expect(formatJsonScalar('a "b" \\ c\nd')).toBe('"a \\"b\\" \\\\ c\\nd"')
    expect(formatJsonScalar('café')).toBe('"café"')
    expect(formatJsonScalar(true)).toBe('true')
    expect(formatJsonScalar(false)).toBe('false')
    expect(formatJsonScalar(null)).toBe('null')
    expect(formatJsonScalar(0.1 + 0.2)).toBe('0.3')
  })

  it('refuses what is not a scalar', () => {
    expect(() => formatJsonScalar({} as never)).toThrow(JsonWriteError)
    expect(() => formatJsonScalar(undefined as never)).toThrow(JsonWriteError)
  })
})
