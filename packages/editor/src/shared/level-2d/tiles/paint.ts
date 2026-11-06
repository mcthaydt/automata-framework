import type { Grid } from '../model/grid'
import type { Point } from './footprint'
import { hashCell, SALT } from './hash'

// Painting cells. A tool works on a cell **word**: a packed tile cell, an IntGrid value or an
// override tile. It does not know the layer kind, so one set of operations serves all of them, and the eraser is
// painting the word 0. Each operation returns a new `Grid` that shares every chunk it did not touch.

/** The word in every one of `cells`; cells outside the grid are dropped. The same grid when nothing changes. */
export function paintCells(grid: Grid, cells: Iterable<Point>, word: number): Grid {
  return grid.edit((editor) => {
    for (const { x, y } of cells) editor.set(x, y, word)
  })
}

/** The word in the rectangle between two corners, both included, in either order; clipped to the grid. */
export function paintRect(grid: Grid, a: Point, b: Point, word: number): Grid {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return grid.fillRect(x, y, Math.abs(a.x - b.x) + 1, Math.abs(a.y - b.y) + 1, word)
}

/**
 * The dice: each cell gets one of `candidates` chosen by the cell's place and the seed, so replaying a stroke repaints
 * the same tiles whatever order its cells arrive in.
 */
export function paintRandom(
  grid: Grid,
  cells: Iterable<Point>,
  candidates: readonly number[],
  seed: number,
): Grid {
  if (candidates.length === 0) throw new RangeError('the dice need at least one tile to pick from')
  return grid.edit((editor) => {
    for (const { x, y } of cells) {
      editor.set(x, y, candidates[hashCell(seed, 0, x, y, SALT.dice) % candidates.length] as number)
    }
  })
}
