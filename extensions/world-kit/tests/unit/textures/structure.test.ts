import { describe, expect, it } from 'vitest'
import { READS, readsOf, structureIssues, tileStructure } from '#src/features/textures/structure.ts'
import type { Tile } from '#src/features/textures/tile.ts'

/** A tone tile (label = offset + 8 on slot 0) from rows of offsets. */
const tone = (rows: number[][]): Tile => ({
  width: rows[0]?.length ?? 0,
  height: rows.length,
  labels: Uint16Array.from(rows.flat().map((offset) => offset + 8)),
})
const filled = (w: number, h: number, offset: number): number[][] =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => offset))

const put = (rows: number[][], x: number, y: number, v: number): void => {
  ;(rows[y] as number[])[x] = v
}

describe('tile structure', () => {
  it('a tile of one label is all ground: flat, and nothing else', () => {
    const s = tileStructure(tone(filled(10, 10, 0)))
    expect(s).toMatchObject({ dominant: 1, blotch: 0, spots: 0, patches: 0, span: 0 })
    expect(structureIssues(s)).toEqual(['flat 1.000 > 0.85'])
  })

  it('a stain that wraps round the tile’s edge is one run', () => {
    const rows = filled(10, 10, 0)
    // Two columns at the left and right edges touch across the wrap: 20 texels in one run.
    for (const row of rows) {
      row[0] = 1
      row[9] = 1
    }
    expect(tileStructure(tone(rows)).blotch).toBeCloseTo(0.2)
  })

  it('counts small runs as spots and mid-size runs as patches, leaving the ground out', () => {
    const rows = filled(20, 20, 0)
    put(rows, 2, 2, 1)
    put(rows, 3, 2, 1)
    put(rows, 4, 2, 1) // a run of 3: a spot
    for (let y = 10; y < 14; y++) for (let x = 10; x < 14; x++) put(rows, x, y, -1) // 16 texels: a patch
    const s = tileStructure(tone(rows))
    expect(s.spots).toBeCloseTo(3 / 400)
    expect(s.patches).toBeCloseTo(16 / 400)
  })

  it('span is the steps of shade the tone labels cover', () => {
    const rows = filled(10, 10, 0)
    put(rows, 0, 0, 2)
    put(rows, 5, 5, -2)
    expect(tileStructure(tone(rows)).span).toBe(4)
  })

  it('names what fails with its number and its limit, and judges a worn tile on blotch, flat and span only', () => {
    const s = { blotch: 0.08, dominant: 0.9, span: 3, spots: 0.03, patches: 0.2 }
    expect(structureIssues(s, { oneStep: true })).toEqual([
      'blotch 0.080 > 0.06',
      'flat 0.900 > 0.85',
      'span 3 > 1',
      'spots 0.0300 > 0.017',
      'patches 0.2000 > 0.12',
    ])
    expect(structureIssues(s, {}, true)).toEqual(['blotch 0.080 > 0.06', 'flat 0.900 > 0.85'])
  })

  it('a swatch’s declared reads lay over the defaults', () => {
    expect(readsOf({ maxSpots: 0.055 })).toEqual({ ...READS, maxSpots: 0.055 })
    expect(
      structureIssues({ blotch: 0, dominant: 0.5, span: 0, spots: 0.04, patches: 0 }, { maxSpots: 0.055 }),
    ).toEqual([])
  })
})
