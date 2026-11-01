// The mushroom clusters as two merged meshes (art direction spec §4.5, §4.10): every cap in one geometry and every stem
// in another, so the whole room's mushrooms cost two draws, not six a cluster.
import { describe, expect, it } from 'vitest'
import { CLUSTER, mushroomData } from './mushrooms.ts'

const spots = [
  { x: -4.55, y: 0, z: 0.8 },
  { x: 4.55, y: 0, z: 4 },
]

describe('mushroomData', () => {
  it('puts three caps and three stems in each cluster, all in one array each', () => {
    const { caps, stems } = mushroomData(spots)
    const perCap = caps.positions.length / 3 / (spots.length * CLUSTER.length)
    const perStem = stems.positions.length / 3 / (spots.length * CLUSTER.length)
    expect(Number.isInteger(perCap)).toBe(true)
    expect(Number.isInteger(perStem)).toBe(true)
    expect(caps.indices.length % 3).toBe(0)
    expect(Math.max(...caps.indices)).toBeLessThan(caps.positions.length / 3)
    expect(Math.max(...stems.indices)).toBeLessThan(stems.positions.length / 3)
  })

  it('keeps every vertex within its cluster, on or above the floor, and below 0.35 m', () => {
    for (const { positions } of Object.values(mushroomData(spots))) {
      for (let i = 0; i < positions.length; i += 3) {
        const [x, y, z] = [positions[i] as number, positions[i + 1] as number, positions[i + 2] as number]
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThan(0.35)
        expect(spots.some((s) => Math.hypot(s.x - x, s.z - z) < 0.45)).toBe(true)
      }
    }
  })

  it('gives every vertex a unit normal', () => {
    const { caps } = mushroomData(spots)
    for (let i = 0; i < caps.normals.length; i += 3)
      expect(
        Math.hypot(caps.normals[i] as number, caps.normals[i + 1] as number, caps.normals[i + 2] as number),
      ).toBeCloseTo(1, 5)
  })
})
