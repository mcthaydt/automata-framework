import { Grid } from './grid'
import type { LayerDef, LayerInstance, Size } from './project-types'

// The empty layers of a new level: a level holds one instance of every layer definition, in the
// definitions' order, so a template and `addLevel` both start from here.

/** The seed a new auto layer starts at; "re-roll variation" replaces it. */
const FIRST_SEED = 1

/** Cells that cover a level of `size` px with cells of `grid` px: a partial cell at the edge counts as one. */
export function layerCells(size: Size, grid: number): { cols: number; rows: number } {
  return { cols: Math.ceil(size.w / grid), rows: Math.ceil(size.h / grid) }
}

function emptyLayer(def: LayerDef, size: Size): LayerInstance {
  switch (def.kind) {
    case 'tiles':
    case 'intgrid': {
      const { cols, rows } = layerCells(size, def.grid)
      return { def: def.id, kind: def.kind, cells: Grid.empty(cols, rows) }
    }
    case 'auto': {
      const { cols, rows } = layerCells(size, def.grid)
      return { def: def.id, kind: 'auto', seed: FIRST_SEED, overrides: Grid.empty(cols, rows) }
    }
    case 'entities':
      return { def: def.id, kind: 'entities', items: [] }
    case 'objects':
      return { def: def.id, kind: 'objects', items: [] }
  }
}

export function emptyLayers(layers: readonly LayerDef[], size: Size): LayerInstance[] {
  return layers.map((def) => emptyLayer(def, size))
}
