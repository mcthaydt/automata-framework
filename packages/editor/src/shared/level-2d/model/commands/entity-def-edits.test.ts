import { describe, expect, it } from 'vitest'
import { entity, withEntities } from '../../../../testing/level-2d/project-edit'
import { checkProject } from '../../profiles/level-project/project-checks'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { counterIds } from '../ids'
import type { EntityDef2D, Project } from '../project-types'
import { addEntityDef, editEntityDef, renameEntityDef } from './entity-def-edits'

const platformer = (): Project => platformerTemplate.create(counterIds())
const defOf = (p: Project, id: string): EntityDef2D | undefined =>
  p.defs.entities.find((def) => def.id === id)
const errors = (p: Project): string[] =>
  checkProject(p, {})
    .filter((d) => d.severity === 'error')
    .map((d) => `${d.code} ${d.path}`)

const crate: EntityDef2D = {
  id: 'crate',
  label: 'Crate',
  color: '#a16207',
  fields: [{ id: 'weight', type: 'int', min: 1, max: 9, default: 2 }],
  shape: 'tile',
  size: { w: 16, h: 16 },
  pivot: { x: 0.5, y: 1 },
  resizable: 'none',
  tile: { tileset: 'terrain', index: 51 },
  tags: ['prop'],
}

describe('addEntityDef', () => {
  it('appends a definition and leaves the levels alone', () => {
    const project = platformer()
    const next = addEntityDef(project, crate)
    expect(next.defs.entities.at(-1)).toBe(crate)
    expect(next.levels).toBe(project.levels)
    expect(errors(next)).toEqual([])
  })

  it("refuses what the schema and the kit's rules refuse", () => {
    expect(() => addEntityDef(platformer(), { ...crate, id: 'Crate' })).toThrow(/not an entity id/)
    expect(() => addEntityDef(platformer(), { ...crate, color: 'brown' })).toThrow(/color|colour|token/)
    expect(() =>
      addEntityDef(platformer(), {
        ...crate,
        fields: [crate.fields[0], crate.fields[0]] as EntityDef2D['fields'],
      }),
    ).toThrow(/twice/)
    expect(() => addEntityDef(platformer(), { ...crate, pivot: { x: 2, y: 0 } })).toThrow(/pivot/)
    expect(() => addEntityDef(platformer(), { ...crate, size: { w: 0, h: 16 } })).toThrow(/size/)
  })

  it('refuses an id another definition has and a tile that does not exist', () => {
    expect(() => addEntityDef(platformer(), { ...crate, id: 'slime' })).toThrow(/already/)
    expect(() => addEntityDef(platformer(), { ...crate, tile: { tileset: 'nope', index: 0 } })).toThrow(
      /no tileset "nope"/,
    )
    expect(() => addEntityDef(platformer(), { ...crate, tile: { tileset: 'terrain', index: 64 } })).toThrow(
      /64/,
    )
  })
})

describe('editEntityDef', () => {
  it('changes what the canvas draws and the definition preview shows', () => {
    const project = platformer()
    const next = editEntityDef(project, 'coin', {
      label: 'Gem',
      color: '#22d3ee',
      shape: 'rect',
      size: { w: 10, h: 12 },
      pivot: { x: 0, y: 0 },
      tile: { tileset: 'terrain', index: 60 },
      tags: ['pickup', 'rare'],
      min: { per: 'level', count: 1 },
    })
    expect(defOf(next, 'coin')).toMatchObject({
      label: 'Gem',
      shape: 'rect',
      size: { w: 10, h: 12 },
      tile: { tileset: 'terrain', index: 60 },
      tags: ['pickup', 'rare'],
    })
    expect(defOf(next, 'coin')?.fields).toBe(defOf(project, 'coin')?.fields)
    expect(next.levels).toBe(project.levels)
  })

  it('clears an optional property given as undefined', () => {
    const withTile = editEntityDef(platformer(), 'coin', { tile: { tileset: 'terrain', index: 60 } })
    const cleared = editEntityDef(withTile, 'coin', { tile: undefined, label: undefined })
    expect('tile' in (defOf(cleared, 'coin') ?? {})).toBe(false)
    expect('label' in (defOf(cleared, 'coin') ?? {})).toBe(false)
    expect(errors(cleared)).toEqual([])
  })

  it('returns the same project for the values the definition has', () => {
    const project = platformer()
    expect(editEntityDef(project, 'coin', { label: 'Coin', size: { w: 8, h: 8 } })).toBe(project)
    expect(editEntityDef(project, 'coin', {})).toBe(project)
  })

  it('makes a definition single and back, which the Checks then hold each level to', () => {
    const single = editEntityDef(platformer(), 'coin', { single: true })
    expect(defOf(single, 'coin')?.single).toBe(true)
    expect(defOf(editEntityDef(single, 'coin', { single: false }), 'coin')?.single).toBe(false)
    const cleared = editEntityDef(single, 'coin', { single: undefined })
    expect('single' in (defOf(cleared, 'coin') ?? {})).toBe(false)
  })

  it('refuses a bad value and an unknown definition', () => {
    expect(() => editEntityDef(platformer(), 'coin', { size: { w: -1, h: 8 } })).toThrow(RangeError)
    expect(() => editEntityDef(platformer(), 'coin', { tile: { tileset: 'terrain', index: 99 } })).toThrow(
      /99/,
    )
    expect(() => editEntityDef(platformer(), 'dragon', { label: 'x' })).toThrow(/no entity definition/)
  })
})

describe('renameEntityDef', () => {
  const placed = (): Project =>
    withEntities(platformer(), 'level-1', [
      entity('door-a', 'door', 64, 256, { target: { target: 'cp-a' } }),
      entity('cp-a', 'checkpoint', 128, 256),
    ])

  it('renames the definition, every instance of it and every ref field that names it', () => {
    const next = renameEntityDef(placed(), 'checkpoint', 'save-point')
    expect(defOf(next, 'save-point')?.label).toBe('Checkpoint')
    expect(defOf(next, 'checkpoint')).toBeUndefined()
    const items = next.levels[0]?.layers[0]
    expect(items?.kind === 'entities' && items.items.find((item) => item.id === 'cp-a')?.def).toBe(
      'save-point',
    )
    expect(defOf(next, 'door')?.fields[0]?.to).toEqual(['door', 'save-point', 'player-start'])
    expect(errors(next)).toEqual(errors(placed()))
  })

  it('renames the definition in a level field that may point at it', () => {
    const project = {
      ...placed(),
      defs: {
        ...placed().defs,
        levelFields: [{ id: 'spawn', type: 'ref' as const, to: ['checkpoint'] }],
      },
    }
    expect(renameEntityDef(project, 'checkpoint', 'save-point').defs.levelFields[0]?.to).toEqual([
      'save-point',
    ])
  })

  it('returns the same project for the same id and refuses a taken or bad one', () => {
    const project = placed()
    expect(renameEntityDef(project, 'checkpoint', 'checkpoint')).toBe(project)
    expect(() => renameEntityDef(project, 'checkpoint', 'door')).toThrow(/already/)
    expect(() => renameEntityDef(project, 'checkpoint', 'Save')).toThrow(/not an entity id/)
    expect(() => renameEntityDef(project, 'dragon', 'wyrm')).toThrow(/no entity definition/)
  })
})
