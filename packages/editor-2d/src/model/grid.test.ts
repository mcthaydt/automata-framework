import { describe, expect, test } from 'vitest'
import { CHUNK, Grid } from './grid'

describe('Grid', () => {
  test('an empty grid reads zero everywhere and costs no chunks', () => {
    const grid = Grid.empty(40, 30)
    expect(grid.cols).toBe(40)
    expect(grid.rows).toBe(30)
    expect(grid.get(0, 0)).toBe(0)
    expect(grid.get(39, 29)).toBe(0)
    expect(grid.chunkCount).toBe(0)
  })

  test('set returns a new grid and leaves the old one unchanged', () => {
    const before = Grid.empty(40, 30)
    const after = before.set(17, 3, 5)
    expect(after).not.toBe(before)
    expect(before.get(17, 3)).toBe(0)
    expect(after.get(17, 3)).toBe(5)
    expect(after.chunkCount).toBe(1)
  })

  test('setting the value a cell already holds returns the same grid', () => {
    const grid = Grid.empty(40, 30).set(2, 2, 7)
    expect(grid.set(2, 2, 7)).toBe(grid)
    expect(Grid.empty(40, 30).set(2, 2, 0)).toBeInstanceOf(Grid)
  })

  test('a write outside the grid is ignored and reads outside are zero', () => {
    const grid = Grid.empty(10, 10)
    expect(grid.set(10, 0, 1)).toBe(grid)
    expect(grid.set(-1, 0, 1)).toBe(grid)
    expect(grid.set(0, 10, 1)).toBe(grid)
    expect(grid.get(10, 0)).toBe(0)
    expect(grid.get(-5, -5)).toBe(0)
  })

  test('refuses a value that is not an unsigned 32-bit integer', () => {
    const grid = Grid.empty(4, 4)
    for (const bad of [-1, 1.5, 2 ** 32, Number.NaN]) expect(() => grid.set(0, 0, bad)).toThrow(RangeError)
  })

  test('holds values up to the top bit, as a flipped tile cell needs', () => {
    const cell = 0xc0000005
    expect(Grid.empty(4, 4).set(1, 1, cell).get(1, 1)).toBe(cell)
  })

  test('untouched chunks are shared between the old and the new grid', () => {
    const base = Grid.empty(64, 64).set(1, 1, 1).set(40, 40, 2)
    const next = base.set(2, 1, 3)
    expect(next.sharesChunk(base, 40, 40)).toBe(true)
    expect(next.sharesChunk(base, 1, 1)).toBe(false)
    expect(base.get(2, 1)).toBe(0)
  })

  test('a chunk that becomes all zero is dropped', () => {
    const grid = Grid.empty(64, 64).set(1, 1, 1).set(40, 40, 2)
    const cleared = grid.set(1, 1, 0)
    expect(cleared.chunkCount).toBe(1)
    expect(cleared.set(40, 40, 0).chunkCount).toBe(0)
  })

  test('fillRect fills a rectangle clipped to the grid', () => {
    const grid = Grid.empty(20, 20).fillRect(15, 15, 10, 10, 4)
    expect(grid.get(15, 15)).toBe(4)
    expect(grid.get(19, 19)).toBe(4)
    expect(grid.get(14, 15)).toBe(0)
    expect([...grid.nonEmpty()]).toHaveLength(25)
  })

  test('fillRect with zero erases and drops the emptied chunks', () => {
    const grid = Grid.empty(64, 64).fillRect(0, 0, 64, 64, 3)
    expect(grid.chunkCount).toBe(16)
    expect(grid.fillRect(0, 0, 64, 64, 0).chunkCount).toBe(0)
  })

  test('fillRect that changes nothing returns the same grid', () => {
    const grid = Grid.empty(20, 20).fillRect(2, 2, 3, 3, 1)
    expect(grid.fillRect(2, 2, 3, 3, 1)).toBe(grid)
    expect(grid.fillRect(0, 0, 0, 5, 9)).toBe(grid)
    expect(grid.fillRect(30, 30, 5, 5, 9)).toBe(grid)
  })

  test('edit applies many writes and copies each touched chunk once', () => {
    const base = Grid.empty(64, 64).set(40, 40, 2)
    const next = base.edit((cells) => {
      for (let x = 0; x < CHUNK; x++) cells.set(x, 0, 1)
      cells.fillRect(16, 0, 4, 4, 9)
      cells.set(0, 0, 8)
    })
    expect(next.get(0, 0)).toBe(8)
    expect(next.get(15, 0)).toBe(1)
    expect(next.get(17, 2)).toBe(9)
    expect(next.sharesChunk(base, 40, 40)).toBe(true)
    expect(base.get(0, 0)).toBe(0)
  })

  test('edit can read what it has written, and an edit that changes nothing returns the same grid', () => {
    const base = Grid.empty(8, 8).set(1, 1, 5)
    let seen = -1
    const next = base.edit((cells) => {
      cells.set(2, 2, 6)
      seen = cells.get(2, 2)
    })
    expect(seen).toBe(6)
    expect(next.get(2, 2)).toBe(6)
    expect(base.edit((cells) => cells.set(1, 1, 5))).toBe(base)
    expect(base.edit(() => undefined)).toBe(base)
  })

  test('resize drops cells outside the new size and keeps the rest', () => {
    const grid = Grid.empty(40, 40).set(3, 3, 1).set(30, 30, 2).set(35, 5, 3)
    const smaller = grid.resize(20, 20)
    expect(smaller.cols).toBe(20)
    expect(smaller.rows).toBe(20)
    expect(smaller.get(3, 3)).toBe(1)
    expect(smaller.get(30, 30)).toBe(0)
    expect([...smaller.nonEmpty()]).toHaveLength(1)
    expect(smaller.chunkCount).toBe(1)
  })

  test('resize clears the part of a chunk that falls outside, so growing back does not bring cells back', () => {
    const grid = Grid.empty(32, 32).set(10, 10, 1).set(14, 10, 2)
    const back = grid.resize(12, 12).resize(32, 32)
    expect(back.get(10, 10)).toBe(1)
    expect(back.get(14, 10)).toBe(0)
  })

  test('resize keeps untouched whole chunks shared and growing keeps every cell', () => {
    const grid = Grid.empty(64, 64).set(1, 1, 1).set(20, 20, 2)
    const grown = grid.resize(128, 128)
    expect(grown.sharesChunk(grid, 1, 1)).toBe(true)
    expect(grown.get(20, 20)).toBe(2)
    expect(grid.resize(64, 64).equals(grid)).toBe(true)
  })

  test('equals compares size and content, not history', () => {
    const a = Grid.empty(20, 20).set(1, 1, 5).set(2, 2, 6)
    const b = Grid.empty(20, 20).set(2, 2, 6).set(1, 1, 5).set(9, 9, 1).set(9, 9, 0)
    expect(a.equals(b)).toBe(true)
    expect(a.equals(a.set(1, 1, 4))).toBe(false)
    expect(a.equals(Grid.empty(21, 20).set(1, 1, 5).set(2, 2, 6))).toBe(false)
  })

  test('nonEmpty lists the cells in row-major order across chunks', () => {
    const grid = Grid.empty(40, 40).set(20, 1, 3).set(2, 2, 1).set(1, 1, 2).set(18, 17, 4)
    expect([...grid.nonEmpty()].map((cell) => [cell.x, cell.y, cell.value])).toEqual([
      [1, 1, 2],
      [20, 1, 3],
      [2, 2, 1],
      [18, 17, 4],
    ])
  })

  test('chunks lists the stored chunks row-major, each with its position and its cells in grid coordinates', () => {
    expect(Grid.empty(40, 40).chunks()).toEqual([])
    const grid = Grid.empty(40, 40).set(33, 2, 7).set(20, 1, 3).set(1, 17, 2).set(2, 1, 1).set(3, 1, 4)
    const chunks = grid.chunks()
    expect(chunks.map((chunk) => [chunk.cx, chunk.cy])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ])
    expect(chunks[0]?.cells()).toEqual([
      { x: 2, y: 1, value: 1 },
      { x: 3, y: 1, value: 4 },
    ])
    expect(chunks[2]?.cells()).toEqual([{ x: 33, y: 2, value: 7 }])
    expect(chunks[3]?.cells()).toEqual([{ x: 1, y: 17, value: 2 }])
  })

  test('a chunk keeps its token while it is unchanged, and an edit gives only the touched chunk a new one', () => {
    const grid = Grid.empty(40, 40).set(1, 1, 1).set(20, 1, 2)
    const edited = grid.set(21, 2, 3)
    const [before0, before1] = grid.chunks()
    const [after0, after1] = edited.chunks()
    expect(after0?.token).toBe(before0?.token)
    expect(after1?.token).not.toBe(before1?.token)
    expect(grid.chunks()[0]?.token).toBe(before0?.token)
    expect(
      edited
        .set(20, 1, 0)
        .set(21, 2, 0)
        .chunks()
        .map((chunk) => chunk.cx),
    ).toEqual([0])
  })

  test('refuses a size that is negative or not whole', () => {
    expect(() => Grid.empty(-1, 4)).toThrow(RangeError)
    expect(() => Grid.empty(4, 1.5)).toThrow(RangeError)
    expect(Grid.empty(0, 0).get(0, 0)).toBe(0)
  })
})
