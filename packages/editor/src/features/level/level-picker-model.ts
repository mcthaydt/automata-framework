import type { HeaderItem } from '../../shared/kit/ports/suite-editor'
import type { EditHistory } from '../../shared/level-2d/model/edit-history'
import { MAX_LEVELS } from '../../shared/level-2d/model/project.schema'
import type { Project } from '../../shared/level-2d/model/project-types'
import { addLevel } from '../../shared/level-2d/model/world/level-edits'
import { newLevelInput } from '../../shared/level-2d/model/world/world-model'
import { levelList } from './level-list'

// What the level picker lists and does, for the two places that draw it: the standalone Level view's bar and the suite's
// breadcrumb (`levels-2d-header.ts`). The menu lists the levels of the open level's world in the world's order, the open
// one marked, then "New level", which adds the first free "Level N" as one undo step; a game already holding the most
// levels it may keeps New level in the menu, saying why it cannot add one.

/** The id of the menu's last row, which adds a level instead of opening one. */
export const NEW_LEVEL = 'new-level'

/** The world the open level is placed in; a level placed nowhere has no neighbours to list. */
function worldOf(project: Project, level: string) {
  return project.worlds.find((each) => each.placements.some((placement) => placement.level === level))
}

/** The open level's name, which the picker's button shows. */
export function levelName(project: Project, level: string): string {
  return project.levels.find((each) => each.id === level)?.name ?? ''
}

/** The menu's rows; none for a level placed in no world. */
export function pickerItems(project: Project, level: string): readonly (HeaderItem | 'separator')[] {
  const world = worldOf(project, level)
  if (world === undefined) return []
  const full = project.levels.length >= MAX_LEVELS
  return [
    ...levelList(project, world.id, level).map((card) => ({
      id: card.id,
      label: card.name,
      detail: card.current ? 'Open' : undefined,
    })),
    'separator',
    {
      id: NEW_LEVEL,
      label: 'New level',
      disabled: full,
      reason: full ? `A game holds at most ${MAX_LEVELS} levels.` : undefined,
    },
  ]
}

/**
 * Carries out a choice: opens the level (`open`), or for New level adds one beside the world's levels and opens that.
 * `project` is the document now.
 */
export function chooseLevel(
  id: string,
  project: Project,
  level: string,
  edits: EditHistory,
  open: (id: string) => void,
): void {
  if (id !== NEW_LEVEL) {
    open(id)
    return
  }
  const world = worldOf(project, level)
  if (world === undefined) return
  const input = newLevelInput(project, world.id)
  edits.apply('Add level', (current) => addLevel(current, input))
  open(input.id)
}
