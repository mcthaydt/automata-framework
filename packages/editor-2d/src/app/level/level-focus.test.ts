import { describe, expect, it } from 'vitest'
import { placeEntity } from '../../model/commands/entity-edits'
import { counterIds } from '../../model/ids'
import type { Project } from '../../model/project-types'
import { platformerTemplate } from '../../profiles/level-project/templates/platformer'
import { levelFocus } from './level-focus'

function withSlime(): Project {
  const project = platformerTemplate.create(counterIds())
  return placeEntity(
    project,
    { level: 'level-1', layer: 'entities' },
    { id: 'slime-a', def: 'slime', x: 32, y: 48 },
  )
}

describe('levelFocus', () => {
  it('finds the level, layer and instance an item path names, a field under it included', () => {
    const project = withSlime()
    const focus = { level: 'level-1', layer: 'entities', item: 'slime-a' }
    expect(levelFocus(project, 'levels[level-1].layers[entities].items[slime-a]')).toEqual(focus)
    expect(levelFocus(project, 'levels[level-1].layers[entities].items[slime-a].fields.hp')).toEqual(focus)
  })

  it('finds a layer and a level', () => {
    const project = withSlime()
    expect(levelFocus(project, 'levels[level-1].layers[collision]')).toEqual({
      level: 'level-1',
      layer: 'collision',
    })
    expect(levelFocus(project, 'levels[level-1]')).toEqual({ level: 'level-1' })
  })

  it('keeps only what still exists, and has nothing for a definition path', () => {
    const project = withSlime()
    expect(levelFocus(project, 'levels[level-1].layers[entities].items[gone]')).toEqual({
      level: 'level-1',
      layer: 'entities',
    })
    expect(levelFocus(project, 'levels[level-1].layers[nope]')).toEqual({ level: 'level-1' })
    expect(levelFocus(project, 'levels[nope]')).toBeUndefined()
    expect(levelFocus(project, 'defs.tilesets[terrain]')).toBeUndefined()
  })
})
