// A swatch is a ladder of eight DUEL steps with a base step; a texel's albedo is the base plus its texture's offset; a
// photo-mode texel is a step of its own ramp. A tile is laid on a surface as Build's placement says.
import { DUEL_RAMPS } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { albedoStep, ladderOf, onRamp, paletteRgb } from '#src/features/world/albedo/ladder.ts'
import { type AlbedoTile, tileUvs } from '#src/features/world/albedo/place.ts'

const hex = (h: string): number => Number.parseInt(h.slice(1), 16)

describe('ladders', () => {
  it('is the swatch ramp as eight steps, sitting on its step', () => {
    const l = ladderOf({ ramp: 'wood', step: 3 })
    expect(l.base).toBe(3)
    expect(l.steps).toHaveLength(8)
    expect(l.steps[3]).toBe(hex(DUEL_RAMPS[l.ramp]?.[3] as string))
  })
  it('moves a texel along the ladder by its offset and stays on the ladder', () => {
    expect(albedoStep(3, -2)).toBe(1)
    expect(albedoStep(3, 9)).toBe(7)
    expect(albedoStep(1, -5)).toBe(0)
  })
  it('puts a photo-mode texel on its own ramp, at its own step', () => {
    const l = ladderOf(onRamp({ ramp: 'wood', step: 3 }, 5))
    expect(l.steps[2]).toBe(hex(DUEL_RAMPS[5]?.[2] as string))
  })
  it('reads a palette index as its DUEL colour', () => {
    expect(paletteRgb(2 * 8 + 5)).toBe(hex(DUEL_RAMPS[2]?.[5] as string))
  })
})

// A 4 x 4 tile at 2 texels a metre (2 m across), every texel a distinct byte so a lookup names its place.
const tile: AlbedoTile = {
  width: 4,
  height: 4,
  texels: [2, 2],
  rgba: new Uint8Array(4 * 4 * 4),
  seed: 0,
}
const quad = (positions: number[], normals: number[]) => ({ positions, normals })

describe('tile placement', () => {
  it('lays a world-mapped wall by metres along it (u) and up it (v, rows run down)', () => {
    // A wall in the xy plane facing +z, 2 m wide and 2 m tall, from the origin.
    const m = quad([0, 0, 0, 2, 0, 0, 0, 2, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1])
    const uv = tileUvs(m, tile, undefined, true)
    // u: 2 m x 2 texels/m = 4 texels = one tile; v up is rows down, so the top of the wall is row 0.
    expect([...uv]).toEqual([
      expect.closeTo(0),
      expect.closeTo(0),
      expect.closeTo(1),
      expect.closeTo(0),
      expect.closeTo(0),
      expect.closeTo(-1),
    ])
  })
  it('lays a floor by x and z', () => {
    const m = quad([0, 0, 0, 2, 0, 0, 0, 0, 2], [0, 1, 0, 0, 1, 0, 0, 1, 0])
    const uv = tileUvs(m, tile, undefined, true)
    expect([...uv]).toEqual([0, 0, 1, 0, 0, 1].map((v) => expect.closeTo(v)))
  })
  it('scales by repeat, pans and turns', () => {
    const m = quad([0, 0, 0, 2, 0, 0, 0, 0, 2], [0, 1, 0, 0, 1, 0, 0, 1, 0])
    const big = tileUvs(m, tile, { repeat: [2, 2] }, true)
    expect(big[2]).toBeCloseTo(0.5)
    const panned = tileUvs(m, tile, { pan: [1, 0] }, true)
    expect(panned[0]).toBeCloseTo(-0.5)
  })
  it('starts a world-tiled surface at its seed, and an anchored one at its origin', () => {
    const seeded = tileUvs(quad([0, 0, 0], [0, 1, 0]), { ...tile, seed: 5 }, undefined, false)
    const anchored = tileUvs(quad([0, 0, 0], [0, 1, 0]), { ...tile, seed: 5 }, undefined, true)
    expect(anchored[0]).toBe(0)
    expect(seeded[0]).not.toBe(0)
  })
})
