import { describe, expect, it } from 'vitest'
import { brushCells, lineCells, type Point } from './footprint'

const xs = (cells: readonly Point[]): number[] => cells.map((cell) => cell.x)
const ys = (cells: readonly Point[]): number[] => cells.map((cell) => cell.y)

describe('brushCells', () => {
  it('size 1 is the cursor cell', () => {
    expect(brushCells({ x: 5, y: 7 }, 1)).toEqual([{ x: 5, y: 7 }])
  })

  it('an odd size is centred on the cursor, row by row', () => {
    const cells = brushCells({ x: 5, y: 5 }, 3)
    expect(cells).toHaveLength(9)
    expect(cells[0]).toEqual({ x: 4, y: 4 })
    expect(cells[1]).toEqual({ x: 5, y: 4 })
    expect(cells[3]).toEqual({ x: 4, y: 5 })
    expect(cells[8]).toEqual({ x: 6, y: 6 })
  })

  it('an even size reaches one cell further right and down', () => {
    expect(brushCells({ x: 5, y: 5 }, 2)).toEqual([
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ])
    const four = brushCells({ x: 5, y: 5 }, 4)
    expect([Math.min(...xs(four)), Math.max(...xs(four))]).toEqual([4, 7])
    expect([Math.min(...ys(four)), Math.max(...ys(four))]).toEqual([4, 7])
  })

  it('size 8 is 64 cells', () => {
    const cells = brushCells({ x: 10, y: 10 }, 8)
    expect(cells).toHaveLength(64)
    expect([Math.min(...xs(cells)), Math.max(...xs(cells))]).toEqual([7, 14])
  })

  it('may reach below zero: the grid drops what is outside', () => {
    expect(brushCells({ x: 0, y: 0 }, 3)[0]).toEqual({ x: -1, y: -1 })
  })

  it('refuses a size that is not a whole number from 1 to 8', () => {
    for (const size of [0, -1, 9, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => brushCells({ x: 0, y: 0 }, size), String(size)).toThrow(RangeError)
    }
  })
})

describe('lineCells', () => {
  it('is the one cell for a point', () => {
    expect(lineCells({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual([{ x: 3, y: 4 }])
  })

  it('draws Bresenham: a shallow line', () => {
    expect(lineCells({ x: 0, y: 0 }, { x: 5, y: 2 })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ])
  })

  it('covers all eight octants with both ends and no gap', () => {
    const origin = { x: 10, y: 10 }
    for (const [dx, dy] of [
      [7, 0],
      [7, 3],
      [3, 7],
      [0, 7],
      [-3, 7],
      [-7, 3],
      [-7, 0],
      [-7, -3],
      [-3, -7],
      [0, -7],
      [3, -7],
      [7, -3],
      [5, 5],
      [-5, 5],
    ] as const) {
      const end = { x: origin.x + dx, y: origin.y + dy }
      const cells = lineCells(origin, end)
      expect(cells, `${dx},${dy}`).toHaveLength(Math.max(Math.abs(dx), Math.abs(dy)) + 1)
      expect(cells).toContainEqual(origin)
      expect(cells).toContainEqual(end)
      for (let i = 1; i < cells.length; i++) {
        const [a, b] = [cells[i - 1], cells[i]] as [Point, Point]
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), `${dx},${dy} at ${i}`).toBe(1)
      }
    }
  })

  it('draws the same cells whichever end the stroke starts from (a tie is broken the same way)', () => {
    for (const [a, b] of [
      [
        { x: 0, y: 0 },
        { x: 4, y: 1 },
      ],
      [
        { x: 2, y: 9 },
        { x: 11, y: 3 },
      ],
      [
        { x: 5, y: 5 },
        { x: 5, y: 12 },
      ],
    ] as const) {
      expect(lineCells(b, a)).toEqual([...lineCells(a, b)].reverse())
    }
  })
})
