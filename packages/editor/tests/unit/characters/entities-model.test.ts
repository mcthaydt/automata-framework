import type { FieldDef } from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import {
  definitionPreview,
  definitionRows,
  fieldRows,
  fieldSummary,
  levelFieldRows,
  resolveSelection,
  useLabel,
  withType,
} from '#src/features/characters/entities-model.ts'
import { deleteDefinition } from '#src/shared/level-2d/model/commands/definition-uses.ts'
import { placeEntity } from '#src/shared/level-2d/model/commands/entity-edits.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { EntityDef2D, Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'

const platformer = (): Project => platformerTemplate.create(counterIds())
const defOf = (project: Project, id: string): EntityDef2D =>
  project.defs.entities.find((def) => def.id === id) as EntityDef2D
const target = { level: 'level-1', layer: 'entities' } as const

function withSlimes(count: number): Project {
  let project = platformer()
  for (let index = 0; index < count; index++)
    project = placeEntity(project, target, {
      id: `slime-${index + 1}`,
      def: 'slime',
      x: 32 + index * 16,
      y: 64,
    })
  return project
}

describe('the Entities panel rows', () => {
  it('lists each definition with its colour, and says when a level holds only one', () => {
    const rows = definitionRows(platformer())
    expect(rows.map((row) => row.id)).toEqual([
      'player-start',
      'slime',
      'coin',
      'door',
      'checkpoint',
      'moving-platform',
    ])
    expect(rows[0]).toEqual({
      id: 'player-start',
      label: 'Player start',
      color: '#22c55e',
      summary: 'One per level',
      character: true,
    })
    expect(rows[1]?.summary).toBe('')
    expect(rows[3]?.summary).toBe('')
  })

  it('tells the characters from the other things a level holds, by the definition’s tag', () => {
    const rows = definitionRows(platformer())
    expect(rows.filter((row) => row.character).map((row) => row.id)).toEqual(['player-start', 'slime'])
    expect(rows.filter((row) => !row.character).map((row) => row.id)).toEqual([
      'coin',
      'door',
      'checkpoint',
      'moving-platform',
    ])
  })

  it('lists the level fields of every template', () => {
    expect(levelFieldRows(platformer())).toEqual([
      { id: 'music', label: 'Music', type: 'text', summary: 'text · default “”', required: false },
    ])
    expect(levelFieldRows(topdownRpgTemplate.create(counterIds())).map((row) => row.id)).toEqual(['area'])
  })

  it('summarises a field by its type and the settings that type has', () => {
    const summary = (field: Omit<FieldDef, 'id'>): string => fieldSummary({ id: 'f', ...field })
    expect(summary({ type: 'text', default: '' })).toBe('text · default “”')
    expect(summary({ type: 'text', multiline: true })).toBe('text · multiline')
    expect(summary({ type: 'enum', options: ['N', 'E', 'S', 'W'], default: 'S' })).toBe(
      'enum · N E S W · default S',
    )
    expect(summary({ type: 'int', min: 1, max: 9, default: 3 })).toBe('int · 1 to 9 · default 3')
    expect(summary({ type: 'float', min: 0 })).toBe('float · at least 0')
    expect(summary({ type: 'int', max: 4 })).toBe('int · at most 4')
    expect(summary({ type: 'point', list: true })).toBe('point · list')
    expect(summary({ type: 'point', default: { x: 64, y: 0 } })).toBe('point · default 64, 0')
    expect(summary({ type: 'bool', default: true })).toBe('bool · default on')
    expect(summary({ type: 'ref', to: ['door', 'checkpoint'] })).toBe('ref · door checkpoint')
    expect(summary({ type: 'color', default: '#7c3aed' })).toBe('color · default #7c3aed')
  })

  it('marks required fields in the list', () => {
    const door = platformer().defs.entities.find((def) => def.id === 'door')
    expect(fieldRows(door?.fields ?? [])).toEqual([
      {
        id: 'target',
        label: 'Leads to',
        type: 'ref',
        summary: 'ref · door checkpoint player-start',
        required: true,
      },
    ])
  })

  it('names a use by its instance and level, and keeps any other path as it is', () => {
    expect(useLabel('levels[level-1].layers[entities].items[slime-2]')).toBe('slime-2 in level-1')
    expect(useLabel('levels[level-1].layers[entities].items[slime-2].fields.hp')).toBe('slime-2 in level-1')
    expect(useLabel('levels[level-1]')).toBe('level-1')
    expect(useLabel('levels[level-1].fields.music')).toBe('level-1')
    expect(useLabel('defs.layers[ground]')).toBe('defs.layers[ground]')
  })
})

describe('the Entities selection', () => {
  it('starts on the first definition and its first field', () => {
    const selection = resolveSelection(platformer(), {})
    expect(selection.owner).toEqual({ entity: 'player-start' })
    expect(selection.def?.id).toBe('player-start')
    expect(selection.field).toBeUndefined()
    const slime = resolveSelection(platformer(), { owner: { entity: 'slime' } })
    expect(slime.field?.id).toBe('hp')
    expect(slime.fields.map((field) => field.id)).toEqual(['hp', 'patrol', 'tint'])
  })

  it('selects the level fields as the owner `level`', () => {
    const selection = resolveSelection(platformer(), { owner: 'level', field: 'music' })
    expect(selection.owner).toBe('level')
    expect(selection.def).toBeUndefined()
    expect(selection.field?.id).toBe('music')
  })

  it('falls back to the first remaining definition or field when the selected one is gone', () => {
    const project = platformer()
    expect(resolveSelection(project, { owner: { entity: 'gone' } }).def?.id).toBe('player-start')
    expect(resolveSelection(project, { owner: { entity: 'slime' }, field: 'gone' }).field?.id).toBe('hp')
  })

  it('selects the level fields when there is no definition left', () => {
    let project = platformer()
    for (const def of project.defs.entities) {
      const result = deleteDefinition(project, { kind: 'entity', id: def.id }, { anyway: true })
      if (result.ok) project = result.project
    }
    expect(resolveSelection(project, {}).owner).toBe('level')
  })
})

describe('the definition preview', () => {
  const room = { w: 554, h: 400 }

  it('scales the shape by the largest whole number that fits, at most 8', () => {
    const preview = definitionPreview(platformer(), 'player-start', room)
    expect(preview.scale).toBe(8)
    expect(preview.box).toEqual({ w: 128, h: 192 })
    expect(preview.pivot).toEqual({ x: 64, y: 192 })
    expect(preview.name).toBe('Player start')
    expect(preview.sizeText).toBe('Box, 16 × 24 px')
  })

  it('scales a large shape down to fit, never below 1', () => {
    const project = platformer()
    const big = { ...defOf(project, 'player-start'), id: 'big', size: { w: 64, h: 64 } }
    const tall = { ...big, id: 'tall', size: { w: 8, h: 900 } }
    const grown = { ...project, defs: { ...project.defs, entities: [...project.defs.entities, big, tall] } }
    expect(definitionPreview(grown, 'big', room).scale).toBe(6)
    expect(definitionPreview(grown, 'tall', room).scale).toBe(1)
  })

  it('counts the instances and the levels they are in', () => {
    expect(definitionPreview(platformer(), 'slime', room).instances).toBe('Not in any level yet')
    expect(definitionPreview(platformer(), 'player-start', room).instances).toBe('1 placed in 1 level')
    expect(definitionPreview(withSlimes(2), 'slime', room).instances).toBe('2 placed in 1 level')
  })

  it('carries the tile the definition draws with', () => {
    const project = platformer()
    const tiled = { ...defOf(project, 'coin'), tile: { tileset: 'terrain', index: 3 } }
    const next = { ...project, defs: { ...project.defs, entities: [tiled] } }
    expect(definitionPreview(next, tiled.id, room).tile).toEqual({ tileset: 'terrain', index: 3 })
  })
})

describe('changing a field type', () => {
  it('keeps the id, label, list and required, and drops the old type settings', () => {
    const field: FieldDef = {
      id: 'hp',
      type: 'int',
      label: 'HP',
      required: true,
      min: 1,
      max: 9,
      step: 1,
      default: 3,
    }
    expect(withType(field, 'text')).toEqual({ id: 'hp', type: 'text', label: 'HP', required: true })
    expect(withType({ id: 'path', type: 'point', list: true }, 'float')).toEqual({
      id: 'path',
      type: 'float',
      list: true,
    })
  })

  it('gives a new enum one option so it is valid', () => {
    expect(withType({ id: 'f', type: 'text', default: '' }, 'enum')).toEqual({
      id: 'f',
      type: 'enum',
      options: ['a'],
    })
  })

  it('changes nothing for the same type', () => {
    const field: FieldDef = { id: 'f', type: 'text', default: 'x' }
    expect(withType(field, 'text')).toBe(field)
  })
})
