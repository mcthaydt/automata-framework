import { type Level, SOLID } from './read-level.ts'

// What stops the square: a wall cell, or the edge of the level.

/** True when a square of side `size` centred on (x, y) would overlap a wall or reach past the level's edge. */
export function hitsWall(level: Level, x: number, y: number, size: number): boolean {
  const half = size / 2
  const left = x - half
  const top = y - half
  const right = x + half
  const bottom = y + half
  if (left < 0 || top < 0 || right > level.width || bottom > level.height) return true
  // The cells the square covers. Its right and bottom edges are open, so a square resting on the floor (its bottom
  // edge on the floor's top edge) is not inside the floor.
  for (let row = Math.floor(top / level.tile); row < Math.ceil(bottom / level.tile); row++)
    for (let column = Math.floor(left / level.tile); column < Math.ceil(right / level.tile); column++)
      if (level.cells[row]?.[column] === SOLID) return true
  return false
}
