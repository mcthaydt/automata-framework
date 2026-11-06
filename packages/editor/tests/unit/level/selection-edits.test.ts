import { describe, expect, it } from 'vitest'
import { deleteSelected, duplicateSelected, nudgeSelected } from '#src/features/level/selection-edits.ts'
import { placeEntity } from '#src/shared/level-2d/model/commands/entity-edits.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { EntityInstance, Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'

const target = { level: 'level-1', layer: 'entities' }

function setup(): Project {
  let project = platformerTemplate.create(counterIds())
  project = placeEntity(project, target, { id: 'slime-a', def: 'slime', x: 32, y: 48 })
  return placeEntity(project, target, { id: 'coin-a', def: 'coin', x: 64, y: 16 })
}

const items = (project: Project): readonly EntityInstance[] =>
  project.levels[0]?.layers.flatMap((layer) => (layer.kind === 'entities' ? layer.items : [])) ?? []
const byId = (project: Project, id: string) => items(project).find((item) => item.id === id)

describe('selection edits', () => {
  it('deletes every selected instance and skips ids the level no longer has', () => {
    const next = deleteSelected(setup(), 'level-1', ['slime-a', 'coin-a', 'gone'])
    expect(items(next).some((item) => item.id === 'slime-a' || item.id === 'coin-a')).toBe(false)
  })

  it('duplicates each selected instance one cell on, returning the copies to select', () => {
    const ids = {
      next: (() => {
        let n = 0
        return () => `copy-${++n}`
      })(),
    }
    const { project, copies } = duplicateSelected(setup(), 'level-1', ['slime-a', 'coin-a'], ids)
    expect(copies).toEqual(['copy-1', 'copy-2'])
    expect(byId(project, 'copy-1')).toMatchObject({ def: 'slime', x: 48, y: 64 })
    expect(byId(project, 'copy-2')).toMatchObject({ def: 'coin', x: 80, y: 32 })
  })

  it('leaves a single definition out of a duplicate', () => {
    const ids = { next: () => 'copy' }
    const start = items(setup()).find((item) => item.def === 'player-start')?.id ?? ''
    const { copies } = duplicateSelected(setup(), 'level-1', [start], ids)
    expect(copies).toEqual([])
  })

  it('nudges by whole cells of the layer grid', () => {
    const next = nudgeSelected(setup(), 'level-1', ['slime-a'], { x: -1, y: 8 })
    expect(byId(next, 'slime-a')).toMatchObject({ x: 16, y: 176 })
  })
})
