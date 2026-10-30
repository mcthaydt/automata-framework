// Ported in part from The Last Light `tests/indirect-light.test.ts` ("bakes every subdivided vertex"; fixed lamps
// scaled by their level) and `tests/vertex-lighting-cache.test.ts` ("refreshes changed light inputs … to match a fresh
// lighting pass"; no upload when nothing changed) at 92e6704, on plain vertex arrays.
import { describe, expect, it } from 'vitest'
import { sceneLightingSchema } from './scene-lighting.schema.js'
import { bakeVertices } from './vertex-bake.js'

// A 4 × 4 floor patch of 25 vertices around the origin, facing up.
function floorPatch(): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = []
  const normals: number[] = []
  for (let i = 0; i <= 4; i++)
    for (let j = 0; j <= 4; j++) {
      positions.push(i - 2, 0, j - 2)
      normals.push(0, 1, 0)
    }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals) }
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const translate = (x: number, y: number, z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]

const lighting = sceneLightingSchema.parse({
  ambient: 0.15,
  lamps: [
    { id: 'warm', x: -1, y: 1.5, z: 0, color: 0xffcc80, range: 3 },
    { id: 'far', x: 30, y: 1.5, z: 0, color: 0x80c0ff, range: 3 },
  ],
})

const colours = (bake: ReturnType<typeof bakeVertices>, levels = {}) => {
  const out = new Float32Array(bake.vertexCount * 4)
  bake.write(levels, out)
  return out
}

describe('bakeVertices', () => {
  it('gives every vertex an opaque colour that varies across the patch', () => {
    const { positions, normals } = floorPatch()
    const out = colours(bakeVertices(positions, normals, IDENTITY, lighting))
    expect(out.length).toBe(25 * 4)
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(1)
    expect(new Set(out).size).toBeGreaterThan(4)
  })

  it('lists only the lamps that reach a vertex', () => {
    const { positions, normals } = floorPatch()
    expect([...bakeVertices(positions, normals, IDENTITY, lighting).reachedBy]).toEqual(['warm'])
    expect([...bakeVertices(positions, normals, translate(30, 0, 0), lighting).reachedBy]).toEqual(['far'])
  })

  it('scales a lamp by its level: brighter at 1 than at 0.3, ambient only at 0', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, IDENTITY, lighting)
    const dim = colours(bake, { warm: 0.3 })
    const full = colours(bake, { warm: 1 })
    expect(full.some((v, i) => v > (dim[i] ?? 0))).toBe(true)
    expect(full.every((v, i) => v >= (dim[i] ?? 0))).toBe(true)
    const off = colours(bake, { warm: 0 })
    expect(Math.max(...off.filter((_, i) => i % 4 !== 3))).toBeCloseTo(0.15, 5)
  })

  it('after a change of levels writes what a fresh bake at those levels writes, and reports no change twice', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, IDENTITY, lighting)
    const out = new Float32Array(bake.vertexCount * 4)
    expect(bake.write({ warm: 1 }, out)).toBe(true)
    expect(bake.write({ warm: 0.4 }, out)).toBe(true)
    expect(out).toEqual(colours(bakeVertices(positions, normals, IDENTITY, lighting), { warm: 0.4 }))
    expect(bake.write({ warm: 0.4 }, out)).toBe(false)
  })

  it('writes nothing new when a lamp that reaches no vertex changes level', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, IDENTITY, lighting)
    const out = new Float32Array(bake.vertexCount * 4)
    bake.write({}, out)
    expect(bake.write({ far: 0 }, out)).toBe(false)
    expect(bake.write({ far: 0, warm: 0.5 }, out)).toBe(true)
  })

  it('places vertices and turns normals by the world matrix', () => {
    // One vertex facing +z, turned to face -x (a quarter turn about y) and moved beside the warm lamp.
    const position = new Float32Array([0, 0, 0])
    const normal = new Float32Array([0, 0, 1])
    const quarter = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 1.5, 0, 1]
    const facing = colours(bakeVertices(position, normal, quarter, lighting))
    expect(facing[0]).toBeGreaterThan(0.15)
    const away = colours(bakeVertices(position, normal, [...quarter.slice(0, 12), -2, 1.5, 0, 1], lighting))
    expect(away[0]).toBeCloseTo(0.15, 5)
  })

  it('applies contact darkening from the occluders', () => {
    const { positions, normals } = floorPatch()
    const walled = {
      ...lighting,
      lamps: [],
      planes: [{ x: 2.05, y: 1, z: 0, normal: [-1, 0, 0] as [number, number, number], width: 6, height: 2 }],
    }
    const out = colours(bakeVertices(positions, normals, IDENTITY, walled))
    // The row against the wall (x = 2) is darker than the middle (x = 0).
    expect(out[(4 * 5 + 2) * 4]).toBeLessThan(out[(2 * 5 + 2) * 4] ?? 0)
  })
})
