import { describe, expect, it } from 'vitest'
import { seededRandom } from '../../../testing/level-2d/random'
import { packTile } from '../model/cells-codec'
import { Grid } from '../model/grid'
import { floodFill } from './flood-fill'
import type { Point } from './footprint'

const wall = packTile(1, false, false)
const water = packTile(2, false, false)

/** A grid from rows of text: `#` is a wall, `.` is empty. */
function room(...rows: string[]): Grid {
  let grid = Grid.empty(rows[0]?.length ?? 0, rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') grid = grid.set(x, y, wall)
  })
  return grid
}

function draw(grid: Grid): string[] {
  const rows: string[] = []
  for (let y = 0; y < grid.rows; y++) {
    let row = ''
    for (let x = 0; x < grid.cols; x++)
      row += grid.get(x, y) === 0 ? '.' : grid.get(x, y) === wall ? '#' : '~'
    rows.push(row)
  }
  return rows
}

describe('floodFill', () => {
  it('fills the room it starts in and stops at the walls', () => {
    const filled = floodFill(room('#####..', '#...#..', '#...#..', '#####..'), { x: 2, y: 1 }, water)
    expect(draw(filled)).toEqual(['#####..', '#~~~#..', '#~~~#..', '#####..'])
  })

  it('does not leak through a diagonal gap: fill is 4-connected', () => {
    const filled = floodFill(room('.#.', '#.#', '.#.'), { x: 1, y: 1 }, water)
    // The corner cells touch the middle only at a corner, so they stay empty.
    expect(draw(filled)).toEqual(['.#.', '#~#', '.#.'])
  })

  it('fills a winding corridor', () => {
    const filled = floodFill(room('.....', '####.', '.....', '.####', '.....'), { x: 0, y: 0 }, water)
    expect(draw(filled)).toEqual(['~~~~~', '####~', '~~~~~', '~####', '~~~~~'])
  })

  it('replaces cells that are equal to the start cell: walls fill with water', () => {
    const filled = floodFill(room('##.', '.#.', '...'), { x: 0, y: 0 }, water)
    expect(draw(filled)).toEqual(['~~.', '.~.', '...'])
  })

  it('treats a flipped tile as a different tile', () => {
    let grid = Grid.empty(3, 1)
    grid = grid
      .set(0, 0, packTile(5, false, false))
      .set(1, 0, packTile(5, true, false))
      .set(2, 0, packTile(5, false, false))
    const filled = floodFill(grid, { x: 0, y: 0 }, water)
    expect(filled.get(0, 0)).toBe(water)
    expect(filled.get(1, 0)).toBe(packTile(5, true, false))
    expect(filled.get(2, 0)).toBe(packTile(5, false, false))
  })

  it('erases a region with the word 0', () => {
    const erased = floodFill(room('###', '#.#', '###'), { x: 0, y: 0 }, 0)
    expect(draw(erased)).toEqual(['...', '...', '...'])
  })

  it('returns the same grid when the start cell already holds the word, or is outside', () => {
    const grid = room('#.', '..')
    expect(floodFill(grid, { x: 0, y: 0 }, wall)).toBe(grid)
    expect(floodFill(grid, { x: 1, y: 1 }, 0)).toBe(grid)
    expect(floodFill(grid, { x: -1, y: 0 }, water)).toBe(grid)
    expect(floodFill(grid, { x: 2, y: 0 }, water)).toBe(grid)
    expect(floodFill(grid, { x: 0, y: 2 }, water)).toBe(grid)
  })

  it('fills the whole of an empty level a run at a time, not a cell at a time', () => {
    const grid = Grid.empty(1024, 1024)
    const calls = { fillRect: 0, set: 0 }
    const edit = grid.edit.bind(grid)
    grid.edit = (fn) =>
      edit((editor) =>
        fn({
          get: editor.get,
          set: (x, y, value) => {
            calls.set++
            editor.set(x, y, value)
          },
          fillRect: (x, y, w, h, value) => {
            calls.fillRect++
            editor.fillRect(x, y, w, h, value)
          },
        }),
      )
    const filled = floodFill(grid, { x: 500, y: 500 }, water)
    expect(filled.nonEmpty()).toHaveLength(1024 * 1024)
    expect(calls.set).toBe(0)
    expect(calls.fillRect).toBeLessThanOrEqual(1024)
  })

  it('matches a plain breadth-first fill on random grids', () => {
    const random = seededRandom(20261023)
    for (let run = 0; run < 200; run++) {
      const size = 12
      let grid = Grid.empty(size, size)
      for (let i = 0; i < 50; i++)
        grid = grid.set(random.int(size), random.int(size), random.pick([wall, water, 0, 0]))
      const start: Point = { x: random.int(size), y: random.int(size) }
      const word = random.pick([0, wall, water, packTile(9, true, true)])
      expect(floodFill(grid, start, word).equals(naiveFill(grid, start, word)), `run ${run}`).toBe(true)
    }
  })
})

/** The obvious fill: a queue of cells, one at a time. */
function naiveFill(grid: Grid, start: Point, word: number): Grid {
  const target = grid.get(start.x, start.y)
  if (target === word) return grid
  const seen = new Set<number>()
  const queue: Point[] = [start]
  let result = grid
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head] as Point
    const key = y * grid.cols + x
    if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || seen.has(key) || grid.get(x, y) !== target)
      continue
    seen.add(key)
    result = result.set(x, y, word)
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
  }
  return result
}
