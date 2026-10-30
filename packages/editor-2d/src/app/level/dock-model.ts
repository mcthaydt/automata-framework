import type { Project, Size } from '../../model/project-types'
import { findLevel } from '../../model/world/level-edits'

// The Level view's dock (2D editor spec §8, the Level row; plan ED2D.4c4b step 4): one card per level the world
// places, in the world's order, the open one marked. Tapping a card is the controller's `setLevel`.

export interface LevelCard {
  readonly id: string
  readonly name: string
  readonly size: Size
  readonly current: boolean
}

export function levelCards(project: Project, world: string, current: string): readonly LevelCard[] {
  const found = project.worlds.find((candidate) => candidate.id === world)
  if (found === undefined) throw new RangeError(`no world "${world}"`)
  return found.placements.map((placement) => {
    const level = findLevel(project, placement.level)
    return { id: level.id, name: level.name, size: level.size, current: level.id === current }
  })
}
