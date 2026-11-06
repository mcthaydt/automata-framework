import { describe, expect, test } from 'vitest'
import type { EntityDef, FieldDef } from '#src/shared/kit/fields/field-types.ts'
import { checkValues, renameFieldValues } from '#src/shared/kit/fields/field-values.ts'
import { checkRetype, type FieldInstance, renameField } from '#src/shared/kit/fields/retype.ts'

const hp: FieldDef = { id: 'hp', type: 'int', min: 0, max: 9 }
const goblin: EntityDef = { id: 'goblin', fields: [hp, { id: 'name', type: 'text' }] }

const instances: readonly FieldInstance[] = [
  { id: 'g1', values: { hp: 3 } },
  { id: 'g2', values: { hp: 7, name: 'Snik' } },
  { id: 'g3', values: { hp: 12 } },
  { id: 'g4', values: { name: 'No hp' } },
]

const ids = (breakages: readonly { instanceId: string }[]): string[] =>
  breakages.map((breakage) => breakage.instanceId)

describe('EK-j: an entity definition with hp: int 0..9', () => {
  test('an instance at 12 is aboveMax', () => {
    expect(checkValues(goblin.fields, instances[2]?.values ?? {})).toEqual([
      expect.objectContaining({ code: 'aboveMax', fieldId: 'hp' }),
    ])
  })

  test('retyping hp to text lists exactly the instances whose number would stop validating, so the editor can refuse', () => {
    const breakages = checkRetype(hp, { id: 'hp', type: 'text' }, instances)
    expect(ids(breakages)).toEqual(['g1', 'g2'])
    expect(breakages.every((breakage) => breakage.problem.code === 'wrongType')).toBe(true)
  })

  test('renaming hp keeps both values by id', () => {
    const renamed = renameField(goblin, 'hp', 'health')
    if (!renamed.ok) throw new Error('rename refused')
    expect(renamed.def.fields.map((field) => field.id)).toEqual(['health', 'name'])
    const [g1, g2] = instances.map((instance) => renameFieldValues(instance.values, 'hp', 'health'))
    expect(g1).toEqual({ health: 3 })
    expect(g2).toEqual({ health: 7, name: 'Snik' })
    expect(checkValues(renamed.def.fields, g2 ?? {})).toEqual([])
  })
})

describe('checkRetype', () => {
  test('widening the bounds lists nothing; narrowing lists the values that fall outside', () => {
    expect(checkRetype(hp, { ...hp, max: 20 }, instances)).toEqual([])
    const narrowed = checkRetype(hp, { ...hp, max: 5 }, instances)
    expect(ids(narrowed)).toEqual(['g2'])
    expect(narrowed[0]?.problem).toMatchObject({ code: 'aboveMax', fieldId: 'hp' })
  })

  test('an instance that was already invalid is not listed, because the retype did not break it', () => {
    expect(ids(checkRetype(hp, { ...hp, max: 5 }, instances))).not.toContain('g3')
  })

  test('int to float breaks nothing; float to int lists the fractions', () => {
    const speed: FieldDef = { id: 'speed', type: 'float' }
    const moving: FieldInstance[] = [
      { id: 'a', values: { speed: 2 } },
      { id: 'b', values: { speed: 2.5 } },
    ]
    expect(checkRetype({ id: 'speed', type: 'int' }, speed, moving)).toEqual([])
    expect(ids(checkRetype(speed, { id: 'speed', type: 'int' }, moving))).toEqual(['b'])
  })

  test('removing an enum option lists the instances that hold it', () => {
    const facing: FieldDef = { id: 'facing', type: 'enum', options: ['N', 'E', 'S'] }
    const placed: FieldInstance[] = [
      { id: 'a', values: { facing: 'N' } },
      { id: 'b', values: { facing: 'S' } },
    ]
    expect(ids(checkRetype(facing, { ...facing, options: ['N', 'E'] }, placed))).toEqual(['b'])
  })

  test('turning a scalar into a list, or the reverse, lists every instance that holds a value', () => {
    const spawn: FieldDef = { id: 'spawn', type: 'point' }
    const placed: FieldInstance[] = [
      { id: 'a', values: { spawn: { x: 1, y: 1 } } },
      { id: 'b', values: {} },
    ]
    expect(ids(checkRetype(spawn, { ...spawn, list: true }, placed))).toEqual(['a'])
  })

  test('making a field required lists the instances with no value for it', () => {
    const breakages = checkRetype(hp, { ...hp, required: true }, instances)
    expect(ids(breakages)).toEqual(['g4'])
    expect(breakages[0]?.problem.code).toBe('fieldMissing')
  })

  test('a field that was already required does not list the instances that were already missing it', () => {
    const required = { ...hp, required: true }
    expect(checkRetype(required, { ...required, max: 20 }, instances)).toEqual([])
  })

  test('reads the value by the old id, so a rename combined with a retype is one call', () => {
    expect(ids(checkRetype(hp, { id: 'health', type: 'text' }, instances))).toEqual(['g1', 'g2'])
  })

  test('no instances, nothing listed', () => {
    expect(checkRetype(hp, { id: 'hp', type: 'text' }, [])).toEqual([])
  })
})

describe('renameField', () => {
  test('renames in place and leaves the other fields, the entity and the input alone', () => {
    const result = renameField(goblin, 'name', 'title')
    expect(result).toEqual({
      ok: true,
      def: { id: 'goblin', fields: [hp, { id: 'title', type: 'text' }] },
    })
    expect(goblin.fields[1]?.id).toBe('name')
  })

  test('refuses an unknown field, a bad new id and an id another field already has', () => {
    expect(renameField(goblin, 'mana', 'power')).toEqual({ ok: false, code: 'unknownField' })
    expect(renameField(goblin, 'hp', '2fast')).toEqual({ ok: false, code: 'badId' })
    expect(renameField(goblin, 'hp', 'name')).toEqual({ ok: false, code: 'duplicateFieldId' })
  })

  test('renaming a field to its own id is accepted and changes nothing', () => {
    expect(renameField(goblin, 'hp', 'hp')).toEqual({ ok: true, def: goblin })
  })
})
