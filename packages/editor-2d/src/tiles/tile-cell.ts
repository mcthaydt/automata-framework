import { type UnpackedTile, unpackTile } from '../model/cells-codec'
import type { Grid } from '../model/grid'

// Reading and flipping a tile cell (2D editor spec §5.3 and §5.9). The palette's flip keys and the picker use these;
// the packing itself lives in the cell codec.

const FLIP_X = 0x40000000
const FLIP_Y = 0x80000000

/** The cell with its X or Y flip toggled; an empty cell has nothing to flip. */
export function flipCell(cell: number, axis: 'x' | 'y'): number {
  if (cell === 0) return 0
  // `^` works on signed 32-bit integers; `>>> 0` turns the result back into the unsigned word a grid stores.
  return (cell ^ (axis === 'x' ? FLIP_X : FLIP_Y)) >>> 0
}

/** The picker: the tile at (x, y) with its flips, or `undefined` for an empty cell or one outside the grid. */
export function pickTile(grid: Grid, x: number, y: number): UnpackedTile | undefined {
  return unpackTile(grid.get(x, y))
}
