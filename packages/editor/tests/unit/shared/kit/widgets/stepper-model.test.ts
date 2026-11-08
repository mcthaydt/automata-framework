import { describe, expect, test } from 'vitest'
import { parseNumberText, scrubbedValue, steppedValue } from '#src/shared/kit/widgets/stepper-model.ts'

describe('parseNumberText', () => {
  test('accepts plain decimal numbers, with surrounding space and an exponent', () => {
    expect(parseNumberText('12', {})).toEqual({ ok: true, value: 12 })
    expect(parseNumberText(' 3.5 ', {})).toEqual({ ok: true, value: 3.5 })
    expect(parseNumberText('-0.25', {})).toEqual({ ok: true, value: -0.25 })
    expect(parseNumberText('.5', {})).toEqual({ ok: true, value: 0.5 })
    expect(parseNumberText('1e2', {})).toEqual({ ok: true, value: 100 })
  })

  test('refuses text that is not a number', () => {
    for (const text of ['', '  ', 'abc', '1,5', '0x10', '1 2', 'Infinity', 'NaN', '--1']) {
      expect(parseNumberText(text, {})).toEqual({ ok: false, message: 'Enter a number' })
    }
  })

  test('refuses values outside the bounds, naming the bound', () => {
    expect(parseNumberText('0', { min: 1, max: 9 })).toEqual({ ok: false, message: 'Must be at least 1' })
    expect(parseNumberText('10', { min: 1, max: 9 })).toEqual({ ok: false, message: 'Must be at most 9' })
    expect(parseNumberText('9', { min: 1, max: 9 })).toEqual({ ok: true, value: 9 })
  })

  test('refuses a fraction when only whole numbers are allowed', () => {
    expect(parseNumberText('2.5', { integer: true })).toEqual({ ok: false, message: 'Whole numbers only' })
    expect(parseNumberText('2', { integer: true })).toEqual({ ok: true, value: 2 })
  })
})

describe('steppedValue', () => {
  test('moves by whole steps and rounds to the step decimals', () => {
    expect(steppedValue(0.2, 1, { step: 0.1 })).toBe(0.3)
    expect(steppedValue(0.3, -3, { step: 0.1 })).toBe(0)
    expect(steppedValue(5, 10, { step: 1 })).toBe(15)
  })

  test('clamps to the bounds', () => {
    expect(steppedValue(8, 5, { step: 1, max: 10 })).toBe(10)
    expect(steppedValue(2, -5, { step: 1, min: 0 })).toBe(0)
  })
})

describe('scrubbedValue', () => {
  const rules = { step: 1, pixelsPerStep: 4 }

  test('a drag moves one step per pixelsPerStep from where it began', () => {
    expect(scrubbedValue(10, 40, rules)).toBe(20)
    expect(scrubbedValue(10, -40, rules)).toBe(0)
    expect(scrubbedValue(10, 3, rules)).toBe(10)
    expect(scrubbedValue(10, 4, rules)).toBe(11)
    expect(scrubbedValue(10, -7, rules)).toBe(9)
  })

  test('uses the step, rounds its decimals and clamps', () => {
    expect(scrubbedValue(0.5, 12, { step: 0.1, pixelsPerStep: 4 })).toBe(0.8)
    expect(scrubbedValue(5, 400, { ...rules, max: 9 })).toBe(9)
    expect(scrubbedValue(5, -400, { ...rules, min: 2 })).toBe(2)
  })

  test('a value off the step grid moves in whole steps from itself', () => {
    expect(scrubbedValue(0.25, 8, { step: 0.5, pixelsPerStep: 4 })).toBe(1.25)
  })
})
