import { describe, expect, it } from 'vitest'
import { checkProject } from '../../profiles/level-project/project-checks'
import { blankTemplate } from '../../profiles/level-project/templates/blank'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { createFakeHistory } from '../../testing/fake-history'
import { entity, withEntities, withLayer, withLevel, withNewLevel } from '../../testing/project-edit'
import { counterIds } from '../ids'
import type { EntityInstance, Project } from '../project-types'
import { type DefinitionRef, definitionUses, deleteDefinition } from './definition-uses'
import { addEntityDef } from './entity-def-edits'
import { placeEntity } from './entity-edits'
import { addField } from './field-edits'
import { addLayerDef } from './layer-def-edits'

const platformer = (): Project => platformerTemplate.create(counterIds())
const items = (p: Project): EntityInstance[] =>
  p.levels.flatMap((level) => level.layers.flatMap((layer) => (layer.kind === 'entities' ? layer.items : [])))
const errors = (p: Project): string[] =>
  checkProject(p, {})
    .filter((d) => d.severity === 'error')
    .map((d) => `${d.code} ${d.path}`)
const paths = (p: Project, ref: DefinitionRef): string[] => definitionUses(p, ref).map((use) => use.path)

/** Two slimes in level 1, one in level 2, and a coin. */
const slimes = (): Project => {
  const two = withNewLevel(platformer(), 'level-2', { x: 512, y: 0 })
  const first = withEntities(two, 'level-1', [
    entity('slime-a', 'slime', 64, 256, { hp: 3 }),
    entity('coin-a', 'coin', 96, 256),
    entity('slime-b', 'slime', 128, 256, { hp: 4, tint: '#000000' }),
  ])
  return withEntities(first, 'level-2', [entity('slime-c', 'slime', 64, 256, { hp: 5 })])
}

describe('definitionUses', () => {
  it('lists every instance of an entity definition, level by level', () => {
    expect(paths(slimes(), { kind: 'entity', id: 'slime' })).toEqual([
      'levels[level-1].layers[entities].items[slime-a]',
      'levels[level-1].layers[entities].items[slime-b]',
      'levels[level-2].layers[entities].items[slime-c]',
    ])
    const [use] = definitionUses(slimes(), { kind: 'entity', id: 'slime' })
    expect(use?.message).toMatch(/Slime.*Level 1/)
    expect(definitionUses(slimes(), { kind: 'entity', id: 'checkpoint' })).toEqual([])
  })

  it('lists the instances and levels that hold a value for a field', () => {
    expect(paths(slimes(), { kind: 'field', owner: { entity: 'slime' }, id: 'tint' })).toEqual([
      'levels[level-1].layers[entities].items[slime-b].fields.tint',
    ])
    const scored = withLevel(slimes(), 'level-2', (level) => ({ ...level, fields: { music: 'boss' } }))
    expect(paths(scored, { kind: 'field', owner: 'level', id: 'music' })).toEqual([
      'levels[level-2].fields.music',
    ])
    expect(paths(slimes(), { kind: 'field', owner: 'level', id: 'music' })).toEqual([])
  })

  it("does not count another definition's instance that holds a stray value under the same id", () => {
    const stray = withEntities(slimes(), 'level-2', [entity('coin-x', 'coin', 0, 0, { tint: '#ffffff' })])
    expect(paths(stray, { kind: 'field', owner: { entity: 'slime' }, id: 'tint' })).toEqual([
      'levels[level-1].layers[entities].items[slime-b].fields.tint',
    ])
  })

  it('lists the levels with content on a layer and the auto layers that read it', () => {
    expect(paths(slimes(), { kind: 'layer', id: 'collision' })).toEqual([
      'levels[level-1].layers[collision]',
      'defs.layers[ground]',
    ])
    expect(paths(slimes(), { kind: 'layer', id: 'entities' })).toEqual([
      'levels[level-1].layers[entities]',
      'levels[level-2].layers[entities]',
    ])
    expect(paths(slimes(), { kind: 'layer', id: 'decor' })).toEqual([])
    const painted = withLayer(slimes(), 'level-2', 'ground', (layer) =>
      layer.kind === 'auto' ? { ...layer, overrides: layer.overrides.set(0, 0, 3) } : layer,
    )
    expect(paths(painted, { kind: 'layer', id: 'ground' })).toEqual(['levels[level-2].layers[ground]'])
    expect(paths(slimes(), { kind: 'layer', id: 'ground' })).toEqual([])
  })

  it('throws for a definition that does not exist', () => {
    expect(() => definitionUses(slimes(), { kind: 'entity', id: 'dragon' })).toThrow(/no entity definition/)
    expect(() => definitionUses(slimes(), { kind: 'layer', id: 'sky' })).toThrow(/no layer definition/)
    expect(() => definitionUses(slimes(), { kind: 'field', owner: 'level', id: 'par' })).toThrow(
      /no field "par"/,
    )
  })
})

describe('deleteDefinition (G-f)', () => {
  it('refuses to delete an entity definition in use and lists the exact instances', () => {
    const result = deleteDefinition(slimes(), { kind: 'entity', id: 'slime' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.uses).toEqual(
      definitionUses(slimes(), { kind: 'entity', id: 'slime' }),
    )
  })

  it('deletes a definition nothing uses without asking', () => {
    const project = slimes()
    const result = deleteDefinition(project, { kind: 'entity', id: 'checkpoint' })
    if (!result.ok) throw new Error('refused')
    expect(result.project.defs.entities.map((def) => def.id)).not.toContain('checkpoint')
    expect(result.project.levels).toBe(project.levels)
  })

  it('anyway removes the definition and every instance of it', () => {
    const result = deleteDefinition(slimes(), { kind: 'entity', id: 'slime' }, { anyway: true })
    if (!result.ok) throw new Error('refused')
    expect(result.project.defs.entities.map((def) => def.id)).not.toContain('slime')
    expect(items(result.project).map((item) => item.id)).toEqual(['00000001', 'coin-a'])
    expect(errors(result.project)).toEqual([])
  })

  it('is one undo step whose undo is the project as it was', () => {
    const project = slimes()
    const history = createFakeHistory(project)
    const ref: DefinitionRef = { kind: 'entity', id: 'slime' }
    const refusal = deleteDefinition(history.state, ref)
    expect(refusal.ok).toBe(false)
    history.apply('Delete Slime', (current) => {
      const result = deleteDefinition(current, ref, { anyway: true })
      return result.ok ? result.project : current
    })
    expect(history.steps).toHaveLength(1)
    expect(history.steps[0]?.before).toBe(project)
    expect(items(history.state).some((item) => item.def === 'slime')).toBe(false)
  })

  it('anyway removes a field and every value of it', () => {
    const ref: DefinitionRef = { kind: 'field', owner: { entity: 'slime' }, id: 'tint' }
    expect(deleteDefinition(slimes(), ref).ok).toBe(false)
    const result = deleteDefinition(slimes(), ref, { anyway: true })
    if (!result.ok) throw new Error('refused')
    expect(result.project.defs.entities.find((def) => def.id === 'slime')?.fields.map((f) => f.id)).toEqual([
      'hp',
      'patrol',
    ])
    expect(items(result.project).find((item) => item.id === 'slime-b')?.fields).toEqual({ hp: 4 })
    expect(errors(result.project)).toEqual([])
  })

  it('anyway removes a level field from every level', () => {
    const scored = withLevel(slimes(), 'level-2', (level) => ({ ...level, fields: { music: 'boss' } }))
    const ref: DefinitionRef = { kind: 'field', owner: 'level', id: 'music' }
    expect(deleteDefinition(scored, ref).ok).toBe(false)
    const result = deleteDefinition(scored, ref, { anyway: true })
    if (!result.ok) throw new Error('refused')
    expect(result.project.defs.levelFields).toEqual([])
    expect(result.project.levels.map((level) => level.fields)).toEqual([{}, {}])
  })

  it('anyway removes a layer, its instance in every level and the auto layers that read it', () => {
    const result = deleteDefinition(slimes(), { kind: 'layer', id: 'collision' }, { anyway: true })
    if (!result.ok) throw new Error('refused')
    expect(result.project.defs.layers.map((def) => def.id)).toEqual(['entities', 'decor'])
    for (const level of result.project.levels)
      expect(level.layers.map((l) => l.def)).toEqual(['entities', 'decor'])
    expect(errors(result.project)).toEqual([])
  })

  it('deletes an empty layer without asking', () => {
    const result = deleteDefinition(slimes(), { kind: 'layer', id: 'decor' })
    expect(result.ok && result.project.defs.layers.map((def) => def.id)).toEqual([
      'entities',
      'ground',
      'collision',
    ])
  })
})

describe('a project defined from blank (G-t)', () => {
  it('takes a new layer and an entity with fields, and places one with no code change', () => {
    let project = blankTemplate.create(counterIds())
    project = addLayerDef(project, {
      id: 'zones',
      label: 'Zones',
      kind: 'intgrid',
      grid: 16,
      values: [{ value: 1, id: 'goal', color: '#22c55e' }],
      opacity: 0.5,
    })
    project = addEntityDef(project, {
      id: 'block',
      label: 'Block',
      color: '#f97316',
      fields: [],
      shape: 'rect',
      size: { w: 16, h: 16 },
      pivot: { x: 0, y: 0 },
      resizable: 'none',
      tags: ['puzzle'],
    })
    project = addField(project, { entity: 'block' }, { id: 'pushable', type: 'bool', default: true })
    project = placeEntity(
      project,
      { level: 'level-1', layer: 'entities' },
      { id: 'b1', def: 'block', x: 32, y: 32 },
    )
    expect(items(project)).toEqual([{ id: 'b1', def: 'block', x: 32, y: 32, fields: { pushable: true } }])
    expect(errors(project)).toEqual([])
  })
})
