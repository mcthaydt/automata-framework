import type { FieldDef } from '@mcthaydt/automata-editor-kit/fields'
import { describe, expect, it } from 'vitest'
import { linkedMaps } from '../../testing/linked-maps'
import { withDefs, withLevel } from '../../testing/project-edit'
import type { Project } from '../project-types'
import { projectLinks, refName, refTargets } from './ref-links'

const defOf = (project: Project, id: string): FieldDef => {
  const field = project.defs.entities
    .find((def) => def.id === id)
    ?.fields.find((each) => each.id === 'target')
  if (field === undefined) throw new Error(`no target on ${id}`)
  return field
}

describe('projectLinks', () => {
  it('lists every resolved ref with its source and its target, in level order', () => {
    expect(projectLinks(linkedMaps())).toEqual([
      {
        from: { level: 'map-1', item: { id: 'door-out', def: 'door', x: 96, y: 64 } },
        field: 'target',
        to: { level: 'inn', item: { id: 'door-in', def: 'door', x: 32, y: 200 } },
      },
      {
        from: { level: 'inn', item: { id: 'door-in', def: 'door', x: 32, y: 200 } },
        field: 'target',
        to: { level: 'map-1', item: { id: 'door-out', def: 'door', x: 96, y: 64 } },
      },
    ])
  })

  it('leaves out a broken ref: a link to something deleted is not drawn (G-g)', () => {
    const project = withLevel(linkedMaps(), 'inn', (level) => ({
      ...level,
      layers: level.layers.map((layer) =>
        layer.kind === 'entities'
          ? { ...layer, items: layer.items.filter((item) => item.id !== 'door-in') }
          : layer,
      ),
    }))
    expect(projectLinks(project)).toEqual([])
  })

  it('follows level fields and every member of a ref list', () => {
    const project = withDefs(linkedMaps(), (defs) => ({
      ...defs,
      levelFields: [...defs.levelFields, { id: 'exits', type: 'ref', list: true, to: ['$level'] }],
    }))
    const linked = withLevel(project, 'map-1', (level) => ({
      ...level,
      fields: { ...level.fields, exits: [{ target: 'inn' }, { target: 'gone' }, { target: 'map-1' }] },
    }))
    expect(projectLinks(linked).filter((link) => link.field === 'exits')).toEqual([
      { from: { level: 'map-1' }, field: 'exits', to: { level: 'inn' } },
      { from: { level: 'map-1' }, field: 'exits', to: { level: 'map-1' } },
    ])
  })
})

describe('refTargets (the picker: levels first, then what the field allows)', () => {
  it('lists each level holding an allowed target, without the holder itself', () => {
    const project = linkedMaps()
    expect(refTargets(project, defOf(project, 'door'), 'door-out')).toEqual([
      {
        level: 'map-1',
        name: 'Village',
        choices: [
          { label: 'Player start at 160, 120', value: { target: expect.any(String), container: 'map-1' } },
        ],
      },
      {
        level: 'inn',
        name: 'Inn',
        choices: [{ label: 'Door at 32, 200', value: { target: 'door-in', container: 'inn' } }],
      },
    ])
  })

  it('offers the level itself first when the field may point at a level, and leaves out empty levels', () => {
    const project = linkedMaps()
    const exits: FieldDef = { id: 'exit', type: 'ref', to: ['$level', 'chest'] }
    expect(refTargets(project, exits, undefined)).toEqual([
      {
        level: 'map-1',
        name: 'Village',
        choices: [{ label: 'The level itself', value: { target: 'map-1' } }],
      },
      {
        level: 'inn',
        name: 'Inn',
        choices: [
          { label: 'The level itself', value: { target: 'inn' } },
          { label: 'Chest at 64, 64', value: { target: 'chest-1', container: 'inn' } },
        ],
      },
    ])
    const chestsOnly: FieldDef = { id: 'loot', type: 'ref', to: ['chest'] }
    expect(refTargets(project, chestsOnly, undefined).map((each) => each.level)).toEqual(['inn'])
  })
})

describe('refName', () => {
  it('names a target by its level and definition, a level by its name, and nothing it cannot resolve', () => {
    const project = linkedMaps()
    const door = defOf(project, 'door')
    expect(refName(project, door, { target: 'door-in', container: 'inn' })).toBe('Inn · Door')
    expect(refName(project, { id: 'exit', type: 'ref', to: ['$level'] }, { target: 'inn' })).toBe('Inn')
    expect(refName(project, door, { target: 'gone', container: 'inn' })).toBeUndefined()
  })
})
