import { describe, expect, it } from 'vitest'
import { DEMO_CAST } from '#src/features/fashion/demo-cast.ts'
import type { Model } from '#src/features/fashion/model.ts'
import { registerFashion } from '#src/features/fashion/register-fashion.ts'
import { RUNWAY_CAST } from '#src/features/fashion/runway-cast.ts'
import { BASE, member, POSES, standing } from '#src/shared/figure-builder/door.ts'

registerFashion()

/** The rows and columns a standing figure paints in the builder's own sheet (front view, D2), and its painted texels. */
function extent(model: Model) {
  const cast = member(model.def, 2)
  const [w, h] = cast.cell
  const cell = standing(cast, 0)
  let [top, bottom, left, right] = [h, -1, w, -1]
  let opaque = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((cell[(y * w + x) * 4 + 3] ?? 0) === 0) continue
      opaque++
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
  }
  return { rows: bottom - top + 1, columns: right - left + 1, opaque }
}

describe('the casts', () => {
  const all = [...RUNWAY_CAST, ...DEMO_CAST]

  it('has the eight runway models in order and the seven demo characters', () => {
    expect(RUNWAY_CAST.map((m) => m.def.name)).toEqual([
      'MARA',
      'DRE',
      'JUNE',
      'THEO',
      'EDITH',
      'SAM',
      'NIA',
      'OTTO',
    ])
    expect(DEMO_CAST.map((m) => m.def.name)).toEqual([
      'BEAUTY',
      'UGLY',
      'ELDER',
      'LIFTER',
      'BIG',
      'LANKY',
      'POISED',
    ])
  })

  it('has unique ids, none the base pair’s, and a line on each', () => {
    const ids = [...all.map((m) => m.def.id), ...BASE.map((b) => b.def.id)]
    expect(new Set(ids).size).toBe(ids.length)
    for (const model of all) expect(model.about.length, model.def.id).toBeGreaterThan(20)
  })

  it('stands every model on a stand the builder has', () => {
    for (const model of RUNWAY_CAST) expect(model.pose, `${model.def.id} holds a stand`).toBeDefined()
    for (const model of all)
      if (model.pose !== undefined) expect(Object.keys(POSES), model.def.id).toContain(model.pose)
  })

  for (const model of [...RUNWAY_CAST, ...DEMO_CAST]) {
    it(`${model.def.id} builds and paints a standing figure`, () => {
      expect(extent(model).opaque).toBeGreaterThan(500)
    }, 30_000)
  }

  it('is a variety of bodies, measured: the tallest runway model paints 10 rows more than the shortest, the widest 6 columns more than the narrowest', () => {
    const sizes = RUNWAY_CAST.map(extent)
    const rows = sizes.map((s) => s.rows)
    const columns = sizes.map((s) => s.columns)
    expect(Math.max(...rows) - Math.min(...rows)).toBeGreaterThanOrEqual(10)
    expect(Math.max(...columns) - Math.min(...columns)).toBeGreaterThanOrEqual(6)
  }, 60_000)
})
