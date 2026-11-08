// Which cells a brush and a stroke touch. Pure geometry on whole cell coordinates; cells outside
// the level are dropped later, by the grid.

export interface Point {
  readonly x: number
  readonly y: number
}

const MAX_BRUSH = 8

/**
 * The square footprint of a brush of `size` 1 to 8, row-major. Its top-left is `floor((size - 1) / 2)` cells up and
 * left of `at`, so an odd size is centred on the cursor and an even one extends one more cell right and down.
 */
export function brushCells(at: Point, size: number): Point[] {
  if (!Number.isInteger(size) || size < 1 || size > MAX_BRUSH)
    throw new RangeError(`a brush is a whole number of cells from 1 to ${MAX_BRUSH}, not ${size}`)
  const reach = Math.floor((size - 1) / 2)
  const cells: Point[] = []
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) cells.push({ x: at.x - reach + x, y: at.y - reach + y })
  return cells
}

/**
 * The cells of the line from `from` to `to`, both ends included, so a quick drag between two pointer events leaves no
 * gap. Bresenham's line, always walked from the end that comes first (smaller y, then smaller x) so that a tie is
 * broken the same way whichever end the stroke started at.
 */
export function lineCells(from: Point, to: Point): Point[] {
  const reversed = to.y < from.y || (to.y === from.y && to.x < from.x)
  const [start, end] = reversed ? [to, from] : [from, to]
  const dx = Math.abs(end.x - start.x)
  const dy = -Math.abs(end.y - start.y)
  const stepX = start.x < end.x ? 1 : -1
  const stepY = start.y < end.y ? 1 : -1
  const cells: Point[] = []
  let error = dx + dy
  let x = start.x
  let y = start.y
  for (;;) {
    cells.push({ x, y })
    if (x === end.x && y === end.y) break
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += stepX
    }
    if (doubled <= dx) {
      error += dx
      y += stepY
    }
  }
  return reversed ? cells.reverse() : cells
}
