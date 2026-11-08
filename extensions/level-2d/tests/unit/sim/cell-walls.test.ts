import { describe, expect, it } from 'vitest'
import { cellWalls } from '#src/shared/sim/cell-walls.ts'

// A 4 by 3 grid of 1 m cells. Row 0 is the top; the floor is row 2; one block stands in the middle of row 1.
//   . . . .
//   . . # .
//   # # # #
const ROWS = [
  [0, 0, 0, 0],
  [0, 0, 1, 0],
  [1, 1, 1, 1],
]
const walls = cellWalls(ROWS, 1, [1])

describe('cellWalls', () => {
  it('blocks a segment through a solid cell and lets one through open air pass', () => {
    expect(walls({ x: 0.5, z: 1.5 }, { x: 3.5, z: 1.5 }, 0)).toBe(true)
    expect(walls({ x: 0.5, z: 0.5 }, { x: 3.5, z: 0.5 }, 0)).toBe(false)
  })

  it('treats a segment along a cell’s edge as not inside it, and a point inside a cell as blocked', () => {
    expect(walls({ x: 0, z: 2 }, { x: 4, z: 2 }, 0)).toBe(false) // along the floor’s top edge
    expect(walls({ x: 2, z: 1 }, { x: 3, z: 1 }, 0)).toBe(false) // along the block’s top edge
    expect(walls({ x: 2.5, z: 1.5 }, { x: 2.5, z: 1.5 }, 0)).toBe(true)
  })

  it('blocks a segment that grazes a corner within the margin and not outside it', () => {
    // The block’s top-left corner is (2, 1). A level walk at z = 0.9 passes 0.1 m above the block.
    expect(walls({ x: 0, z: 0.9 }, { x: 4, z: 0.9 }, 0.05)).toBe(false)
    expect(walls({ x: 0, z: 0.9 }, { x: 4, z: 0.9 }, 0.15)).toBe(true)
    // Past the end of the segment, the nearest point is its end: 0.5 m short of the corner in x.
    expect(walls({ x: 0, z: 0.9 }, { x: 1.5, z: 0.9 }, 0.4)).toBe(false)
    expect(walls({ x: 0, z: 0.9 }, { x: 1.5, z: 0.9 }, 0.6)).toBe(true)
  })

  it('counts only the values it was given as solid, and nothing outside the grid', () => {
    const onlyTwo = cellWalls([[1, 2]], 1, [2])
    expect(onlyTwo({ x: 0.5, z: 0.5 }, { x: 0.5, z: 0.5 }, 0)).toBe(false)
    expect(onlyTwo({ x: 1.5, z: 0.5 }, { x: 1.5, z: 0.5 }, 0)).toBe(true)
    expect(onlyTwo({ x: 5, z: 5 }, { x: 6, z: 6 }, 0)).toBe(false)
  })

  it('scales the cell to the metre: a 16 px grid at 8 px a metre has 2 m cells', () => {
    const wide = cellWalls([[0, 1]], 2, [1])
    expect(wide({ x: 1, z: 1 }, { x: 1, z: 1 }, 0)).toBe(false)
    expect(wide({ x: 3, z: 1 }, { x: 3, z: 1 }, 0)).toBe(true)
  })
})
