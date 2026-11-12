import { describe, expect, it } from 'vitest'
import { Figure, member } from '../../../src'
import { view } from '../../../src/features/figure/frames'
import { TIMES } from '../../../src/features/lighting/lamps'
import { lightFigure } from '../../../src/features/lighting/light'
import { cellOf } from '../../../src/features/stage/cell'
import { standingFigure } from '../../golden/lit'
import { registerFixtures } from '../paint/fabric-fixtures'
import { DENIM_DEF } from './fixtures'

/** The cell: a painted figure as a scene draws it (src/features/stage/cell.ts). It copies nothing. */
describe('cellOf', () => {
  const f = standingFigure('base-m', 2, 1),
    c = cellOf(f)
  it("is the figure's own buffers, copied nowhere", () => {
    expect(c.rgba).toBe(f.painted)
    expect(c.painted).toBe(f.painted)
    expect(c.normals).toBe(f.normals)
    expect(c.size).toEqual([128, 192])
    expect(c.anchor).toEqual([64, 192 - 13.5])
    expect(c.metresPerTexel).toBeCloseTo(2.6 / 192, 15)
    expect(c.density).toBe(2)
    expect(c.direction).toBe(1)
    expect(c.pitch).toBeCloseTo((18 * Math.PI) / 180, 12)
    expect(c.weave).toBeNull()
  })
  it('leaves no colour under alpha 0', () => {
    for (let i = 0; i < c.rgba.length; i += 4)
      if (!c.rgba[i + 3]) expect(c.rgba[i] | c.rgba[i + 1] | c.rgba[i + 2]).toBe(0)
  })
  it('carries the lit cell as rgba and keeps the painted one', () => {
    const lit = lightFigure(f, { time: TIMES.night, lamps: [] }),
      l = cellOf(f, lit)
    expect(l.rgba).toBe(lit)
    expect(l.painted).toBe(f.painted)
  })
  it("always gives depth: the figure's own, cached or not, finite wherever the cell is opaque", () => {
    expect(c.depth).toBe(f.depth) // Figure.cache is true by default
    const g = standingFigure('base-m', 1, 0)
    g.cache = false
    g.update(1 / 60, { facing: 0, moving: false, view: view() })
    expect(cellOf(g).depth).toBe(g.depth)
    for (const cell of [c, cellOf(g)])
      for (let i = 0; i < cell.depth.length; i++)
        if (cell.rgba[i * 4 + 3]) expect(Number.isFinite(cell.depth[i])).toBe(true)
  })
  it('keys the bytes: the same pose the same key, another view another key', () => {
    expect(cellOf(standingFigure('base-m', 2, 1)).key).toBe(c.key)
    expect(cellOf(standingFigure('base-m', 2, 2)).key).not.toBe(c.key)
    expect(cellOf(f, lightFigure(f, { time: TIMES.night, lamps: [] })).key).not.toBe(c.key)
  })
  it('the key hashes the colour alone: `<w>x<h>:<hash of rgba>`, so a changed normal map under the same colours keeps it (a cache of normals reads them fresh)', () => {
    expect(c.key).toMatch(/^\d+x\d+:[0-9a-z]+$/)
    const g = standingFigure('base-m', 2, 1)
    g.normals.fill(7) // a changed normal map under the same colours: the same key (it hashes rgba alone)
    expect(cellOf(g).key).toBe(c.key)
    const night = lightFigure(f, { time: TIMES.night, lamps: [] })
    expect(cellOf(f, night).key).toBe(cellOf(f, night.slice()).key) // equal rgba, equal key, whichever buffer holds it
  })
  it('carries the weave of a figure in a fabric', () => {
    registerFixtures()
    const fig = new Figure(member(DENIM_DEF, 2))
    fig.update(1 / 60, { facing: 0, moving: false, view: view() })
    expect(cellOf(fig).weave).not.toBeNull()
    expect(cellOf(fig).weave).toBe(fig.weave)
  })
})
