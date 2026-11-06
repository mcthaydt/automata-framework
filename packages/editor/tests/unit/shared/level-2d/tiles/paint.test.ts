import { describe, expect, it } from 'vitest'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { Grid } from '#src/shared/level-2d/model/grid.ts'
import { brushCells } from '#src/shared/level-2d/tiles/footprint.ts'
import { paintCells, paintRandom, paintRect } from '#src/shared/level-2d/tiles/paint.ts'

const wall = packTile(4, false, false)

describe('paintCells', () => {
  it('writes the word into each cell', () => {
    const grid = paintCells(
      Grid.empty(8, 8),
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      wall,
    )
    expect(grid.get(1, 1)).toBe(wall)
    expect(grid.get(2, 1)).toBe(wall)
    expect(grid.nonEmpty()).toHaveLength(2)
  })

  it('erases with the word 0', () => {
    const painted = paintCells(Grid.empty(8, 8), brushCells({ x: 3, y: 3 }, 3), wall)
    const erased = paintCells(painted, [{ x: 3, y: 3 }], 0)
    expect(erased.get(3, 3)).toBe(0)
    expect(erased.nonEmpty()).toHaveLength(8)
  })

  it('returns the same grid when nothing changes', () => {
    const grid = paintCells(Grid.empty(8, 8), [{ x: 1, y: 1 }], wall)
    expect(paintCells(grid, [{ x: 1, y: 1 }], wall)).toBe(grid)
    expect(paintCells(grid, [{ x: 5, y: 5 }], 0)).toBe(grid)
  })

  it('ignores cells outside the grid', () => {
    const grid = paintCells(
      Grid.empty(4, 4),
      [
        { x: -1, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 4 },
        { x: 3, y: 3 },
      ],
      wall,
    )
    expect(grid.nonEmpty()).toEqual([{ x: 3, y: 3, value: wall }])
  })

  it('copies only the chunks it touches', () => {
    const before = paintCells(
      Grid.empty(64, 64),
      [
        { x: 1, y: 1 },
        { x: 40, y: 40 },
      ],
      wall,
    )
    const after = paintCells(before, [{ x: 2, y: 1 }], wall)
    expect(after.sharesChunk(before, 40, 40)).toBe(true)
    expect(after.sharesChunk(before, 1, 1)).toBe(false)
  })

  it('does not change the grid it was given', () => {
    const before = Grid.empty(4, 4)
    paintCells(before, [{ x: 0, y: 0 }], wall)
    expect(before.nonEmpty()).toEqual([])
  })
})

describe('paintRect', () => {
  it('fills the rectangle, both corners included', () => {
    const grid = paintRect(Grid.empty(8, 8), { x: 1, y: 2 }, { x: 3, y: 3 }, wall)
    expect(grid.nonEmpty()).toHaveLength(6)
    expect(grid.get(1, 2)).toBe(wall)
    expect(grid.get(3, 3)).toBe(wall)
    expect(grid.get(4, 3)).toBe(0)
  })

  it('takes the corners in any order', () => {
    const forward = paintRect(Grid.empty(8, 8), { x: 1, y: 2 }, { x: 3, y: 3 }, wall)
    for (const [a, b] of [
      [
        { x: 3, y: 3 },
        { x: 1, y: 2 },
      ],
      [
        { x: 3, y: 2 },
        { x: 1, y: 3 },
      ],
      [
        { x: 1, y: 3 },
        { x: 3, y: 2 },
      ],
    ] as const) {
      expect(paintRect(Grid.empty(8, 8), a, b, wall).equals(forward)).toBe(true)
    }
  })

  it('clips at the edges, and one cell is a rectangle', () => {
    expect(paintRect(Grid.empty(4, 4), { x: -3, y: -3 }, { x: 1, y: 1 }, wall).nonEmpty()).toHaveLength(4)
    expect(paintRect(Grid.empty(4, 4), { x: 2, y: 2 }, { x: 2, y: 2 }, wall).nonEmpty()).toHaveLength(1)
    expect(paintRect(Grid.empty(4, 4), { x: 8, y: 8 }, { x: 9, y: 9 }, wall).nonEmpty()).toHaveLength(0)
  })

  it('erases a rectangle with the word 0', () => {
    const full = paintRect(Grid.empty(4, 4), { x: 0, y: 0 }, { x: 3, y: 3 }, wall)
    expect(paintRect(full, { x: 1, y: 1 }, { x: 2, y: 2 }, 0).nonEmpty()).toHaveLength(12)
  })
})

describe('paintRandom', () => {
  const cells = brushCells({ x: 8, y: 8 }, 8)
  const candidates = [packTile(1, false, false), packTile(2, true, false), packTile(3, false, true)]

  it('puts one of the candidates in each cell, and uses them all', () => {
    const grid = paintRandom(Grid.empty(16, 16), cells, candidates, 1234)
    const seen = new Set(grid.nonEmpty().map((cell) => cell.value))
    expect(grid.nonEmpty()).toHaveLength(64)
    expect([...seen].sort()).toEqual([...candidates].sort())
  })

  it('paints the same tiles when it is replayed, and other tiles under another seed', () => {
    const first = paintRandom(Grid.empty(16, 16), cells, candidates, 1234)
    expect(paintRandom(Grid.empty(16, 16), cells, candidates, 1234).equals(first)).toBe(true)
    expect(paintRandom(Grid.empty(16, 16), cells, candidates, 4321).equals(first)).toBe(false)
  })

  it('picks a cell by its place, not by the order the cells come in', () => {
    const forward = paintRandom(Grid.empty(16, 16), cells, candidates, 7)
    const backward = paintRandom(Grid.empty(16, 16), [...cells].reverse(), candidates, 7)
    expect(backward.equals(forward)).toBe(true)
  })

  it('with one candidate paints it everywhere', () => {
    const grid = paintRandom(Grid.empty(16, 16), cells, [wall], 99)
    expect(new Set(grid.nonEmpty().map((cell) => cell.value))).toEqual(new Set([wall]))
  })

  it('refuses an empty candidate list', () => {
    expect(() => paintRandom(Grid.empty(4, 4), [{ x: 0, y: 0 }], [], 1)).toThrow(RangeError)
  })
})
