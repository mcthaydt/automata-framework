import { describe, expect, it } from 'vitest'
import { packTile, unpackTile } from '../model/cells-codec'
import { Grid } from '../model/grid'
import { flipCell, pickTile } from './tile-cell'

describe('flipCell', () => {
  it('toggles the X flip and the Y flip on their own', () => {
    const plain = packTile(7, false, false)
    expect(unpackTile(flipCell(plain, 'x'))).toEqual({ tile: 7, flipX: true, flipY: false })
    expect(unpackTile(flipCell(plain, 'y'))).toEqual({ tile: 7, flipX: false, flipY: true })
    expect(unpackTile(flipCell(flipCell(plain, 'x'), 'y'))).toEqual({ tile: 7, flipX: true, flipY: true })
  })

  it('flipping twice gives the cell back, whatever its flips', () => {
    for (const cell of [
      packTile(0, false, false),
      packTile(12, true, false),
      packTile(536870910, true, true),
    ]) {
      for (const axis of ['x', 'y'] as const) expect(flipCell(flipCell(cell, axis), axis)).toBe(cell)
    }
  })

  it('keeps the cell an unsigned integer, so a Y-flipped tile can be stored in a grid', () => {
    const flipped = flipCell(packTile(3, false, false), 'y')
    expect(flipped).toBeGreaterThan(0x7fffffff)
    expect(Grid.empty(2, 2).set(0, 0, flipped).get(0, 0)).toBe(flipped)
  })

  it('leaves an empty cell empty', () => {
    expect(flipCell(0, 'x')).toBe(0)
    expect(flipCell(0, 'y')).toBe(0)
  })
})

describe('pickTile', () => {
  const grid = Grid.empty(4, 4).set(1, 2, packTile(9, true, false))

  it('reads the tile with its flips', () => {
    expect(pickTile(grid, 1, 2)).toEqual({ tile: 9, flipX: true, flipY: false })
  })

  it('is undefined for an empty cell and for one outside the grid', () => {
    expect(pickTile(grid, 0, 0)).toBeUndefined()
    expect(pickTile(grid, -1, 0)).toBeUndefined()
    expect(pickTile(grid, 4, 4)).toBeUndefined()
  })
})
