import { describe, expect, test } from 'vitest'
import type { FieldDef } from '#src/shared/kit/fields/field-types.ts'
import { checkValues, renameFieldValues, valuesWithDefaults } from '#src/shared/kit/fields/field-values.ts'

const npc: readonly FieldDef[] = [
  { id: 'name', type: 'text', required: true },
  { id: 'hp', type: 'int', min: 0, max: 9, default: 3 },
  { id: 'facing', type: 'enum', options: ['N', 'E', 'S', 'W'] },
  { id: 'route', type: 'point', list: true },
  { id: 'door', type: 'ref', to: ['door'] },
]

describe('checkValues', () => {
  test('an instance that fits has no problems, and a field left out is fine when it is not required', () => {
    expect(checkValues(npc, { name: 'Maren' })).toEqual([])
    expect(checkValues(npc, { name: 'Maren', hp: 9, facing: 'S', door: { target: 'inn-door' } })).toEqual([])
  })

  test('a missing required field is fieldMissing', () => {
    expect(checkValues(npc, { hp: 3 })).toEqual([
      expect.objectContaining({ code: 'fieldMissing', fieldId: 'name' }),
    ])
  })

  test('a bad value carries its field id and the field’s own problem code', () => {
    const problems = checkValues(npc, { name: 'Maren', hp: 12, facing: 'up' })
    expect(problems.map((problem) => [problem.fieldId, problem.code])).toEqual([
      ['hp', 'aboveMax'],
      ['facing', 'notAnOption'],
    ])
  })

  test('a bad list item keeps its index and cause', () => {
    const [problem] = checkValues(npc, { name: 'Maren', route: [{ x: 1, y: 1 }, { x: 2 } as never] })
    expect(problem).toMatchObject({ code: 'badListItem', fieldId: 'route', index: 1 })
    expect(problem?.cause?.code).toBe('badPoint')
  })

  test('a value whose id has no field is unknownField, after the field problems and in sorted order', () => {
    const problems = checkValues(npc, { zeta: 1, name: 'Maren', alpha: 2, hp: 99 })
    expect(problems.map((problem) => [problem.fieldId, problem.code])).toEqual([
      ['hp', 'aboveMax'],
      ['alpha', 'unknownField'],
      ['zeta', 'unknownField'],
    ])
  })

  test('an explicit undefined counts as missing', () => {
    expect(checkValues(npc, { name: undefined as never })).toEqual([
      expect.objectContaining({ code: 'fieldMissing', fieldId: 'name' }),
    ])
  })
})

describe('valuesWithDefaults', () => {
  test('fills every missing field that has a default or a zero, in definition order after the given ones', () => {
    const filled = valuesWithDefaults(npc, { name: 'Maren' })
    expect(filled).toEqual({ name: 'Maren', hp: 3, facing: 'N', route: [] })
    expect(Object.keys(filled)).toEqual(['name', 'hp', 'facing', 'route'])
  })

  test('leaves required fields and refs without a default missing', () => {
    const filled = valuesWithDefaults(npc, {})
    expect('name' in filled).toBe(false)
    expect('door' in filled).toBe(false)
  })

  test('keeps the values it was given, unknown ones included', () => {
    expect(valuesWithDefaults(npc, { name: 'Maren', hp: 7, extra: 1 })).toMatchObject({ hp: 7, extra: 1 })
  })

  test('returns the same object when nothing needs filling, and never changes its input', () => {
    const full = { name: 'Maren', hp: 1, facing: 'W' as const, route: [] }
    expect(valuesWithDefaults(npc, full)).toBe(full)
    const given = Object.freeze({ name: 'Maren' })
    expect(() => valuesWithDefaults(npc, given)).not.toThrow()
    expect(given).toEqual({ name: 'Maren' })
  })
})

describe('renameFieldValues', () => {
  test('moves the value to the new id and keeps its place in the key order', () => {
    const renamed = renameFieldValues({ name: 'Maren', hp: 3, facing: 'N' }, 'hp', 'health')
    expect(renamed).toEqual({ name: 'Maren', health: 3, facing: 'N' })
    expect(Object.keys(renamed)).toEqual(['name', 'health', 'facing'])
  })

  test('returns the same object when there is nothing to move', () => {
    const values = { name: 'Maren' }
    expect(renameFieldValues(values, 'hp', 'health')).toBe(values)
    expect(renameFieldValues(values, 'name', 'name')).toBe(values)
  })

  test('the renamed value wins over a stray value already under the new id', () => {
    expect(renameFieldValues({ hp: 3, health: 9 }, 'hp', 'health')).toEqual({ health: 3 })
  })
})
