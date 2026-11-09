import type { FieldDef } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import { fieldRow } from '#src/shared/kit/fields/field-row.ts'

// The field-to-widget map both editors' field forms use (kit spec §4.8; moved from editor-2d's Level inspector, plan
// "field form and journeys" A1): which kit control edits a field, with its bounds and options.

describe('fieldRow', () => {
  it('maps numbers to a stepper with bounds, lists of points to points, and the rest to their own widgets', () => {
    const hp: FieldDef = { id: 'hp', label: 'Hit points', type: 'int', min: 1, max: 9 }
    expect(fieldRow(hp, 3)).toEqual({
      id: 'hp',
      label: 'Hit points',
      type: 'int',
      value: 3,
      widget: 'stepper',
      bounds: { min: 1, max: 9, step: 1 },
    })
    expect(fieldRow({ id: 'patrol', type: 'point', list: true }, [{ x: 1, y: 2 }])).toMatchObject({
      widget: 'points',
    })
    expect(fieldRow({ id: 'counts', type: 'int', list: true }, [1])).toMatchObject({ widget: 'list' })
    expect(fieldRow({ id: 'tint', type: 'color' }, '#7c3aed')).toMatchObject({
      widget: 'color',
      value: '#7c3aed',
    })
    expect(fieldRow({ id: 'travel', type: 'point' }, { x: 64, y: 0 })).toMatchObject({ widget: 'point' })
    expect(fieldRow({ id: 'speed', type: 'float', min: 0, max: 8, step: 0.25 }, 1)).toMatchObject({
      widget: 'stepper',
      bounds: { min: 0, max: 8, step: 0.25 },
    })
    expect(fieldRow({ id: 'to', label: 'Leads to', type: 'ref', to: ['door'] }, undefined)).toMatchObject({
      widget: 'ref',
      label: 'Leads to',
      value: undefined,
    })
    expect(fieldRow({ id: 'music', type: 'text' }, '')).toMatchObject({ widget: 'text', value: '' })
    expect(fieldRow({ id: 'notes', type: 'text', multiline: true }, '')).toMatchObject({
      widget: 'multiline',
    })
  })

  it('maps bool, enum and angle, and an enum past five options to a picker', () => {
    const few: FieldDef = { id: 'mood', type: 'enum', options: ['calm', 'angry'] }
    const many: FieldDef = { id: 'biome', type: 'enum', options: ['a', 'b', 'c', 'd', 'e', 'f'] }
    expect(fieldRow({ id: 'awake', type: 'bool' }, true)).toMatchObject({ widget: 'toggle', label: 'awake' })
    expect(fieldRow(few, 'calm')).toMatchObject({ widget: 'segmented', options: ['calm', 'angry'] })
    expect(fieldRow(many, 'a')).toMatchObject({ widget: 'picker', options: ['a', 'b', 'c', 'd', 'e', 'f'] })
    expect(fieldRow({ id: 'facing', type: 'angle' }, 90)).toMatchObject({
      widget: 'stepper',
      bounds: { step: 1 },
    })
  })
})
