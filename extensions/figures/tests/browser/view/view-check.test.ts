// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 27 of the builders-fold plan (the strict flags) replaces each with a check
/**
 * The Pixi 3D view against the painter, under WebGL in Chromium (the same checks run under WebGPU in ../webgpu/):
 *
 * 1. The standing views: each base figure in each of the 8 views under an orthographic camera at the sheets' 18°, a
 *    texel to a pixel; every pixel the figure covers is the sheets' cell's (frames.ts `standing`), texel for texel, and no
 *    pixel outside it is drawn.
 * 2. The stage cases (tests/fixtures/view-cases.ts): `StageView` draws each case's `StageFrame` and the readback is
 *    compared with `compose(frame)` (see view-claims.ts for what each claim asks).
 * 3. Determinism: `scene4` drawn once, twice in one page, and once more fresh: all three readbacks equal.
 */
import { describe, expect, it } from 'vitest'
import { BASE, member, standing } from '#src/entries/index.ts'
import { CASES } from '../../fixtures/view-cases.ts'
import { expectCase } from '../../fixtures/view-claims.ts'
import { drawCase, drawStanding } from '../../fixtures/view-draw.ts'

describe('the standing views', () => {
  for (const [who, b] of BASE.entries())
    describe(b.def.id, () => {
      for (let view = 0; view < 8; view++)
        it(`view ${view}: every texel is the sheet's cell's, and nothing else is drawn`, async () => {
          const cast = member(b.def, 2),
            [w, h] = cast.cell,
            cell = standing(cast, view),
            shot = await drawStanding(who, view)
          expect([shot.w, shot.h], 'the canvas is the cell').toEqual([w, h])
          let wrong = 0,
            first = ''
          for (let i = 0; i < w * h; i++) {
            const a = cell[i * 4 + 3] > 0,
              drawn = shot.rgba[i * 4 + 3] > 0
            const same = a
              ? drawn && [0, 1, 2].every((k) => cell[i * 4 + k] === shot.rgba[i * 4 + k])
              : !drawn
            if (!same) {
              wrong++
              if (!first)
                first = `(${i % w}, ${Math.floor(i / w)}) cell ${Array.from(cell.slice(i * 4, i * 4 + 4))} drawn ${Array.from(shot.rgba.slice(i * 4, i * 4 + 4))}`
            }
          }
          expect(wrong, `${wrong} pixels differ, first ${first}`).toBe(0)
        })
    })
})

describe('the stage cases, under WebGL', () => {
  for (const name of Object.keys(CASES))
    it(`${name}: ${CASES[name].claim === 'bytes' ? 'every byte is compose(frame)' : 'the palette holds'}`, () =>
      expectCase(name, 'webgl'))
})

describe('determinism', () => {
  it('scene4 drawn once, twice in a page and once more fresh reads back the same', async () => {
    const once = await drawCase('scene4', 'webgl'),
      twice = await drawCase('scene4', 'webgl', true),
      fresh = await drawCase('scene4', 'webgl')
    expect(twice.rgba).toEqual(once.rgba)
    expect(fresh.rgba).toEqual(once.rgba)
  })
})
