import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { FIELD_TYPES, type FieldDef } from '#src/shared/level-2d/field-types.ts'
import {
  entityDefIssues,
  entityDefSchema,
  entityDefShape,
  fieldDefSchema,
  fieldValueSchema,
  fieldValuesSchema,
} from '#src/shared/level-2d/fields.schema.ts'

const sample: Record<(typeof FIELD_TYPES)[number], FieldDef> = {
  int: { id: 'hp', type: 'int', label: 'Hit points', min: 0, max: 9, step: 1, default: 3 },
  float: { id: 'speed', type: 'float', min: 0.5, step: 0.25 },
  bool: { id: 'open', type: 'bool', default: true },
  text: { id: 'dialogue', type: 'text', multiline: true, required: true },
  enum: { id: 'facing', type: 'enum', options: ['N', 'E', 'S', 'W'], default: 'S' },
  color: { id: 'tint', type: 'color', default: '#7a9be0' },
  angle: { id: 'aim', type: 'angle' },
  ref: { id: 'door', type: 'ref', to: ['door', '$level'] },
  point: { id: 'route', type: 'point', list: true, default: [{ x: 1, y: 1 }] },
}

describe('fieldDefSchema', () => {
  test('every field type round-trips unchanged', () => {
    for (const type of FIELD_TYPES) {
      expect(fieldDefSchema.parse(sample[type])).toEqual(sample[type])
    }
  })

  test('an unknown key is a parse error, so a typo in a project file is found at load', () => {
    expect(fieldDefSchema.safeParse({ id: 'hp', type: 'int', minimum: 0 }).success).toBe(false)
  })

  test('an unknown type is a parse error', () => {
    expect(fieldDefSchema.safeParse({ id: 'hp', type: 'integer' }).success).toBe(false)
  })

  test('a definition checkFieldDef rejects fails with its message', () => {
    for (const bad of [
      { id: '9hp', type: 'int' },
      { id: 'hp', type: 'int', min: 5, max: 1 },
      { id: 'facing', type: 'enum' },
      { id: 'hp', type: 'int', default: 1.5 },
      { id: 'name', type: 'text', min: 0 },
    ]) {
      const result = fieldDefSchema.safeParse(bad)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toMatch(/\w/)
    }
    const result = fieldDefSchema.safeParse({ id: 'hp', type: 'int', min: 5, max: 1 })
    expect(result.error?.issues[0]?.message).toContain('min 5 is above max 1')
  })
})

describe('entityDefSchema', () => {
  const npc = {
    id: 'npc',
    label: 'NPC',
    color: 'layer/entities',
    single: false,
    fields: [sample.text, sample.enum],
  }

  test('round-trips a sound entity', () => {
    expect(entityDefSchema.parse(npc)).toEqual(npc)
  })

  test('rejects a bad id, a bad color and a repeated field id', () => {
    expect(entityDefSchema.safeParse({ ...npc, id: 'NPC' }).success).toBe(false)
    expect(entityDefSchema.safeParse({ ...npc, color: 'amber' }).success).toBe(false)
    const twice = entityDefSchema.safeParse({ ...npc, fields: [sample.text, sample.text] })
    expect(twice.success).toBe(false)
    expect(twice.error?.issues[0]?.message).toContain('twice')
  })

  test('reports a field problem at the field’s path', () => {
    const result = entityDefSchema.safeParse({ ...npc, fields: [{ id: 'hp', type: 'int', min: 5, max: 1 }] })
    expect(result.error?.issues[0]?.path).toEqual(['fields', 0])
  })

  test('an unknown key is a parse error', () => {
    expect(entityDefSchema.safeParse({ ...npc, shape: 'box' }).success).toBe(false)
  })
})

describe('fieldValueSchema and fieldValuesSchema', () => {
  test('accept every well-formed shape, nested lists included', () => {
    for (const value of [
      3,
      -1.5,
      true,
      'text',
      '#ffffff',
      { x: 1, y: 2 },
      { target: 'a', container: 'Inn' },
      [],
      [{ x: 1, y: 1 }],
      [[1, 2], [3]],
    ]) {
      expect(fieldValueSchema.safeParse(value).success).toBe(true)
    }
    expect(fieldValuesSchema.parse({ hp: 3, route: [{ x: 1, y: 1 }], door: { target: 'inn-door' } })).toEqual(
      {
        hp: 3,
        route: [{ x: 1, y: 1 }],
        door: { target: 'inn-door' },
      },
    )
  })

  test('reject null, undefined, functions, NaN and objects that are neither a point nor a ref', () => {
    for (const value of [null, undefined, () => 1, Number.NaN, { z: 1 }, { x: 1 }, [null]]) {
      expect(fieldValueSchema.safeParse(value).success).toBe(false)
    }
    expect(fieldValuesSchema.safeParse({ hp: null }).success).toBe(false)
  })
})

describe('entityDefShape and entityDefIssues: what an editor extends', () => {
  const place = z
    .strictObject({ ...entityDefShape, shape: z.enum(['rect', 'point']) })
    .superRefine((def, ctx) => {
      for (const issue of entityDefIssues(def)) ctx.addIssue({ code: 'custom', ...issue })
    })

  test('an extended schema accepts the entity keys and its own, and nothing else', () => {
    const npc = { id: 'npc', color: '#e0a54a', fields: [sample.text], shape: 'rect' }
    expect(place.parse(npc)).toEqual(npc)
    expect(place.safeParse({ ...npc, size: 3 }).success).toBe(false)
    expect(place.safeParse({ id: 'npc', fields: [] }).success).toBe(false)
  })

  test('entityDefIssues names the entity-level problems at their path and leaves a field’s own to the field schema', () => {
    expect(entityDefIssues({ id: 'NPC', fields: [] })).toEqual([
      { message: expect.stringContaining('NPC'), path: [] },
    ])
    expect(entityDefIssues({ id: 'npc', fields: [sample.text, sample.text] })).toEqual([
      { message: expect.stringContaining('twice'), path: ['fields', 1] },
    ])
    expect(entityDefIssues({ id: 'npc', fields: [{ id: 'hp', type: 'int', min: 5, max: 1 }] })).toEqual([])
  })

  test('the entity schema reports through the same issues', () => {
    expect(entityDefSchema.safeParse({ id: 'NPC', fields: [] }).error?.issues[0]?.message).toContain('NPC')
  })

  test('an extension keeps the field problems', () => {
    const result = place.safeParse({
      id: 'npc',
      shape: 'rect',
      fields: [{ id: 'hp', type: 'int', min: 5, max: 1 }],
    })
    expect(result.error?.issues[0]?.path).toEqual(['fields', 0])
  })
})
