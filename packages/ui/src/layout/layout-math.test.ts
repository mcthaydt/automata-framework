import { describe, expect, it } from 'vitest'
import { collapseLevel } from './action-bar'
import { reservedRows, rowsBelow } from './scroll-list'

// Ported from FloorFifty tests/client/ui/layout/helpers.test.ts at 122a220.
describe('collapseLevel (ActionBar)', () => {
  // The one-row widths at levels 0 (all labels), 1 (utilities icon-only) and 2 (secondaries short).
  const widths = [500, 450, 400] as const

  it.each([
    [600, 0],
    [500, 0],
    [499, 1],
    [450, 1],
    [449, 2],
    [400, 2],
    [399, 3],
    [0, 3],
  ] as const)('at %i px it is level %i', (available, level) => {
    expect(collapseLevel(available, widths)).toBe(level)
  })

  it('never skips a level a narrower row would have fitted', () => {
    expect(collapseLevel(480, [480, 480, 300])).toBe(0)
    expect(collapseLevel(479, [480, 480, 300])).toBe(2)
  })
})

describe("ScrollList's arithmetic", () => {
  it('reserves the rows it asks for, or every row when there are fewer', () => {
    expect(reservedRows(4, 10)).toBe(4)
    expect(reservedRows(4, 2)).toBe(2)
    expect(reservedRows(0, 3)).toBe(0)
  })

  it.each([
    [120, [40, 80, 120, 160, 200], 2],
    [130, [40, 80, 120, 160, 200], 2], // a row cut by the edge is a hidden row
    [160, [40, 80, 120, 160, 200], 1],
    [200, [40, 80, 120, 160, 200], 0],
    [400, [40, 80, 120, 160, 200], 0],
    [120, [0, 0, 0, 0, 0], 0], // not laid out yet
  ] as const)('a view ending at %i over rows ending at %j hides %i', (view, bottoms, hidden) => {
    expect(rowsBelow(view, bottoms)).toBe(hidden)
  })

  it('counts by where each row ends, so a taller first row and the gaps hide nothing', () => {
    expect(rowsBelow(290, [78, 146, 214, 282])).toBe(0)
    expect(rowsBelow(220, [78, 146, 214, 282])).toBe(1)
  })
})
