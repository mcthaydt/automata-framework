import type { FieldDef } from '@mcthaydt/automata-content/level-2d'
import { describe, expect, it } from 'vitest'
import { entityInspector, levelInspector } from '#src/features/level/inspector-model.ts'
import { fieldRow } from '#src/shared/kit/fields/field-row.ts'
import { placeEntity, setEntityField } from '#src/shared/level-2d/model/commands/entity-edits.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

const platformer = (): Project => platformerTemplate.create(counterIds())
const target = { level: 'level-1', layer: 'entities' }

function withSlime(): Project {
  return placeEntity(platformer(), target, { id: 'slime-a', def: 'slime', x: 32, y: 48 })
}

describe('fieldRow', () => {
  it('maps every field type of the platformer template to its widget, with bounds and options', () => {
    const project = withSlime()
    const fieldsOf = (def: string) => project.defs.entities.find((entity) => entity.id === def)?.fields ?? []
    const [hp, patrol, tint] = fieldsOf('slime')
    const [travel, speed] = fieldsOf('moving-platform')
    const [doorTarget] = fieldsOf('door')
    const [music] = project.defs.levelFields

    expect(fieldRow(hp as FieldDef, 3)).toEqual({
      id: 'hp',
      label: 'Hit points',
      type: 'int',
      value: 3,
      widget: 'stepper',
      bounds: { min: 1, max: 9, step: 1 },
    })
    expect(fieldRow(patrol as FieldDef, [{ x: 1, y: 2 }])).toMatchObject({
      widget: 'points',
      value: [{ x: 1, y: 2 }],
    })
    expect(fieldRow(tint as FieldDef, '#7c3aed')).toMatchObject({ widget: 'color', value: '#7c3aed' })
    expect(fieldRow(travel as FieldDef, { x: 64, y: 0 })).toMatchObject({ widget: 'point' })
    expect(fieldRow(speed as FieldDef, 1)).toMatchObject({
      widget: 'stepper',
      bounds: { min: 0, max: 8, step: 0.25 },
    })
    expect(fieldRow(doorTarget as FieldDef, undefined)).toMatchObject({
      widget: 'ref',
      label: 'Leads to',
      value: undefined,
    })
    expect(fieldRow(music as FieldDef, '')).toMatchObject({ widget: 'text', value: '' })
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
    expect(fieldRow({ id: 'text', type: 'text', multiline: true }, '')).toMatchObject({ widget: 'multiline' })
    expect(fieldRow({ id: 'tags', type: 'text', list: true }, ['x'])).toMatchObject({ widget: 'list' })
  })
})

describe('entityInspector', () => {
  it('has nothing to show when nothing is selected, so the inspector shows the level', () => {
    expect(entityInspector(withSlime(), 'level-1', [])).toEqual({ kind: 'none' })
  })

  it('shows one selected instance with its fields, position and size', () => {
    const inspector = entityInspector(withSlime(), 'level-1', ['slime-a'])
    expect(inspector).toMatchObject({
      kind: 'one',
      layer: 'entities',
      instance: { id: 'slime-a', def: 'slime' },
      def: { id: 'slime' },
      position: { x: 32, y: 48 },
      size: undefined,
    })
    if (inspector.kind !== 'one') throw new Error('expected one')
    expect(inspector.fields.map((row) => [row.id, row.value])).toEqual([
      ['hp', 3],
      ['patrol', []],
      ['tint', '#7c3aed'],
    ])
  })

  it('counts several selected instances', () => {
    const project = placeEntity(withSlime(), target, { id: 'coin-a', def: 'coin', x: 0, y: 0 })
    expect(entityInspector(project, 'level-1', ['slime-a', 'coin-a'])).toEqual({ kind: 'many', count: 2 })
  })

  it('treats an id the level no longer has as nothing selected', () => {
    expect(entityInspector(withSlime(), 'level-1', ['gone'])).toMatchObject({ kind: 'none' })
  })
})

describe('a ref row (plan ED2D.6c step 4)', () => {
  function withDoor(targetValue?: { target: string; container?: string }): Project {
    const placed = placeEntity(platformer(), target, { id: 'door-a', def: 'door', x: 64, y: 64 })
    return targetValue === undefined
      ? placed
      : setEntityField(placed, target, 'door-a', 'target', targetValue)
  }
  const refRow = (project: Project) => {
    const inspector = entityInspector(project, 'level-1', ['door-a'])
    if (inspector.kind !== 'one') throw new Error('expected one')
    const row = inspector.fields.find((each) => each.id === 'target')
    if (row === undefined) throw new Error('no target row')
    return row
  }

  it('lists what the picker offers, never the instance itself', () => {
    const row = refRow(withDoor())
    expect(row.ref?.name).toBeUndefined()
    expect(row.ref?.targets).toEqual([
      {
        id: 'level-1',
        name: 'Level 1',
        choices: [
          { label: 'Player start at 48, 256', value: { target: expect.any(String), container: 'level-1' } },
        ],
      },
    ])
  })

  it('names a target it resolves, and none for a broken one', () => {
    const start = platformer().levels[0]?.layers.find((layer) => layer.kind === 'entities')
    const id = start?.kind === 'entities' ? start.items[0]?.id : undefined
    if (id === undefined) throw new Error('no player start')
    expect(refRow(withDoor({ target: id, container: 'level-1' })).ref?.name).toBe('Level 1 · Player start')
    expect(refRow(withDoor({ target: 'gone' })).ref?.name).toBeUndefined()
  })

  it('is left out where no project is known (a definition default)', () => {
    expect(fieldRow({ id: 'target', type: 'ref' }, undefined).ref).toBeUndefined()
  })
})

describe('levelInspector', () => {
  it('shows the level name, size and fields', () => {
    expect(levelInspector(platformer(), 'level-1')).toMatchObject({
      id: 'level-1',
      name: expect.any(String),
      size: { w: expect.any(Number), h: expect.any(Number) },
      fields: [{ id: 'music', widget: 'text', value: '' }],
    })
  })
})
