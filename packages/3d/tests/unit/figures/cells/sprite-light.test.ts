import { describe, expect, it } from 'vitest'
import { lightCell, SPRITE_STYLE, type SpriteLamp } from '#src/features/figures/cells/sprite-light.ts'
import type { PaintedCell } from '#src/features/figures/paint/paint-cell.ts'
import { environmentBuilderLook, type OracleSpriteCell } from '#src/testing/oracles.ts'
import { md5 } from '../paint/cell-input.ts'

const oracle = environmentBuilderLook()

function cellOf(c: OracleSpriteCell): PaintedCell {
  return {
    width: c.w,
    height: c.h,
    feet: [0, 0],
    colours: c.painted,
    normals: c.normals,
    depth: new Float32Array(c.w * c.h),
    material: new Int16Array(c.w * c.h),
  }
}

describe('a painted cell lit as a sprite', () => {
  it.each(oracle.spriteLight.map((c) => [c.cell, c] as const))(
    "lights the oracle's %s as EnvironmentBuilder does",
    (_, c) => {
      const lit = lightCell(cellOf(c), c.lamps as readonly SpriteLamp[], c.ambient, {
        step: c.step,
        max: c.max,
        shade: c.shade,
        style: c.style,
      })
      expect(md5(c.painted)).toBe((c as unknown as { paintedMd5: string }).paintedMd5)
      expect(md5(lit.colours)).toBe(c.md5)
      expect(md5(c.lit)).toBe(c.md5)
    },
  )

  it('leaves a transparent texel empty and keeps the alpha of the others', () => {
    const c = oracle.spriteLight[0]!
    const lit = lightCell(cellOf(c), c.lamps as readonly SpriteLamp[], c.ambient, {
      step: c.step,
      max: c.max,
    })
    for (let k = 0; k < c.w * c.h; k++) {
      if (c.painted[k * 4 + 3]! < 128) expect(lit.colours[k * 4 + 3]).toBe(0)
      else expect(lit.colours[k * 4 + 3]).toBe(c.painted[k * 4 + 3])
    }
  })

  it('lights a figure no hotter than its room under several lamps', () => {
    const c = oracle.spriteLight[0]!
    const lamp: SpriteLamp = { dir: [0, 1, 0], rgb: [1, 1, 1] }
    const one = lightCell(cellOf(c), [lamp], [0, 0, 0], { step: 0.1, max: 1.6 })
    const three = lightCell(cellOf(c), [lamp, lamp, lamp], [0, 0, 0], { step: 0.1, max: 1.6 })
    const sum = (cell: PaintedCell): number => cell.colours.reduce((t, v) => t + v, 0)
    // Three lamps at the same spot light it more, but the floors are capped, so not three times as much.
    expect(sum(three)).toBeLessThan(sum(one) * 3)
    expect(SPRITE_STYLE.floorCap).toBe(0.8)
  })
})
