import { describe, expect, it } from 'vitest'
import { box, quad, rbox } from '#src/features/world/mesh.ts'
import { objectFrame, wallFrame } from '#src/features/world/surface.ts'
import { isFloorLike, surfaceUv, uvMesh } from '#src/features/world/surface-uv.ts'

describe('where a point lies on its surface', () => {
  it('is the world’s x and z on a floor, and x and y on a wall that faces z', () => {
    expect(surfaceUv([2, 0, 3], [0, 1, 0], undefined)).toEqual([2, 3])
    expect(surfaceUv([2, 0, 3], [0, -1, 0], undefined)).toEqual([2, 3])
    expect(surfaceUv([2, 1.5, 0], [0, 0, 1], undefined)).toEqual([2, 1.5])
  })

  it('is z and y on a wall that faces x', () => {
    expect(surfaceUv([0, 1.5, 4], [1, 0, 0], undefined)).toEqual([4, 1.5])
  })

  it('calls a face floor-like from a slope of 0.7 up', () => {
    expect(isFloorLike([0, 0.7, 0.714])).toBe(true)
    expect(isFloorLike([0, 0.69, 0.724])).toBe(false)
  })

  it('starts a wall’s tile at the wall’s start, the way the wall’s frame lays it', () => {
    // A wall from (4, 2) facing +z: along it is +x here, and the tile starts at its start.
    const frame = wallFrame([4, 2], 0, [0, 1])
    expect(surfaceUv([5.5, 1, 2], [0, 0, 1], frame)).toEqual([1.5, 1])
    expect(surfaceUv([4, 0, 2], [0, 0, 1], frame)).toEqual([0, 0])
  })

  it('lays a prop’s tile in the prop’s own frame, which turns with it', () => {
    const frame = objectFrame(90, [3, 0, 3])
    // Turned a quarter, the prop’s front faces +x in the world and its local x runs along -z.
    const [u, v] = surfaceUv([3.5, 0.4, 2], [1, 0, 0], frame)
    expect(u).toBeCloseTo(1, 9)
    expect(v).toBeCloseTo(0.4, 9)
  })
})

describe('a mesh with its texture coordinates', () => {
  it('gives a flat face its coordinates in metres and keeps its triangles', () => {
    const wall = quad([0, 0, 0], [4, 0, 0], [0, 2.5, 0], 2, 2)
    const out = uvMesh(wall, undefined)
    expect(out.indices).toEqual(wall.indices)
    expect(out.uvs).toHaveLength((wall.positions.length / 3) * 2)
    expect(out.uvs?.slice(0, 2)).toEqual([0, 0])
    expect(out.uvs?.slice(-2)).toEqual([4, 2.5])
    expect(new Set(out.floor)).toEqual(new Set([0]))
  })

  it('flags a floor’s vertices as floor-like', () => {
    const floor = quad([0, 0, 0], [3, 0, 0], [0, 0, -2])
    expect(new Set(uvMesh(floor, undefined).floor)).toEqual(new Set([1]))
  })

  it('splits a prop so each triangle takes one projection, and floor and walls meet in neither', () => {
    const crate = box([0, 0, 0], [1, 1, 1])
    const out = uvMesh(crate, undefined)
    // A box’s faces never share a vertex, so none is split; its top is floor-like and its sides are not.
    expect(out.positions).toHaveLength(crate.positions.length)
    const floorLike = (out.floor ?? []).reduce((n, f) => n + f, 0)
    expect(floorLike).toBe(8) // the top and the bottom, 4 vertices each
    const round = rbox([0, 0, 0], [1, 1, 1], 0.3)
    const split = uvMesh(round, undefined)
    expect(split.positions.length).toBeGreaterThanOrEqual(round.positions.length)
    // Every triangle’s three vertices agree about being floor-like, so a texel is never between two tiles.
    for (let t = 0; t < split.indices.length; t += 3) {
      const flags = [0, 1, 2].map((k) => split.floor?.[split.indices[t + k] as number])
      expect(new Set(flags).size).toBe(1)
    }
  })
})
