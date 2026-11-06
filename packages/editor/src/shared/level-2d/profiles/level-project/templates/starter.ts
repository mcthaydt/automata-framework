import type { GridEditor } from '../../../model/grid'
import { emptyLayers } from '../../../model/level-layers'
import type {
  Background,
  Definitions,
  EntityInstance,
  LayerInstance,
  Project,
  Size,
} from '../../../model/project-types'

// What the three templates share: a project with one free world holding one starter level, and the two edits a starter
// level needs (paint some cells, place some entities). Templates are data, so these stay plain functions.

export interface StarterLevel {
  readonly id: string
  readonly name: string
  readonly size: Size
  readonly background: Background
}

export function starterProject(
  name: string,
  template: string,
  defs: Definitions,
  level: StarterLevel,
  fill: (layers: LayerInstance[]) => LayerInstance[] = (layers) => layers,
): Project {
  return {
    format: 'af2d',
    version: 1,
    name,
    template,
    defs,
    worlds: [{ id: 'main', layout: 'free', placements: [{ level: level.id, x: 0, y: 0, depth: 0 }] }],
    levels: [
      {
        ...level,
        fields: {},
        layers: fill(emptyLayers(defs.layers, level.size)),
      },
    ],
  }
}

/** The layers with the cells of `def` (a tiles or IntGrid layer) edited. */
export function editCells(
  layers: readonly LayerInstance[],
  def: string,
  edit: (cells: GridEditor) => void,
): LayerInstance[] {
  return layers.map((layer) =>
    layer.def === def && (layer.kind === 'tiles' || layer.kind === 'intgrid')
      ? { ...layer, cells: layer.cells.edit(edit) }
      : layer,
  )
}

/** The layers with `items` placed on the entities layer `def`. */
export function placeEntities(
  layers: readonly LayerInstance[],
  def: string,
  items: readonly EntityInstance[],
): LayerInstance[] {
  return layers.map((layer) =>
    layer.def === def && layer.kind === 'entities' ? { ...layer, items: [...layer.items, ...items] } : layer,
  )
}
