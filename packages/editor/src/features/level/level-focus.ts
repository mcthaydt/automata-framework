import type { Project } from '../../shared/level-2d/model/project-types'

// Where Locate opens the Level view (plan ED2D.7a step 4): the level, layer and instance a finding's path names.

export interface LevelFocus {
  readonly level: string
  readonly layer?: string
  readonly item?: string
}

const PATH = /^levels\[([^\]]+)\](?:\.layers\[([^\]]+)\](?:\.items\[([^\]]+)\])?)?/

/** Undefined for a path outside the levels or a level that is gone; a gone layer or instance is left out. */
export function levelFocus(project: Project, path: string): LevelFocus | undefined {
  const match = PATH.exec(path)
  const level = match === null ? undefined : project.levels.find((each) => each.id === match[1])
  if (match === null || level === undefined) return undefined
  const layer = level.layers.find((each) => each.def === match[2])
  if (layer === undefined) return { level: level.id }
  const items = layer.kind === 'entities' || layer.kind === 'objects' ? layer.items : []
  const item = items.find((each) => each.id === match[3])
  return item === undefined
    ? { level: level.id, layer: layer.def }
    : { level: level.id, layer: layer.def, item: item.id }
}
