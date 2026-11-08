import { packTile } from '../model/cells-codec'
import type { Project } from '../model/project-types'

// Where a new level starts painting. The entities layer comes first in a template's list (front to back), but a first
// tap there places a Player start or a zone the person did not ask for. The ground is what a first tap should make.

/** The layer and palette word a level editor opens with. */
export interface Brush {
  readonly layer: string
  /** An IntGrid value or a packed tile; 0 erases. */
  readonly word: number
}

/**
 * The project's ground: the first value of its first IntGrid layer, else the first tile of its first tiles layer, else
 * the first layer of any kind. Never an entities layer when another layer can be painted.
 */
export function firstBrush(project: Project): Brush {
  const layers = project.defs.layers
  const grid = layers.find((def) => def.kind === 'intgrid' && def.values.length > 0)
  if (grid?.kind === 'intgrid') return { layer: grid.id, word: grid.values[0]?.value ?? 0 }
  const tiles = layers.find((def) => def.kind === 'tiles')
  if (tiles !== undefined) return { layer: tiles.id, word: packTile(0, false, false) }
  const [first] = layers
  return { layer: first?.id ?? '', word: 0 }
}
