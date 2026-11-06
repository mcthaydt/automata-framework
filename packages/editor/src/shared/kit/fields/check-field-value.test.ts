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

describe('checkFieldValue: enum, color, point, ref', () => {
  const facing: FieldDef = { id: 'facing', type: 'enum', options: ['N', 'E', 'S', 'W'] }

  test('an enum takes one of its options', () => {
    expect(checkFieldValue(facing, 'S')).toBeUndefined()
    expect(checkFieldValue(facing, 'up')?.code).toBe('notAnOption')
    expect(checkFieldValue(facing, 2 as never)?.code).toBe('wrongType')
  })

  test('a color is #rrggbb in either case and nothing shorter', () => {
    const tint: FieldDef = { id: 'tint', type: 'color' }
    expect(checkFieldValue(tint, '#7a9be0')).toBeUndefined()
    expect(checkFieldValue(tint, '#7A9BE0')).toBeUndefined()
    for (const bad of ['#FFF', '7a9be0', '#7a9be0ff', '#gg0000', 'amber']) {
      expect(checkFieldValue(tint, bad)?.code).toBe('badColor')
    }
    expect(checkFieldValue(tint, 0xffffff as never)?.code).toBe('wrongType')
  })

  test('a point has finite x and y and no other shape', () => {
    const spawn: FieldDef = { id: 'spawn', type: 'point' }
    expect(checkFieldValue(spawn, { x: 11, y: 11.5 })).toBeUndefined()
    for (const bad of [{ x: 1 }, { x: 1, y: Number.NaN }, { x: '1', y: 2 }, [1, 2], null]) {
      expect(checkFieldValue(spawn, bad as never)?.code).toBe('badPoint')
    }
    expect(checkFieldValue(spawn, 3 as never)?.code).toBe('badPoint')
  })

  test('a ref has a non-empty target and an optional string container; whether it resolves is not checked here', () => {
    const link: FieldDef = { id: 'link', type: 'ref', to: ['door'] }
    expect(checkFieldValue(link, { target: 'inn-door' })).toBeUndefined()
    expect(checkFieldValue(link, { target: 'inn-door', container: 'Inn' })).toBeUndefined()
    expect(checkFieldValue(link, { target: 'not-in-any-level' })).toBeUndefined()
    for (const bad of [
      { target: '' },
      { target: 4 },
      { container: 'Inn' },
      { target: 'a', container: 3 },
      'inn-door',
      null,
    ]) {
      expect(checkFieldValue(link, bad as never)?.code).toBe('badRef')
    }
  })
})

describe('checkFieldValue: lists', () => {
  const route: FieldDef = { id: 'route', type: 'point', list: true }
  const counts: FieldDef = { id: 'counts', type: 'int', list: true, min: 0 }

  test('a list holds only items that fit the field, and may be empty', () => {
    expect(checkFieldValue(route, [])).toBeUndefined()
    expect(
      checkFieldValue(route, [
        { x: 11, y: 11 },
        { x: 15, y: 11 },
      ]),
    ).toBeUndefined()
    expect(checkFieldValue(counts, [0, 3, 9])).toBeUndefined()
  })

  test('the first bad item is a badListItem with its index and its own problem', () => {
    const problem = checkFieldValue(counts, [1, 2, -3, 1.5])
    expect(problem?.code).toBe('badListItem')
    expect(problem?.index).toBe(2)
    expect(problem?.cause?.code).toBe('belowMin')
    expect(problem?.message).toContain('2')
  })

  test('a value that is not an array is wrongType', () => {
    expect(checkFieldValue(route, { x: 1, y: 2 })?.code).toBe('wrongType')
    expect(checkFieldValue(counts, 3)?.code).toBe('wrongType')
  })

  test('an array is wrongType for a field that is not a list', () => {
    expect(checkFieldValue({ id: 'hp', type: 'int' }, [1])?.code).toBe('wrongType')
    expect(checkFieldValue({ id: 'spawn', type: 'point' }, [{ x: 1, y: 2 }])?.code).toBe('badPoint')
  })

  test('a required list may be empty', () => {
    expect(checkFieldValue({ ...route, required: true }, [])).toBeUndefined()
  })
})
