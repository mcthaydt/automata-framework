import { describe, expect, test } from 'vitest'
import { checkFieldValue } from './check-field-value'
import type { FieldDef } from './field-types'

const hp: FieldDef = { id: 'hp', type: 'int', min: 0, max: 9 }

describe('checkFieldValue: numbers', () => {
  test('an int in range fits, bounds included', () => {
    expect(checkFieldValue(hp, 0)).toBeUndefined()
    expect(checkFieldValue(hp, 9)).toBeUndefined()
    expect(checkFieldValue(hp, 5)).toBeUndefined()
  })

  test('an int outside its bounds is belowMin or aboveMax', () => {
    expect(checkFieldValue(hp, -1)?.code).toBe('belowMin')
    expect(checkFieldValue(hp, 12)?.code).toBe('aboveMax')
  })

  test('an int that is not whole is notInteger', () => {
    expect(checkFieldValue(hp, 1.5)?.code).toBe('notInteger')
  })

  test('a float takes fractions and the same bounds', () => {
    const speed: FieldDef = { id: 'speed', type: 'float', min: 0.5, max: 2 }
    expect(checkFieldValue(speed, 1.25)).toBeUndefined()
    expect(checkFieldValue(speed, 0.25)?.code).toBe('belowMin')
    expect(checkFieldValue(speed, 2.5)?.code).toBe('aboveMax')
  })

  test('a number field with no bounds takes any finite number', () => {
    expect(checkFieldValue({ id: 'x', type: 'float' }, -1e9)).toBeUndefined()
    expect(checkFieldValue({ id: 'x', type: 'int' }, 1e9)).toBeUndefined()
  })

  test('NaN, the infinities and non-numbers are wrongType, because a project file cannot hold them', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '3', true, null, undefined, {}]) {
      expect(checkFieldValue(hp, bad as never)?.code).toBe('wrongType')
    }
    expect(checkFieldValue({ id: 'x', type: 'float' }, Number.NaN)?.code).toBe('wrongType')
  })

  test('an angle is any finite number of degrees and is not bounded', () => {
    const facing: FieldDef = { id: 'facing', type: 'angle' }
    expect(checkFieldValue(facing, -450)).toBeUndefined()
    expect(checkFieldValue(facing, 720.5)).toBeUndefined()
    expect(checkFieldValue(facing, '90' as never)?.code).toBe('wrongType')
  })

  test('the message says what was wrong', () => {
    expect(checkFieldValue(hp, 12)?.message).toContain('9')
    expect(checkFieldValue(hp, '3' as never)?.message).toContain('hp')
  })
})

describe('checkFieldValue: bool and text', () => {
  test('a bool is true or false', () => {
    const open: FieldDef = { id: 'open', type: 'bool' }
    expect(checkFieldValue(open, true)).toBeUndefined()
    expect(checkFieldValue(open, false)).toBeUndefined()
    expect(checkFieldValue(open, 0 as never)?.code).toBe('wrongType')
  })

  test('text is any string, the empty one too', () => {
    const name: FieldDef = { id: 'name', type: 'text' }
    expect(checkFieldValue(name, '')).toBeUndefined()
    expect(checkFieldValue(name, 'Maren')).toBeUndefined()
    expect(checkFieldValue(name, 7 as never)?.code).toBe('wrongType')
  })
})
