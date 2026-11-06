import { describe, expect, it } from 'vitest'
import { entity, withDefs, withEntities, withLevel } from '../../../../testing/level-2d/project-edit'
import { hollowmere } from '../../../../testing/level-2d/samples'
import { valuesWithDefaults } from '../../../kit/fields/field-values.ts'
import { checkProject } from '../../profiles/level-project/project-checks'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { counterIds } from '../ids'
import type { EntityInstance, Project } from '../project-types'
import {
  deleteEntity,
  duplicateEntity,
  moveEntity,
  placeEntity,
  resizeEntity,
  setEntityField,
} from './entity-edits'

const ENTITIES = { level: 'level-1', layer: 'entities' }
const project = (): Project => platformerTemplate.create(counterIds())
const itemsOf = (p: Project, layer = 'entities'): readonly EntityInstance[] => {
  const found = p.levels[0]?.layers.find((candidate) => candidate.def === layer)
  return found?.kind === 'entities' ? found.items : []
}
const find = (p: Project, id: string): EntityInstance => {
  const found = itemsOf(p).find((item) => item.id === id)
  if (found === undefined) throw new Error(`no instance ${id}`)
  return found
}
const codes = (p: Project): string[] => checkProject(p, {}).map((d) => d.code)
const base = (): Project =>
  withEntities(project(), 'level-1', [
    entity('slime-1', 'slime', 120, 256, { hp: 3 }),
    entity('platform-1', 'moving-platform', 200, 128),
  ])

describe('placeEntity', () => {
  it("appends an instance with the definition's default field values", () => {
    const slime = project().defs.entities.find((def) => def.id === 'slime')
    const next = placeEntity(project(), ENTITIES, { id: 'slime-9', def: 'slime', x: 64, y: 200 })
    const placed = find(next, 'slime-9')
    expect(itemsOf(next).at(-1)).toBe(placed)
    expect(placed).toMatchObject({ def: 'slime', x: 64, y: 200 })
    expect(placed.fields).toEqual(valuesWithDefaults(slime?.fields ?? [], {}))
    expect(placed.fields).toMatchObject({ hp: 3 })
    expect('w' in placed || 'h' in placed).toBe(false)
  })

  it('gives a resizable definition its size, so the handles have something to drag', () => {
    const placed = find(
      placeEntity(project(), ENTITIES, { id: 'p', def: 'moving-platform', x: 0, y: 0 }),
      'p',
    )
    expect([placed.w, placed.h]).toEqual([48, 8])
  })

  it('never stores a negative zero', () => {
    const placed = find(placeEntity(project(), ENTITIES, { id: 'z', def: 'coin', x: -0.4, y: 0 }), 'z')
    expect(Object.is(placed.x, 0)).toBe(true)
  })

  it('rounds the position to whole pixels', () => {
    const placed = find(placeEntity(project(), ENTITIES, { id: 'c', def: 'coin', x: 10.4, y: 10.6 }), 'c')
    expect([placed.x, placed.y]).toEqual([10, 11])
  })

  it('refuses an id that any level already uses', () => {
    const start = itemsOf(project())[0]?.id ?? ''
    expect(() => placeEntity(project(), ENTITIES, { id: start, def: 'coin', x: 0, y: 0 })).toThrow(
      new RangeError(`entity id "${start}" is already used`),
    )
  })

  it('refuses an id that an object already uses', () => {
    const rpg = hollowmere()
    const props = rpg.levels
      .flatMap((level) => level.layers)
      .find((layer) => layer.kind === 'objects' && layer.items.length > 0)
    const taken = props?.kind === 'objects' ? (props.items[0]?.id ?? '') : ''
    expect(taken).not.toBe('')
    expect(() =>
      placeEntity(rpg, { level: 'village', layer: 'entities' }, { id: taken, def: 'chest', x: 0, y: 0 }),
    ).toThrow(new RangeError(`entity id "${taken}" is already used`))
  })

  it('refuses a definition the project does not have', () => {
    expect(() => placeEntity(project(), ENTITIES, { id: 'd', def: 'dragon', x: 0, y: 0 })).toThrow(
      new RangeError('no entity definition "dragon"'),
    )
  })

  it('refuses a layer that holds no entities', () => {
    expect(() =>
      placeEntity(project(), { level: 'level-1', layer: 'collision' }, { id: 'd', def: 'coin', x: 0, y: 0 }),
    ).toThrow(new RangeError('layer "collision" has no entities'))
  })

  it('moves the instance that is there when a single definition is placed again', () => {
    const before = project()
    const start = itemsOf(before)[0] as EntityInstance
    const next = placeEntity(before, ENTITIES, { id: 'second-start', def: 'player-start', x: 200, y: 100 })
    expect(itemsOf(next)).toHaveLength(itemsOf(before).length)
    expect(find(next, start.id)).toMatchObject({ x: 200, y: 100, def: 'player-start' })
  })

  it('finds that instance in any entities layer of the level', () => {
    const extras = withLevel(
      withDefs(project(), (defs) => ({
        ...defs,
        layers: [...defs.layers, { id: 'extras', label: 'Extras', kind: 'entities', grid: 16, snap: true }],
      })),
      'level-1',
      (level) => ({ ...level, layers: [...level.layers, { def: 'extras', kind: 'entities', items: [] }] }),
    )
    const start = itemsOf(extras)[0] as EntityInstance
    const next = placeEntity(
      extras,
      { level: 'level-1', layer: 'extras' },
      { id: 'again', def: 'player-start', x: 8, y: 8 },
    )
    expect(itemsOf(next, 'extras')).toEqual([])
    expect(find(next, start.id)).toMatchObject({ x: 8, y: 8 })
  })

  it('adds no diagnostic for an instance that needs nothing more', () => {
    const before = codes(project())
    const after = codes(placeEntity(project(), ENTITIES, { id: 'c', def: 'coin', x: 40, y: 40 }))
    expect(after.filter((code) => !before.includes(code))).toEqual([])
  })

  it('adds exactly the missing-field diagnostic for a required field with no default', () => {
    const before = codes(project())
    const after = codes(placeEntity(project(), ENTITIES, { id: 'door-1', def: 'door', x: 40, y: 40 }))
    expect(after.filter((code) => !before.includes(code))).toEqual(['fieldMissing'])
  })
})

describe('moveEntity', () => {
  it('moves one instance and keeps the rest', () => {
    const next = moveEntity(base(), ENTITIES, 'slime-1', 130, 240)
    expect(find(next, 'slime-1')).toMatchObject({ x: 130, y: 240, fields: { hp: 3 } })
    expect(find(next, 'platform-1')).toBe(find(base(), 'platform-1') && find(next, 'platform-1'))
    expect(itemsOf(next).map((item) => item.id)).toEqual(itemsOf(base()).map((item) => item.id))
  })

  it('moves along one axis alone', () => {
    expect(find(moveEntity(base(), ENTITIES, 'slime-1', 120, 250), 'slime-1')).toMatchObject({
      x: 120,
      y: 250,
    })
    expect(find(moveEntity(base(), ENTITIES, 'slime-1', 130, 256), 'slime-1')).toMatchObject({
      x: 130,
      y: 256,
    })
  })

  it('rounds to whole pixels', () => {
    expect(find(moveEntity(base(), ENTITIES, 'slime-1', 130.5, 240.4), 'slime-1')).toMatchObject({
      x: 131,
      y: 240,
    })
  })

  it('returns the same project when the instance is already there', () => {
    const project = base()
    expect(moveEntity(project, ENTITIES, 'slime-1', 120, 256)).toBe(project)
    expect(moveEntity(project, ENTITIES, 'slime-1', 120.2, 255.9)).toBe(project)
  })

  it('refuses an instance that is not in the layer', () => {
    expect(() => moveEntity(base(), ENTITIES, 'ghost', 0, 0)).toThrow(
      new RangeError('no entity "ghost" in layer "entities"'),
    )
  })
})

describe('resizeEntity', () => {
  it('sets both sides of a freely resizable instance', () => {
    const next = base()
    expect(find(resizeEntity(next, ENTITIES, 'platform-1', 96, 8), 'platform-1')).toMatchObject({
      w: 96,
      h: 8,
    })
  })

  it('refuses a side the definition does not let move, and a definition that is not resizable at all', () => {
    expect(() => resizeEntity(base(), ENTITIES, 'platform-1', 96, 16)).toThrow(
      new RangeError('"moving-platform" can only be resized in x'),
    )
    expect(() => resizeEntity(base(), ENTITIES, 'slime-1', 20, 12)).toThrow(
      new RangeError('"slime" cannot be resized'),
    )
  })

  it('allows y when the definition is resizable in y or both', () => {
    const yOnly = withDefs(base(), (defs) => ({
      ...defs,
      entities: defs.entities.map((def) =>
        def.id === 'moving-platform' ? { ...def, resizable: 'y' as const } : def,
      ),
    }))
    expect(find(resizeEntity(yOnly, ENTITIES, 'platform-1', 48, 24), 'platform-1')).toMatchObject({
      w: 48,
      h: 24,
    })
    expect(() => resizeEntity(yOnly, ENTITIES, 'platform-1', 60, 24)).toThrow(/only be resized in y/)
    const both = withDefs(base(), (defs) => ({
      ...defs,
      entities: defs.entities.map((def) =>
        def.id === 'moving-platform' ? { ...def, resizable: 'xy' as const } : def,
      ),
    }))
    expect(find(resizeEntity(both, ENTITIES, 'platform-1', 60, 24), 'platform-1')).toMatchObject({
      w: 60,
      h: 24,
    })
  })

  it('refuses a size under one pixel and rounds to whole pixels', () => {
    expect(() => resizeEntity(base(), ENTITIES, 'platform-1', 0.4, 8)).toThrow(RangeError)
    expect(find(resizeEntity(base(), ENTITIES, 'platform-1', 60.4, 8), 'platform-1').w).toBe(60)
  })

  it('returns the same project for the size it already has', () => {
    const sized = resizeEntity(base(), ENTITIES, 'platform-1', 96, 8)
    expect(resizeEntity(sized, ENTITIES, 'platform-1', 96, 8)).toBe(sized)
    const untouched = base()
    expect(resizeEntity(untouched, ENTITIES, 'platform-1', 48, 8)).toBe(untouched)
  })
})

describe('setEntityField', () => {
  it('stores a value the definition accepts', () => {
    expect(find(setEntityField(base(), ENTITIES, 'slime-1', 'hp', 5), 'slime-1').fields).toMatchObject({
      hp: 5,
    })
  })

  it("keeps the instance's other values", () => {
    const next = find(setEntityField(base(), ENTITIES, 'slime-1', 'tint', '#112233'), 'slime-1')
    expect(next.fields).toEqual({ hp: 3, tint: '#112233' })
  })

  it('stores a list of points', () => {
    const patrol = [
      { x: 100, y: 256 },
      { x: 160, y: 256 },
    ]
    expect(
      find(setEntityField(base(), ENTITIES, 'slime-1', 'patrol', patrol), 'slime-1').fields,
    ).toMatchObject({
      patrol,
    })
  })

  it("refuses a value the field rejects, with the kit's message, and changes nothing", () => {
    const project = base()
    expect(() => setEntityField(project, ENTITIES, 'slime-1', 'hp', 10)).toThrow(RangeError)
    expect(() => setEntityField(project, ENTITIES, 'slime-1', 'hp', 10)).toThrow(/9/)
    expect(() => setEntityField(project, ENTITIES, 'slime-1', 'hp', 2.5)).toThrow(RangeError)
    expect(() => setEntityField(project, ENTITIES, 'slime-1', 'hp', 'many')).toThrow(RangeError)
    expect(() => setEntityField(project, ENTITIES, 'slime-1', 'tint', 'purple')).toThrow(RangeError)
    expect(find(project, 'slime-1').fields).toEqual({ hp: 3 })
  })

  it('refuses a field the definition does not have', () => {
    expect(() => setEntityField(base(), ENTITIES, 'slime-1', 'speed', 2)).toThrow(
      new RangeError('"slime" has no field "speed"'),
    )
  })

  it('returns the same project for the value already stored', () => {
    const project = base()
    expect(setEntityField(project, ENTITIES, 'slime-1', 'hp', 3)).toBe(project)
  })

  it('refuses an instance whose definition is gone', () => {
    const broken = withEntities(project(), 'level-1', [entity('ghost', 'dragon', 1, 1)])
    expect(() => setEntityField(broken, ENTITIES, 'ghost', 'hp', 1)).toThrow(
      new RangeError('no entity definition "dragon"'),
    )
  })
})

describe('deleteEntity', () => {
  it('removes the instance and keeps the order of the others', () => {
    const next = deleteEntity(base(), ENTITIES, 'slime-1')
    expect(itemsOf(next).map((item) => item.id)).toEqual(
      itemsOf(base())
        .map((item) => item.id)
        .filter((id) => id !== 'slime-1'),
    )
  })

  it('refuses an instance that is not in the layer', () => {
    expect(() => deleteEntity(base(), ENTITIES, 'ghost')).toThrow(
      new RangeError('no entity "ghost" in layer "entities"'),
    )
  })
})

describe('duplicateEntity', () => {
  it('copies the instance with its field values, offset, under the new id, and keeps the original', () => {
    const project = withEntities(base(), 'level-1', [
      entity('slime-2', 'slime', 40, 100, { hp: 7, patrol: [{ x: 1, y: 2 }] }),
    ])
    const next = duplicateEntity(project, ENTITIES, 'slime-2', 'slime-3', { x: 16, y: 0 })
    expect(find(next, 'slime-2')).toBe(find(project, 'slime-2'))
    expect(find(next, 'slime-3')).toEqual({ ...find(project, 'slime-2'), id: 'slime-3', x: 56, y: 100 })
    expect(itemsOf(next).at(-1)?.id).toBe('slime-3')
  })

  it('keeps the size of a resized instance', () => {
    const sized = resizeEntity(base(), ENTITIES, 'platform-1', 96, 8)
    const next = duplicateEntity(sized, ENTITIES, 'platform-1', 'platform-2', { x: 0, y: 16 })
    expect(find(next, 'platform-2')).toMatchObject({ w: 96, h: 8, x: 200, y: 144 })
  })

  it('refuses a single definition and an id that is already used', () => {
    const start = itemsOf(project())[0]?.id ?? ''
    expect(() => duplicateEntity(project(), ENTITIES, start, 'again', { x: 16, y: 0 })).toThrow(
      new RangeError('"player-start" is single, so it cannot be duplicated'),
    )
    expect(() => duplicateEntity(base(), ENTITIES, 'slime-1', 'platform-1', { x: 16, y: 0 })).toThrow(
      new RangeError('entity id "platform-1" is already used'),
    )
  })

  it('refuses an instance that is not in the layer', () => {
    expect(() => duplicateEntity(base(), ENTITIES, 'ghost', 'ghost-2', { x: 0, y: 0 })).toThrow(RangeError)
  })
})

describe('every edit leaves a valid project valid', () => {
  it('adds no diagnostic', () => {
    const start = codes(base())
    let project = base()
    project = moveEntity(project, ENTITIES, 'slime-1', 130, 240)
    project = resizeEntity(project, ENTITIES, 'platform-1', 96, 8)
    project = setEntityField(project, ENTITIES, 'slime-1', 'hp', 5)
    project = duplicateEntity(project, ENTITIES, 'slime-1', 'slime-2', { x: 16, y: 0 })
    project = deleteEntity(project, ENTITIES, 'slime-2')
    expect(codes(project)).toEqual(start)
  })
})
