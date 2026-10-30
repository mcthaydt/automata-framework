import { deleteEntity, duplicateEntity, moveEntity } from '../../model/commands/entity-edits'
import type { LayerTarget } from '../../model/commands/layer-target'
import type { IdSource } from '../../model/ids'
import type { EntityInstance, Project } from '../../model/project-types'
import { findLevel } from '../../model/world/level-edits'
import type { Point } from '../../tiles/footprint'

// What the inspector's buttons and the shortcuts do to the whole selection (plan ED2D.4c4b decision 2, §12): delete,
// duplicate and nudge, each one project change the view applies as one undo step. The selection may span entities
// layers, so each instance is edited on its own layer; an id the level no longer has is skipped, since the selection
// is refreshed only after the history changes.

interface Selected {
  readonly target: LayerTarget
  readonly item: EntityInstance
  /** The layer's cell size in px. */
  readonly grid: number
}

function selectedOf(project: Project, level: string, ids: readonly string[]): readonly Selected[] {
  const wanted = new Set(ids)
  const found: Selected[] = []
  for (const layer of findLevel(project, level).layers) {
    if (layer.kind !== 'entities') continue
    const def = project.defs.layers.find((candidate) => candidate.id === layer.def)
    const grid = def !== undefined && 'grid' in def ? def.grid : 1
    for (const item of layer.items)
      if (wanted.has(item.id)) found.push({ target: { level, layer: layer.def }, item, grid })
  }
  return found
}

export function deleteSelected(project: Project, level: string, ids: readonly string[]): Project {
  return selectedOf(project, level, ids).reduce(
    (next, { target, item }) => deleteEntity(next, target, item.id),
    project,
  )
}

/** Copies one cell down and right; a `single` definition is left out, so the copies may be fewer than the selection. */
export function duplicateSelected(
  project: Project,
  level: string,
  ids: readonly string[],
  idSource: IdSource,
): { readonly project: Project; readonly copies: readonly string[] } {
  let next = project
  const copies: string[] = []
  for (const { target, item, grid } of selectedOf(project, level, ids)) {
    if (project.defs.entities.find((def) => def.id === item.def)?.single === true) continue
    const copy = idSource.next()
    next = duplicateEntity(next, target, item.id, copy, { x: grid, y: grid })
    copies.push(copy)
  }
  return { project: next, copies }
}

/** `by` is in cells of each instance's layer. */
export function nudgeSelected(project: Project, level: string, ids: readonly string[], by: Point): Project {
  return selectedOf(project, level, ids).reduce(
    (next, { target, item, grid }) =>
      moveEntity(next, target, item.id, item.x + by.x * grid, item.y + by.y * grid),
    project,
  )
}
