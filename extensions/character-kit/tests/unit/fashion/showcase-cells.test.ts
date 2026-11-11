// The runway wardrobe against FigureBuilder's own: each runway model's painted cell (standing, D2) from this kit's port equals,
// to the byte, the cell the showcase's wardrobe paints (`demo/runway` on FigureBuilder's `claude/runway-video`, `cb4aa9f`) on the
// pinned builder. The golden is made by `scripts/record-runway-cells.ts` from the showcase's own files, never by hand, and re-made
// only when the submodule moves. A garment that drifts from the showcase's in fit, fabric, swatch or hair fails here with its
// model and direction, and so does a shell that no longer clears the body under it: the showcase's `fit-check` bodies (thin, heavy,
// muscular, curvy, short) are held the same way.
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { RUNWAY_CAST } from '#src/features/fashion/runway-cast.ts'
import { member, standing } from '#src/shared/figure-builder/door.ts'
import { RUNWAY_GOLDEN } from '../../fixtures/runway-golden.ts'

registerFashion()

const golden = RUNWAY_GOLDEN

describe('the runway wardrobe paints the showcase’s cells', () => {
  it('holds a golden for each of the eight models in four directions', () => {
    expect(Object.keys(golden.cells)).toEqual(RUNWAY_CAST.map((m) => m.def.id))
    expect(golden.directions).toEqual([0, 1, 3, 6])
    expect(golden.density).toBe(2)
  })

  for (const { def } of RUNWAY_CAST) {
    it(`${def.id}: every direction's cell is the showcase's, byte for byte`, () => {
      const cast = member(def, golden.density)
      for (const direction of golden.directions) {
        const cell = standing(cast, direction)
        const md5 = createHash('md5')
          .update(Buffer.from(cell.buffer, cell.byteOffset, cell.byteLength))
          .digest('hex')
        expect(md5, `${def.id}, direction ${direction}`).toBe(golden.cells[def.id]?.[String(direction)])
      }
    }, 60_000)

    it(`${def.id}: on each of the fit check's slider extremes the cell is the showcase's too`, () => {
      for (const [name, sliders] of Object.entries(golden.bodies)) {
        const grown = member(
          { ...def, id: `${def.id}-fit`, sliders: { ...def.sliders, ...sliders } },
          golden.density,
        )
        for (const direction of golden.fitDirections) {
          const cell = standing(grown, direction)
          const md5 = createHash('md5')
            .update(Buffer.from(cell.buffer, cell.byteOffset, cell.byteLength))
            .digest('hex')
          expect(md5, `${def.id} on ${name}, direction ${direction}`).toBe(
            golden.fit[def.id]?.[name]?.[String(direction)],
          )
        }
      }
    }, 120_000)
  }
})
