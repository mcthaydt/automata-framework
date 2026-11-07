// The geometry of sectors (over `/2`'s corners and holes): where a
// point stands, a plane's height, the triangulation, and a level's wall segments with the stretches rooms share.
import { describe, expect, it } from 'vitest'
import {
  fill,
  heightAt,
  inside,
  inward,
  isDegenerate,
  segments,
  signedArea,
  standsIn,
} from '#src/features/world/sectors.ts'
import type { AfCorner2, AfSector2, AfSectorEntry2 } from '#src/shared/level/af-sector-2.schema.ts'

const room = (
  id: string,
  rect: [number, number, number, number],
  extra: Partial<AfSectorEntry2> = {},
): AfSectorEntry2 => {
  const [x0, z0, x1, z1] = rect
  return {
    id,
    floor: { z: 0 },
    ceiling: { z: 3 },
    light: 1,
    corners: [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ] as AfCorner2[],
    ...extra,
  }
}
const level = (...sectors: AfSectorEntry2[]): AfSector2 => ({ format: 'af-sector/2', name: 't', sectors })
const areaOf = (points: readonly (readonly [number, number])[], triangles: number[]): number => {
  let sum = 0
  for (let t = 0; t < triangles.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map(
      (k) => points[triangles[t + k] as number] as readonly [number, number],
    ) as [readonly [number, number], readonly [number, number], readonly [number, number]]
    sum += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
  }
  return sum
}

describe('points and planes', () => {
  const square = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ] as const
  it('says where a point stands', () => {
    expect(inside(square, 1, 1)).toBe(true)
    expect(inside(square, 5, 1)).toBe(false)
  })
  it('keeps a hole out of the room', () => {
    const s = room('a', [0, 0, 4, 4], {
      holes: [
        [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
        ],
      ],
    })
    expect(standsIn(s, 3, 3)).toBe(true)
    expect(standsIn(s, 1.5, 1.5)).toBe(false)
  })
  it('raises a sloped plane along its slope from the first corner', () => {
    expect(heightAt({ z: 1, slope: [0.1, 0.5] }, [0, 0], 2, 2)).toBeCloseTo(1 + 0.2 + 1)
    expect(heightAt({ z: 1 }, [0, 0], 9, 9)).toBe(1)
  })
  it('measures a polygon’s area with its winding', () => {
    expect(signedArea(square)).toBe(16)
    expect(signedArea([...square].reverse())).toBe(-16)
  })
  it('calls a room with no area degenerate', () => {
    expect(isDegenerate(room('line', [0, 0, 4, 0]))).toBe(true)
    expect(isDegenerate(room('ok', [0, 0, 4, 4]))).toBe(false)
    expect(
      isDegenerate({
        ...room('two', [0, 0, 4, 4]),
        corners: [
          [0, 0],
          [1, 1],
        ] as AfCorner2[],
      }),
    ).toBe(true)
  })
})

describe('triangulation', () => {
  it('covers an L exactly', () => {
    const l = [
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [2, 4],
      [0, 4],
    ] as const
    expect(areaOf(fill(l).points, fill(l).triangles)).toBeCloseTo(12)
  })
  it('covers a clockwise polygon too', () => {
    const cw = [
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 0],
    ] as const
    expect(areaOf(fill(cw).points, fill(cw).triangles)).toBeCloseTo(16)
  })
  it('covers a room with a hole: the room’s area less the hole’s', () => {
    const { points, triangles } = fill(
      [
        [0, 0],
        [6, 0],
        [6, 6],
        [0, 6],
      ],
      [
        [
          [2, 2],
          [4, 2],
          [4, 4],
          [2, 4],
        ],
      ],
    )
    expect(areaOf(points, triangles)).toBeCloseTo(36 - 4)
  })
  it('covers a room with two holes', () => {
    const { points, triangles } = fill(
      [
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5],
      ],
      [
        [
          [1, 1],
          [3, 1],
          [3, 4],
          [1, 4],
        ],
        [
          [6, 1],
          [9, 1],
          [9, 4],
          [6, 4],
        ],
      ],
    )
    expect(areaOf(points, triangles)).toBeCloseTo(50 - 6 - 9)
  })
})

describe('segments', () => {
  it('cuts an edge where another room shares it, T-junctions included', () => {
    // A 4 m room against the middle of an 8 m wall: the long wall is solid, shared, solid.
    const lv = level(room('big', [0, 0, 8, 4]), room('side', [8, 1, 12, 3]))
    const wall = segments(lv).filter((s) => s.sector === 0 && s.a[0] === 8 && s.b[0] === 8)
    expect(wall.map((s) => [s.next, Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])])).toEqual([
      [-1, 0, 1],
      [1, 1, 3],
      [-1, 3, 4],
    ])
  })
  it('gives both rooms the shared stretch, each pointing at the other', () => {
    const lv = level(room('a', [0, 0, 4, 4]), room('b', [4, 0, 8, 4]))
    const shared = segments(lv).filter((s) => s.next >= 0)
    expect(shared.map((s) => [s.sector, s.next]).sort()).toEqual([
      [0, 1],
      [1, 0],
    ])
  })
  it('leaves rooms that only share a corner closed', () => {
    const lv = level(room('a', [0, 0, 4, 4]), room('b', [4, 4, 8, 8]))
    expect(segments(lv).every((s) => s.next < 0)).toBe(true)
  })
  it('ignores a degenerate room', () => {
    const lv = level(room('a', [0, 0, 4, 4]), room('line', [4, 0, 4, 4]))
    expect(segments(lv).every((s) => s.sector === 0 && s.next < 0)).toBe(true)
  })
  it('turns a wall into its room: the inward normal', () => {
    const lv = level(room('a', [0, 0, 4, 4]))
    const north = segments(lv).find((s) => s.edge === 0)!
    expect(inward(lv, north)).toEqual([0, 1])
    const east = segments(lv).find((s) => s.edge === 1)!
    expect(inward(lv, east)).toEqual([-1, 0])
  })
  it('walls a hole from the room side', () => {
    const lv = level(
      room('a', [0, 0, 6, 6], {
        holes: [
          [
            [2, 2],
            [4, 2],
            [4, 4],
            [2, 4],
          ],
        ],
      }),
    )
    const hole = segments(lv).filter((s) => s.ring === 1)
    expect(hole).toHaveLength(4)
    const top = hole.find((s) => s.edge === 0)!
    expect(inward(lv, top)).toEqual([0, -1])
  })
})
