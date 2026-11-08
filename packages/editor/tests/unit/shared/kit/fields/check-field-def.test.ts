import { describe, expect, test } from 'vitest'
import { checkEntityDef, checkFieldDef, defaultFieldValue } from '#src/shared/kit/fields/check-field-def.ts'
import type { EntityDef, FieldDef } from '#src/shared/kit/fields/field-types.ts'

const codes = (def: FieldDef): string[] => checkFieldDef(def).map((problem) => problem.code)

describe('defaultFieldValue', () => {
  test('is the type’s zero when the field has no default', () => {
    expect(defaultFieldValue({ id: 'a', type: 'int' })).toBe(0)
    expect(defaultFieldValue({ id: 'a', type: 'float' })).toBe(0)
    expect(defaultFieldValue({ id: 'a', type: 'angle' })).toBe(0)
    expect(defaultFieldValue({ id: 'a', type: 'bool' })).toBe(false)
    expect(defaultFieldValue({ id: 'a', type: 'text' })).toBe('')
    expect(defaultFieldValue({ id: 'a', type: 'color' })).toBe('#ffffff')
    expect(defaultFieldValue({ id: 'a', type: 'point' })).toEqual({ x: 0, y: 0 })
    expect(defaultFieldValue({ id: 'a', type: 'enum', options: ['N', 'E'] })).toBe('N')
  })

  test('a ref has no value until one is picked', () => {
    expect(defaultFieldValue({ id: 'link', type: 'ref' })).toBeUndefined()
  })

  test('a number’s zero is moved into its bounds', () => {
    expect(defaultFieldValue({ id: 'level', type: 'int', min: 1, max: 9 })).toBe(1)
    expect(defaultFieldValue({ id: 'bias', type: 'float', max: -2 })).toBe(-2)
  })

  test('an explicit default wins', () => {
    expect(defaultFieldValue({ id: 'hp', type: 'int', default: 3 })).toBe(3)
    expect(defaultFieldValue({ id: 'link', type: 'ref', default: { target: 'door-1' } })).toEqual({
      target: 'door-1',
    })
  })

  test('a list starts empty unless its default says otherwise', () => {
    expect(defaultFieldValue({ id: 'route', type: 'point', list: true })).toEqual([])
    expect(defaultFieldValue({ id: 'route', type: 'point', list: true, default: [{ x: 1, y: 1 }] })).toEqual([
      { x: 1, y: 1 },
    ])
  })

  test('a required field has no default value, so the instance must give one', () => {
    expect(defaultFieldValue({ id: 'name', type: 'text', required: true })).toBeUndefined()
    expect(defaultFieldValue({ id: 'route', type: 'point', list: true, required: true })).toBeUndefined()
  })
})

describe('checkFieldDef', () => {
  test('a sound definition has no problems', () => {
    expect(checkFieldDef({ id: 'hp', type: 'int', min: 0, max: 9, step: 1, default: 3 })).toEqual([])
    expect(checkFieldDef({ id: 'facing', type: 'enum', options: ['N', 'E'], default: 'E' })).toEqual([])
    expect(checkFieldDef({ id: 'dialogue', type: 'text', multiline: true })).toEqual([])
    expect(checkFieldDef({ id: 'link', type: 'ref', to: ['door', '$level'] })).toEqual([])
  })

  test('the id starts with a letter and holds letters, digits and underscores', () => {
    expect(codes({ id: 'hp', type: 'int' })).toEqual([])
    expect(codes({ id: 'max_hp2', type: 'int' })).toEqual([])
    for (const id of ['', '2hp', 'max-hp', 'max hp', '_hp']) {
      expect(codes({ id, type: 'int' })).toEqual(['badId'])
    }
  })

  test('min above max is badBounds', () => {
    expect(codes({ id: 'a', type: 'int', min: 5, max: 4 })).toEqual(['badBounds'])
    expect(codes({ id: 'a', type: 'int', min: 4, max: 4 })).toEqual([])
    expect(codes({ id: 'a', type: 'float', min: Number.NaN })).toEqual(['badBounds'])
  })

  test('a step is a positive number', () => {
    expect(codes({ id: 'a', type: 'float', step: 0.25 })).toEqual([])
    expect(codes({ id: 'a', type: 'float', step: 0 })).toEqual(['badStep'])
    expect(codes({ id: 'a', type: 'int', step: -1 })).toEqual(['badStep'])
  })

  test('an enum needs unique options', () => {
    expect(codes({ id: 'a', type: 'enum' })).toEqual(['noOptions'])
    expect(codes({ id: 'a', type: 'enum', options: [] })).toEqual(['noOptions'])
    expect(codes({ id: 'a', type: 'enum', options: ['N', 'E', 'N'] })).toEqual(['duplicateOption'])
  })

  test('a property that belongs to another type is wrongTypeProperty and names the property', () => {
    const cases: [FieldDef, string][] = [
      [{ id: 'a', type: 'text', min: 0 }, 'min'],
      [{ id: 'a', type: 'bool', max: 1 }, 'max'],
      [{ id: 'a', type: 'angle', min: 0 }, 'min'],
      [{ id: 'a', type: 'color', step: 1 }, 'step'],
      [{ id: 'a', type: 'int', options: ['x'] }, 'options'],
      [{ id: 'a', type: 'text', to: ['door'] }, 'to'],
      [{ id: 'a', type: 'int', multiline: true }, 'multiline'],
    ]
    for (const [def, property] of cases) {
      const problems = checkFieldDef(def)
      expect(problems.map((problem) => problem.code)).toEqual(['wrongTypeProperty'])
      expect(problems[0]?.message).toContain(property)
    }
  })

  test('a default must fit the field, and a required field has none', () => {
    expect(codes({ id: 'hp', type: 'int', min: 0, max: 9, default: 12 })).toEqual(['badDefault'])
    expect(codes({ id: 'route', type: 'point', list: true, default: [{ x: 1 }] as never })).toEqual([
      'badDefault',
    ])
    expect(codes({ id: 'name', type: 'text', required: true, default: 'x' })).toEqual(['badDefault'])
  })

  test('problems come in a stable order', () => {
    expect(codes({ id: '9', type: 'int', min: 5, max: 1, step: 0, options: ['x'] })).toEqual([
      'badId',
      'wrongTypeProperty',
      'badBounds',
      'badStep',
    ])
  })
})

describe('checkEntityDef', () => {
  const npc: EntityDef = {
    id: 'npc',
    label: 'NPC',
    color: '#e0a54a',
    fields: [
      { id: 'name', type: 'text', required: true },
      { id: 'facing', type: 'enum', options: ['N', 'E', 'S', 'W'] },
    ],
  }

  test('a sound definition has no problems', () => {
    expect(checkEntityDef(npc)).toEqual([])
    expect(checkEntityDef({ ...npc, color: 'layer/entities' })).toEqual([])
    expect(checkEntityDef({ id: 'spawn', fields: [] })).toEqual([])
  })

  test('the id is lower case with digits and hyphens', () => {
    expect(checkEntityDef({ ...npc, id: 'inn-door-2' })).toEqual([])
    for (const id of ['', 'NPC', '2npc', 'inn_door', 'inn door']) {
      expect(checkEntityDef({ ...npc, id }).map((problem) => problem.code)).toEqual(['badEntityId'])
    }
  })

  test('a color is #rrggbb or a token name', () => {
    expect(checkEntityDef({ ...npc, color: 'amber' }).map((problem) => problem.code)).toEqual([
      'badEntityColor',
    ])
    expect(checkEntityDef({ ...npc, color: '#e0a5' }).map((problem) => problem.code)).toEqual([
      'badEntityColor',
    ])
    expect(checkEntityDef({ ...npc, color: 'Layer/Entities' }).map((problem) => problem.code)).toEqual([
      'badEntityColor',
    ])
  })

  test('a field’s problems come back with its id', () => {
    const problems = checkEntityDef({
      ...npc,
      fields: [{ id: 'hp', type: 'int', min: 9, max: 0 }, ...npc.fields],
    })
    expect(problems).toEqual([expect.objectContaining({ code: 'badBounds', fieldId: 'hp', fieldIndex: 0 })])
  })

  test('a repeated field id is reported at its later occurrence', () => {
    const problems = checkEntityDef({ ...npc, fields: [...npc.fields, { id: 'name', type: 'text' }] })
    expect(problems).toEqual([
      expect.objectContaining({ code: 'duplicateFieldId', fieldId: 'name', fieldIndex: 2 }),
    ])
  })
})
