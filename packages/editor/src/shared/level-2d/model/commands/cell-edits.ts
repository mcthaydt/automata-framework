import { floodFill } from '../../tiles/flood-fill'
import type { Point } from '../../tiles/footprint'
import { paintCells, paintRandom, paintRect } from '../../tiles/paint'
import { pasteStamp, type Stamp } from '../../tiles/stamp'
import { unpackTile } from '../cells-codec'
import type { Grid } from '../grid'
import type { LayerDef, LayerInstance, Project } from '../project-types'
import { tilesetTiles } from '../tileset-grid'
import { findLayer, type LayerTarget, updateLayer } from './layer-target'

// The cell tools' edits on a project. The operations on a `Grid` are in `tiles/` and know
// nothing of layers; these find the grid a layer keeps its cells in and check the word before it is written, so the
// editor never produces a cell the Checks would flag (`cellValueUnknown`, `tileOutOfRange`).

/** The grid a cell tool edits: the cells of a tiles or IntGrid layer, the overrides of an auto layer. */
function cellsOf(layer: LayerInstance, def: LayerDef): Grid {
  if (layer.kind === 'tiles' || layer.kind === 'intgrid') return layer.cells
  if (layer.kind === 'auto') return layer.overrides
  throw new RangeError(`layer "${def.id}" has no cells`)
}

function withCells(layer: LayerInstance, cells: Grid): LayerInstance {
  if (layer.kind === 'tiles' || layer.kind === 'intgrid') return { ...layer, cells }
  if (layer.kind === 'auto') return { ...layer, overrides: cells }
  return layer
}

/** 0 (an empty cell) is always allowed; any other word has to be one the layer's definition can hold. */
function checkWord(project: Project, def: LayerDef, word: number): void {
  if (word === 0) return
  if (def.kind === 'intgrid') {
    if (!def.values.some((candidate) => candidate.value === word))
      throw new RangeError(`value ${word} is not a value of layer "${def.id}"`)
  } else if (def.kind === 'tiles' || def.kind === 'auto') {
    const tileset = project.defs.tilesets.find((candidate) => candidate.id === def.tileset)
    if (tileset === undefined)
      throw new RangeError(`layer "${def.id}" uses tileset "${def.tileset}", which is missing`)
    const unpacked = unpackTile(word)
    const count = tilesetTiles(tileset).count
    if (unpacked !== undefined && unpacked.tile >= count)
      throw new RangeError(
        `tile ${unpacked.tile} is beyond tileset "${tileset.id}", which has ${count} tiles`,
      )
  }
}

function editCells(
  project: Project,
  target: LayerTarget,
  words: Iterable<number>,
  edit: (grid: Grid) => Grid,
): Project {
  return updateLayer(project, target, (layer, def) => {
    const grid = cellsOf(layer, def)
    for (const word of words) checkWord(project, def, word)
    const next = edit(grid)
    return next === grid ? layer : withCells(layer, next)
  })
}

/** The word in one cell of a layer (0 when empty or outside the level): what the picker reads. */
export function cellWord(project: Project, target: LayerTarget, cell: Point): number {
  const { layer, def } = findLayer(project, target)
  return cellsOf(layer, def).get(cell.x, cell.y)
}

/** The word in every cell of `cells`. Cells outside the level are dropped. */
export function paintLayerCells(
  project: Project,
  target: LayerTarget,
  cells: Iterable<Point>,
  word: number,
): Project {
  return editCells(project, target, [word], (grid) => paintCells(grid, cells, word))
}

/** Painting the empty word: what the eraser does on every cell layer. */
export function eraseLayerCells(project: Project, target: LayerTarget, cells: Iterable<Point>): Project {
  return paintLayerCells(project, target, cells, 0)
}

/** The word in the rectangle between two corners, both included, in either order. */
export function paintLayerRect(
  project: Project,
  target: LayerTarget,
  a: Point,
  b: Point,
  word: number,
): Project {
  return editCells(project, target, [word], (grid) => paintRect(grid, a, b, word))
}

/** The bucket: replaces the connected cells that equal the one at `at`, inside the level. */
export function fillLayer(project: Project, target: LayerTarget, at: Point, word: number): Project {
  return editCells(project, target, [word], (grid) => floodFill(grid, at, word))
}

/**
 * The dice. The caller owns the seed: a stroke that is repainted (redo, or a replay) has to give the same tiles, so the
 * seed is chosen once per stroke and is not the auto layer's own.
 */
export function paintLayerRandom(
  project: Project,
  target: LayerTarget,
  cells: Iterable<Point>,
  candidates: readonly number[],
  seed: number,
): Project {
  return editCells(project, target, candidates, (grid) => paintRandom(grid, cells, candidates, seed))
}

/** A copied or palette-selected rectangle of words, pasted with its top-left cell at `at`. */
export function pasteLayerStamp(
  project: Project,
  target: LayerTarget,
  stamp: Stamp,
  at: Point,
  options: { readonly clear?: boolean } = {},
): Project {
  return editCells(project, target, stamp.cells, (grid) => pasteStamp(grid, stamp, at, options))
}
