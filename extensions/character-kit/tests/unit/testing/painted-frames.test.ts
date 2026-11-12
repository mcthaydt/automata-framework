// The figure's frames as a sheet reads them: its eight standing views, its walk's poses, and the silhouette's width row by row
// (shoulder, waist and hip in texels), all painted in Node by the figure builder's own painter.
import { describe, expect, it } from 'vitest'
import { BASE, type CharacterDef } from '#src/shared/figure-builder/door.ts'
import {
  type PaintedCell,
  paintedCell,
  paintedStand,
  paintedWalk,
  rowWidths,
  silhouette,
} from '#src/testing/painted-cell.ts'

const DEF = (BASE[0] as { def: CharacterDef }).def

describe('painted frames', () => {
  it('a cell knows its size', () => {
    const cell = paintedCell(DEF, 0, 1)
    expect(cell.size).toEqual([64, 96])
    expect(cell.painted.length).toBe(64 * 96 * 4)
  })

  it('paints eight standing views, each a cell of the same size, no two the same', () => {
    const views = paintedStand(DEF, 1)
    expect(views).toHaveLength(8)
    expect(new Set(views.map((v) => v.painted.join(','))).size).toBeGreaterThan(4)
  })

  it('paints the walk, one cell for each of the gait’s poses', () => {
    const walk = paintedWalk(DEF, 1)
    expect(walk.length).toBeGreaterThanOrEqual(4)
    expect(walk.every((cell) => cell !== undefined)).toBe(true)
    expect(new Set(walk.map((c) => c.painted.join(','))).size).toBeGreaterThan(2)
  })

  it('measures the width of a silhouette row by row, in texels', () => {
    const painted = new Uint8ClampedArray(4 * 3 * 4)
    // A row of 2 texels, a gap, then 1 more (the width is the extent from the first opaque texel to the last), and an empty row.
    painted.set([1, 1, 1, 255, 1, 1, 1, 255], 0)
    painted.set([1, 1, 1, 255], 4 * 4 + 12)
    const cell: PaintedCell = { painted, size: [4, 3] }
    expect(rowWidths(cell)).toEqual([2, 1, 0])
  })

  it('reads the shoulder, waist and hip of a figure as widths in texels', () => {
    const s = silhouette(paintedCell(DEF, 0, 2))
    expect(s.top).toBeLessThan(s.bottom)
    expect(s.height).toBe(s.bottom - s.top + 1)
    expect(s.shoulder).toBeGreaterThan(0)
    expect(s.waist).toBeGreaterThan(0)
    expect(s.hip).toBeGreaterThan(0)
  })
})
