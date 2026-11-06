import { counterIds } from '../../shared/level-2d/model/ids'
import type { Project } from '../../shared/level-2d/model/project-types'
import { topdownRpgTemplate } from '../../shared/level-2d/profiles/level-project/templates/topdown-rpg'
import { entity, renameLevel, withEntities, withLevel, withNewLevel } from './project-edit'

/**
 * Two linked RPG maps (plan ED2D.6c): the village (`map-1`, with the template's player start at 160, 120) and the inn
 * (`inn`, placed at 400, 0), a door each way, and a chest in the inn. The template's door and warp point at a
 * `player-start`, a `door` or a `warp`.
 */
export function linkedMaps(): Project {
  const base = topdownRpgTemplate.create(counterIds())
  const named = withLevel(base, 'map-1', (level) => ({ ...level, name: 'Village' }))
  const inn = renameLevel(withNewLevel(named, 'inn', { x: 400, y: 0 }), 'inn', 'inn', 'Inn')
  return withEntities(
    withEntities(inn, 'map-1', [
      entity('door-out', 'door', 96, 64, { target: { target: 'door-in', container: 'inn' } }),
    ]),
    'inn',
    [
      entity('door-in', 'door', 32, 200, { target: { target: 'door-out', container: 'map-1' } }),
      entity('chest-1', 'chest', 64, 64),
    ],
  )
}
