import type { CellKind } from '../model/cells-codec'
import type { Grid } from '../model/grid'
import type { Point } from './footprint'
import { flipCell } from './tile-cell'

// Multi-cell stamps: copy a region, flip it, paste it. The marquee selection and the palette's
// multi-tile selection both produce one.

/** A rectangle of cell words, row-major. */
export interface Stamp {
  readonly w: number
  readonly h: number
  readonly cells: Uint32Array
}

const isWhole = (n: number): boolean => Number.isInteger(n) && n >= 0

function checked(stamp: Stamp): Stamp {
  if (!isWhole(stamp.w) || !isWhole(stamp.h) || stamp.cells.length !== stamp.w * stamp.h)
    throw new RangeError(
      `a ${stamp.w} × ${stamp.h} stamp has ${stamp.w * stamp.h} cells, not ${stamp.cells.length}`,
    )
  return stamp
}

/** The cells of a region, as a snapshot; cells beyond the grid read as empty. */
export function copyStamp(grid: Grid, x: number, y: number, w: number, h: number): Stamp {
  if (!isWhole(w) || !isWhole(h)) throw new RangeError(`a stamp is a whole number of cells, not ${w} × ${h}`)
  const cells = new Uint32Array(w * h)
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++) cells[row * w + col] = grid.get(x + col, y + row)
  return { w, h, cells }
}

/**
 * The stamp mirrored about its middle. A tile stamp (`'tile'`) also toggles each tile's flip bit, so the picture
 * mirrors; an IntGrid stamp (`'int'`) has no orientation in its values and only its layout moves.
 */
export function flipStamp(stamp: Stamp, axis: 'x' | 'y', kind: CellKind): Stamp {
  const { w, h, cells } = checked(stamp)
  const mirrored = new Uint32Array(w * h)
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const from = row * w + col
      const to = axis === 'x' ? row * w + (w - 1 - col) : (h - 1 - row) * w + col
      const cell = cells[from] as number
      mirrored[to] = kind === 'tile' ? flipCell(cell, axis) : cell
    }
  }
  return { w, h, cells: mirrored }
}

/**
 * Writes the stamp with its top-left cell at `at`, clipped to the grid. An empty stamp cell leaves what is under it
 * (so a pasted shape does not erase its surroundings) unless `clear` is set, which writes the gaps too.
 */
export function pasteStamp(
  grid: Grid,
  stamp: Stamp,
  at: Point,
  options: { readonly clear?: boolean } = {},
): Grid {
  const { w, h, cells } = checked(stamp)
  return grid.edit((editor) => {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const cell = cells[row * w + col] as number
        if (cell !== 0 || options.clear === true) editor.set(at.x + col, at.y + row, cell)
      }
    }
  })
}
