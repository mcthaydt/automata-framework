// A figure's proportions read from its painted cell: head count, neck, trunk and legs in rows, shoulder, waist and hip widths, and
// where the legs start. A synthetic figure checks every number exactly; two real figures check the helper against the painter.
import { describe, expect, it, vi } from 'vitest'
import { BASE, type CharacterDef } from '#src/shared/figures/door.ts'
import type { PaintedCell } from '#src/testing/painted-cell.ts'
import { bald, proportions, proportionsOfCells, riggedHeights } from '#src/testing/proportions.ts'

vi.setConfig({ testTimeout: 120_000 })

const SKIN = ['#e0b090', '#d0a080', '#c09070', '#b08060']
const CLOTH: readonly number[] = [40, 80, 160]
const BASE_DEF = (BASE[1] as { def: CharacterDef }).def
const DEF: CharacterDef = { ...BASE_DEF, skin: 'testSkin', swatches: { testSkin: { paint: SKIN } as never } }

/** A 40 x 100 cell, the figure's middle on column 20: `skin` and `cloth` are rects (rows from, to, columns from, to). */
function figure(
  parts: readonly (readonly [kind: 'skin' | 'cloth', y0: number, y1: number, x0: number, x1: number])[],
): PaintedCell {
  const painted = new Uint8ClampedArray(40 * 100 * 4)
  for (const [kind, y0, y1, x0, x1] of parts)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const rgb = kind === 'skin' ? [0xe0, 0xb0, 0x90] : CLOTH
        painted.set([...rgb, 255], (y * 40 + x) * 4)
      }
  return { painted, size: [40, 100] }
}

// Rows 0-11 the head (10 wide, the jaw tapering to 8 then 6), 12-14 the neck (4 wide), 15-24 shoulders (20), 25-34 waist (12),
// 35-49 hips (16), then two legs with a gap on the middle columns from row 50 to the sole at row 99.
const FRONT = figure([
  ['skin', 0, 9, 15, 24],
  ['skin', 10, 10, 16, 23],
  ['skin', 11, 11, 17, 22],
  ['skin', 12, 14, 18, 21],
  ['cloth', 15, 24, 10, 29],
  ['cloth', 25, 34, 14, 25],
  ['cloth', 35, 49, 12, 27],
  ['cloth', 50, 99, 12, 18],
  ['cloth', 50, 99, 21, 27],
])

describe('proportions of a painted cell', () => {
  it('counts the rows of head, neck, trunk and legs, and the heads in the height', () => {
    const p = proportionsOfCells({ def: DEF, front: FRONT })
    expect(p.height).toBe(100)
    expect(p.headRows).toBe(12)
    expect(p.neckRows).toBe(3)
    expect(p.legRows).toBe(50)
    expect(p.trunkRows).toBe(35)
    expect(p.headRows + p.neckRows + p.trunkRows + p.legRows).toBe(p.height)
    expect(p.heads).toBeCloseTo(100 / 12, 5)
  })

  it('reads the widths in texels, and the legs’ start as a share of the height', () => {
    const p = proportionsOfCells({ def: DEF, front: FRONT })
    expect(p.headWidth).toBe(10)
    expect(p.shoulder).toBe(20)
    expect(p.waist).toBe(12)
    expect(p.hip).toBe(16)
    expect(p.shoulderHeads).toBe(2)
    expect(p.legsPart).toBe(0.5)
  })

  it('says there is no neck when the cloth starts at the chin', () => {
    const noNeck = figure([
      ['skin', 0, 9, 15, 24],
      ['skin', 10, 10, 16, 23],
      ['skin', 11, 11, 17, 22],
      ['cloth', 12, 99, 10, 29],
    ])
    const p = proportionsOfCells({ def: DEF, front: noNeck })
    expect(p.neckRows).toBe(0)
    expect(p.headRows).toBe(12)
  })

  it('has no parting to read where the legs touch all the way down', () => {
    const touching = figure([
      ['skin', 0, 11, 15, 24],
      ['cloth', 12, 99, 12, 27],
    ])
    expect(proportionsOfCells({ def: DEF, front: touching }).legsPart).toBeUndefined()
  })

  it('reads the foot’s length from a side view as heads', () => {
    // The feet are the lowest 7 rows; the side view shows them 12 wide against a head 12 rows tall.
    const side = figure([
      ['skin', 0, 11, 15, 24],
      ['cloth', 12, 92, 16, 23],
      ['cloth', 93, 99, 14, 25],
    ])
    const p = proportionsOfCells({ def: DEF, front: FRONT, side })
    expect(p.footLength).toBe(12)
    expect(p.footHeads).toBe(1)
  })

  it('reads the joints’ heights from the rig as shares of the height', () => {
    const r = riggedHeights(BASE_DEF)
    // Ordered from the floor up: knee, crotch (the hip joint), the hand at the wrist, the elbow, the shoulder.
    expect(r.knee).toBeGreaterThan(0.2)
    expect(r.knee).toBeLessThan(r.hipJoint)
    expect(r.wrist).toBeLessThan(r.elbow)
    expect(r.elbow).toBeLessThan(r.shoulder)
    expect(r.shoulder).toBeGreaterThan(0.75)
  })
})

describe('proportions of a painted figure', () => {
  it('reads the base woman: a figure of a few heads, a neck, shoulders no narrower than her waist', () => {
    const p = proportions(BASE_DEF, 2)
    expect(p.heads).toBeGreaterThan(5)
    expect(p.heads).toBeLessThan(9)
    expect(p.headRows).toBeGreaterThan(8)
    expect(p.shoulder).toBeGreaterThanOrEqual(p.waist)
    expect(p.rig?.hipJoint).toBeGreaterThan(0.4)
  })

  it('leaves the hair out of the head: a bald head and a bobbed one count the same', () => {
    expect(proportions(BASE_DEF, 2).headRows).toBe(proportions(bald(BASE_DEF), 2).headRows)
  })
})
