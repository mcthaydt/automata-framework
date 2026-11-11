// A lit window shows a room behind the glass (the source's interior mapping): a ray from the view through the glass is
// traced into a box room (2.6 wide, 2.8 high, 3 deep, one to a cell of the wall), and the step its hit takes comes back.
import { describe, expect, it } from 'vitest'
import { interiorStep, windowTile } from '#src/features/world/albedo/interior.ts'
import { ladderOf } from '#src/features/world/albedo/ladder.ts'

// A wall facing +z, looked at straight on.
const IN: [number, number, number] = [0, 0, -1]

describe('interiorStep', () => {
  it('lights the back wall near the ceiling, a step down in the middle and two down low', () => {
    expect(interiorStep(1.3, 2.7, 0, 0, 1, ...IN)).toBe(0)
    expect(interiorStep(1.3, 1.2, 0, 0, 1, ...IN)).toBe(-1)
    expect(interiorStep(1.3, 0.1, 0, 0, 1, ...IN)).toBeLessThanOrEqual(-2)
  })
  it('is the same for the same ray, and never beyond three steps either way', () => {
    for (let i = 0; i < 40; i++) {
      const x = i * 0.37
      const y = (i * 0.53) % 2.8
      const step = interiorStep(x, y, 4, 0, 1, 0.1, -0.3, -0.9)
      expect(step).toBe(interiorStep(x, y, 4, 0, 1, 0.1, -0.3, -0.9))
      expect(Math.abs(step)).toBeLessThanOrEqual(3)
    }
  })
  it('puts a different room behind each cell of the wall', () => {
    const rooms = new Set<number>()
    for (let cell = 0; cell < 12; cell++) {
      let sum = 0
      for (let i = 0; i < 8; i++) sum = sum * 7 + interiorStep(cell * 2.6 + i * 0.3, 0.3, 0, 0, 1, ...IN)
      rooms.add(sum)
    }
    expect(rooms.size).toBeGreaterThan(3)
  })
})

describe('windowTile', () => {
  // A 1.2 × 1.4 window glass on the south face of a wall, sill 1 m up, as the builder lays it.
  const glass = {
    positions: [-0.6, 1, 0, 0.6, 1, 0, 0.6, 2.4, 0, -0.6, 2.4, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  }
  const ladder = ladderOf({ ramp: 'flame', step: 6 })

  it('is a tile of the swatch’s own steps, a few texels a metre, with a (u, v) for each vertex', () => {
    const { tile, uvs } = windowTile(glass, ladder)
    expect(tile.width).toBeGreaterThanOrEqual(8)
    expect(tile.height).toBeGreaterThanOrEqual(8)
    expect(uvs.length).toBe(8)
    const colours = new Set<number>()
    for (let i = 0; i < tile.rgba.length; i += 4)
      colours.add(
        (tile.rgba[i] as number) * 65536 + (tile.rgba[i + 1] as number) * 256 + (tile.rgba[i + 2] as number),
      )
    expect(colours.size).toBeGreaterThan(1)
    for (const c of colours) expect(ladder.steps).toContain(c)
  })
  it('lays the whole tile across the glass: (0, 0) top left to (1, 1) bottom right', () => {
    const { uvs } = windowTile(glass, ladder)
    // Vertex 0 is the bottom left corner: u 0, v at the tile’s bottom.
    expect([uvs[0], uvs[1]]).toEqual([0, 1])
    expect([uvs[4], uvs[5]]).toEqual([1, 0])
  })
  it('draws the same room again', () => {
    expect(windowTile(glass, ladder).tile.rgba).toEqual(windowTile(glass, ladder).tile.rgba)
  })
})
