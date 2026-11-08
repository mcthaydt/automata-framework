import type { Grid } from '../model/grid'
import type { Point } from './footprint'

/**
 * The bucket (2D editor spec §5.9): replaces the 4-connected region of cells equal to the start cell's word, bounded by
 * the level. A flipped tile is a different word. It fills a run of a row at a time and walks the rows above and below
 * for new runs, so an empty level is one call per row and not one per cell, and it needs no recursion. The same grid
 * comes back when the start is outside or already holds the word.
 */
export function floodFill(grid: Grid, at: Point, word: number): Grid {
  const { cols, rows } = grid
  const inside =
    Number.isInteger(at.x) && Number.isInteger(at.y) && at.x >= 0 && at.y >= 0 && at.x < cols && at.y < rows
  if (!inside) return grid
  const target = grid.get(at.x, at.y)
  if (target === word) return grid
  return grid.edit((cells) => {
    // Seeds are (x, y) pairs. Filled cells no longer equal `target`, so the editor itself records what is done.
    const seeds: number[] = [at.x, at.y]
    while (seeds.length > 0) {
      const y = seeds.pop() as number
      const x = seeds.pop() as number
      if (cells.get(x, y) !== target) continue
      let left = x
      while (left > 0 && cells.get(left - 1, y) === target) left--
      let right = x
      while (right + 1 < cols && cells.get(right + 1, y) === target) right++
      cells.fillRect(left, y, right - left + 1, 1, word)
      for (const next of [y - 1, y + 1]) {
        if (next < 0 || next >= rows) continue
        let inRun = false
        for (let nx = left; nx <= right; nx++) {
          const matches = cells.get(nx, next) === target
          if (matches && !inRun) seeds.push(nx, next)
          inRun = matches
        }
      }
    }
  })
}
