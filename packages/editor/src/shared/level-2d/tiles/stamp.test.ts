import { describe, expect, it } from 'vitest'
import { packTile, unpackTile } from '../model/cells-codec'
import { Grid } from '../model/grid'
import { copyStamp, flipStamp, pasteStamp, type Stamp } from './stamp'

const a = packTile(1, false, false)
const b = packTile(2, false, false)
const c = packTile(3, false, false)

/** A 3 × 2 stamp: `a b .` over `. c b`. */
const sample = (): Stamp => ({ w: 3, h: 2, cells: Uint32Array.of(a, b, 0, 0, c, b) })

describe('copyStamp', () => {
  const grid = Grid.empty(8, 8).set(2, 2, a).set(3, 2, b).set(3, 3, c)

  it('reads a region row by row', () => {
    const stamp = copyStamp(grid, 2, 2, 2, 2)
    expect(stamp.w).toBe(2)
    expect(stamp.h).toBe(2)
    expect([...stamp.cells]).toEqual([a, b, 0, c])
  })

  it('reads empty cells beyond the grid', () => {
    const stamp = copyStamp(grid, -1, 2, 4, 1)
    expect([...stamp.cells]).toEqual([0, 0, 0, a])
  })

  it('is a snapshot: later edits to the grid do not change it', () => {
    const stamp = copyStamp(grid, 2, 2, 2, 2)
    grid.set(2, 2, c)
    expect(stamp.cells[0]).toBe(a)
  })

  it('refuses a size that is not a whole number of cells', () => {
    expect(() => copyStamp(grid, 0, 0, -1, 2)).toThrow(RangeError)
    expect(() => copyStamp(grid, 0, 0, 2, 1.5)).toThrow(RangeError)
  })
})

describe('pasteStamp', () => {
  it('copy then paste at the same place is the identity', () => {
    const grid = Grid.empty(8, 8).set(2, 2, a).set(3, 2, b).set(3, 3, c).set(5, 5, b)
    expect(pasteStamp(grid, copyStamp(grid, 1, 1, 4, 4), { x: 1, y: 1 }).equals(grid)).toBe(true)
  })

  it('puts the stamp with its top-left at the point', () => {
    const grid = pasteStamp(Grid.empty(8, 8), sample(), { x: 4, y: 5 })
    expect(grid.get(4, 5)).toBe(a)
    expect(grid.get(5, 5)).toBe(b)
    expect(grid.get(5, 6)).toBe(c)
    expect(grid.get(6, 6)).toBe(b)
    expect(grid.nonEmpty()).toHaveLength(4)
  })

  it('leaves what is under the stamp’s empty cells, unless asked to clear', () => {
    const under = Grid.empty(8, 8).set(6, 5, c).set(4, 6, c)
    const kept = pasteStamp(under, sample(), { x: 4, y: 5 })
    expect(kept.get(6, 5)).toBe(c)
    expect(kept.get(4, 6)).toBe(c)
    const cleared = pasteStamp(under, sample(), { x: 4, y: 5 }, { clear: true })
    expect(cleared.get(6, 5)).toBe(0)
    expect(cleared.get(4, 6)).toBe(0)
  })

  it('clips at the edges of the grid', () => {
    const grid = pasteStamp(Grid.empty(4, 4), sample(), { x: 3, y: 3 })
    expect(grid.nonEmpty()).toEqual([{ x: 3, y: 3, value: a }])
    const left = pasteStamp(Grid.empty(4, 4), sample(), { x: -1, y: 0 })
    expect(left.nonEmpty()).toEqual([
      { x: 0, y: 0, value: b },
      { x: 0, y: 1, value: c },
      { x: 1, y: 1, value: b },
    ])
  })

  it('returns the same grid when the stamp changes nothing', () => {
    const grid = pasteStamp(Grid.empty(8, 8), sample(), { x: 0, y: 0 })
    expect(pasteStamp(grid, sample(), { x: 0, y: 0 })).toBe(grid)
  })

  it('refuses a stamp whose cells do not fit its size', () => {
    expect(() =>
      pasteStamp(Grid.empty(4, 4), { w: 2, h: 2, cells: new Uint32Array(3) }, { x: 0, y: 0 }),
    ).toThrow(RangeError)
  })
})

describe('flipStamp', () => {
  it('mirrors the layout left to right and top to bottom', () => {
    expect([...flipStamp(sample(), 'x', 'int').cells]).toEqual([0, b, a, b, c, 0])
    expect([...flipStamp(sample(), 'y', 'int').cells]).toEqual([0, c, b, a, b, 0])
  })

  it('flipping twice gives the stamp back', () => {
    for (const kind of ['tile', 'int'] as const) {
      for (const axis of ['x', 'y'] as const) {
        expect([...flipStamp(flipStamp(sample(), axis, kind), axis, kind).cells]).toEqual([...sample().cells])
      }
    }
  })

  it('mirrors each tile too: a tile stamp toggles the flip bits', () => {
    const flipped = flipStamp(sample(), 'x', 'tile')
    // `a b .` mirrors to `. b a`, and each tile now faces the other way.
    expect(flipped.cells[0]).toBe(0)
    expect(unpackTile(flipped.cells[1] as number)).toEqual({ tile: 2, flipX: true, flipY: false })
    expect(unpackTile(flipped.cells[2] as number)).toEqual({ tile: 1, flipX: true, flipY: false })
    const vertical = flipStamp(sample(), 'y', 'tile')
    // The rows swap: `. c b` comes first, `a b .` last.
    expect(vertical.cells[0]).toBe(0)
    expect(unpackTile(vertical.cells[1] as number)).toEqual({ tile: 3, flipX: false, flipY: true })
    expect(unpackTile(vertical.cells[3] as number)).toEqual({ tile: 1, flipX: false, flipY: true })
  })

  it('leaves IntGrid values alone: they have no orientation', () => {
    const ints: Stamp = { w: 2, h: 1, cells: Uint32Array.of(3, 7) }
    expect([...flipStamp(ints, 'x', 'int').cells]).toEqual([7, 3])
  })

  it('does not change the stamp it was given', () => {
    const stamp = sample()
    flipStamp(stamp, 'x', 'tile')
    expect([...stamp.cells]).toEqual([...sample().cells])
  })
})
