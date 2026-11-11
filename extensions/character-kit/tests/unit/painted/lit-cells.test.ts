// The lit cells of one painted figure (lit-cells.ts): a lit cell is made once for a painted cell and a quantised light, and a
// hit brings back nothing of an old frame but the lit colours.
import { describe, expect, it } from 'vitest'
import { LIT_CELLS, litCells } from '#src/features/painted/lit-cells.ts'
import { roomLight, type Tint } from '#src/features/painted/room-light.ts'
import { BASE, Figure, member, SPRITE_PITCH, type V3 } from '#src/shared/figure-builder/door.ts'

const FEET: V3 = [0, 0, 0]
const woman = BASE.find((b) => b.def.id === 'base-f')?.def
if (woman === undefined) throw new Error('the builder has no base-f')
const standing = (density: 1 | 2 = 2, facing = Math.PI / 4) => {
  const figure = new Figure(member(woman, density))
  for (let i = 0; i < 3; i++)
    figure.update(1 / 60, { facing, moving: false, view: { azimuth: 0, pitch: SPRITE_PITCH } })
  return figure
}
const warm: Tint = (_x, _y, _z, n) =>
  n === undefined ? [1.3, 1.1, 0.8] : [1 + Math.max(0, n[0]) * 0.5, 1, 1]
const dim: Tint = () => [0.5, 0.5, 0.5]
const light = (tint: Tint) => roomLight(tint, undefined, FEET, 0)
const same = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Buffer.compare(Buffer.from(a as Uint8ClampedArray), Buffer.from(b as Uint8ClampedArray)) === 0

describe('litCells', () => {
  it('the same cell and light is lit once', () => {
    const cells = litCells()
    const figure = standing()
    const a = cells.lit(figure, light(warm))
    const b = cells.lit(figure, light(warm))
    expect(cells.size).toBe(1)
    expect(b.rgba).toBe(a.rgba)
    expect(b.key).toBe(a.key)
    // Everything but the lit colours is this frame's: the figure's own buffers.
    expect(b.depth).toBe(figure.depth)
    expect(b.normals).toBe(figure.normals)
  })

  it('a lamp switched under a standing figure relights it', () => {
    const cells = litCells()
    const figure = standing()
    const before = cells.lit(figure, light(warm))
    const after = cells.lit(figure, light(dim))
    expect(after.key).not.toBe(before.key)
    expect(same(after.rgba, before.rgba)).toBe(false)
    expect(cells.size).toBe(2)
  })

  it('a figure repainted at another density is never shown an old cell', () => {
    const cells = litCells()
    const d2 = cells.lit(standing(2), light(warm))
    const d1figure = standing(1)
    const d1 = cells.lit(d1figure, light(warm))
    expect(d2.size).toEqual([128, 192])
    expect(d1.size).toEqual([d1figure.cell[0], d1figure.cell[1]])
    expect(d1.rgba.length).toBe(d1figure.cell[0] * d1figure.cell[1] * 4)
  })

  it('at most LIT_CELLS are kept, the oldest dropped', () => {
    expect(LIT_CELLS).toBe(32)
    const cells = litCells(3)
    const figure = standing()
    const lights = [0.5, 0.7, 1, 1.3, 1.6].map((v) => light(() => [v, v, v]))
    const first = cells.lit(figure, lights[0] as ReturnType<typeof light>)
    for (const l of lights.slice(1)) cells.lit(figure, l)
    expect(cells.size).toBe(3)
    // The oldest was dropped: lighting it again makes a new buffer.
    expect(cells.lit(figure, lights[0] as ReturnType<typeof light>).rgba).not.toBe(first.rgba)
  })

  it('lit: the unlit cell stays in cell.painted', () => {
    const cells = litCells()
    const figure = standing()
    const cell = cells.lit(figure, light(warm))
    expect(cell.painted).toBe(figure.painted)
    expect(cell.rgba).not.toBe(cell.painted)
    expect(same(cell.rgba, cell.painted)).toBe(false)
  })
})
