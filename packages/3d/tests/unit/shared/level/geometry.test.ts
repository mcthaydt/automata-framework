// One sector geometry: the queries and the triangulation the world builder, the editor and the sectors extension all
// stand on. The triangulation cases are the editor's (`packages/editor-3d/src/geometry/triangulate.test.ts`, which
// stays until task 14.1 deletes its copy): the shapes a level has (rectangles, an L, rooms with holes), the shipped
// level, and seeded random rooms; the queries' cases are the editor's `sectors.test.ts`.
import { describe, expect, it } from 'vitest'
import {
  crossing,
  insideSector,
  opening,
  polygonArea,
  segmentDistance,
  triangulate,
  walkBlocker,
} from '#src/shared/level/geometry.ts'
import { readLevel } from '#src/shared/level/read-level.ts'
import type { Point } from '#src/shared/level/sector.schema.ts'
import depot from '../../../fixtures/level/depot.af-sector.json' with { type: 'json' }

const p = (x: number, z: number): Point => ({ x, z })

const loop = (...pairs: readonly (readonly [number, number])[]): Point[] => pairs.map(([x, z]) => ({ x, z }))

const rect = (x0: number, z0: number, x1: number, z1: number): Point[] =>
  loop([x0, z0], [x1, z0], [x1, z1], [x0, z1])

const reversed = (points: readonly Point[]): Point[] => [...points].reverse()

type Result = ReturnType<typeof triangulate>

const corners = (result: Result, triangle: readonly [number, number, number]): Point[] =>
  triangle.map((index) => result.points[index] as Point)

const totalArea = (result: Result): number =>
  result.triangles.reduce((sum, triangle) => sum + polygonArea(corners(result, triangle)), 0)

/** The floor a room has: its outline less its holes. */
const floorArea = (outline: readonly Point[], holes: readonly (readonly Point[])[] = []): number =>
  Math.abs(polygonArea(outline)) - holes.reduce((sum, hole) => sum + Math.abs(polygonArea(hole)), 0)

const inside = (triangle: readonly Point[], p: Point): boolean => {
  const [a, b, c] = triangle as [Point, Point, Point]
  const side = (u: Point, v: Point) => (v.x - u.x) * (p.z - u.z) - (v.z - u.z) * (p.x - u.x)
  return side(a, b) > 1e-9 && side(b, c) > 1e-9 && side(c, a) > 1e-9
}

/** Every triangle is a real one with the outline's winding, every point is used, and the area is the room's floor. */
function expectFloor(
  result: Result,
  outline: readonly Point[],
  holes: readonly (readonly Point[])[] = [],
): void {
  for (const triangle of result.triangles) expect(polygonArea(corners(result, triangle))).toBeGreaterThan(0)
  const used = new Set(result.triangles.flat())
  expect([...used].sort((a, b) => a - b)).toEqual(result.points.map((_, index) => index))
  expect(totalArea(result)).toBeCloseTo(floorArea(outline, holes), 9)
}

describe('triangulate', () => {
  it('cuts a rectangle in two', () => {
    const outline = rect(0, 0, 8, 6)
    const result = triangulate(outline)
    expect(result.points).toEqual(outline)
    expect(result.triangles).toHaveLength(2)
    expectFloor(result, outline)
  })

  it('cuts a concave L into four triangles that cover exactly the L', () => {
    const outline = loop([0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6])
    const result = triangulate(outline)
    expect(result.triangles).toHaveLength(4)
    expectFloor(result, outline)
    expect(totalArea(result)).toBeCloseTo(6 * 2 + 2 * 4, 9)
  })

  it('does not cover the notch of the L with a triangle', () => {
    const outline = loop([0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6])
    const result = triangulate(outline)
    for (const triangle of result.triangles)
      expect(inside(corners(result, triangle), { x: 4, z: 4 })).toBe(false)
  })

  it('gives the triangles the winding of the outline whichever way round the outline is written', () => {
    const outline = loop([0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6])
    expectFloor(triangulate(reversed(outline)), outline)
    expectFloor(triangulate(outline), outline)
  })

  it('keeps the points of a collinear run along an edge', () => {
    const outline = loop([0, 0], [2, 0], [4, 0], [4, 3], [0, 3])
    const result = triangulate(outline)
    expect(result.triangles).toHaveLength(3)
    expectFloor(result, outline)
    const many = loop([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 3], [2, 3], [0, 3])
    expectFloor(triangulate(many), many)
  })

  it('gives nothing for fewer than three points', () => {
    expect(triangulate([]).triangles).toEqual([])
    expect(triangulate(loop([0, 0], [1, 0])).triangles).toEqual([])
  })

  it('works for a triangle', () => {
    const outline = loop([0, 0], [4, 0], [0, 3])
    const result = triangulate(outline)
    expect(result.triangles).toHaveLength(1)
    expectFloor(result, outline)
  })
})

describe('triangulate with holes', () => {
  it('cuts a rectangle with a rectangular hole into a ring', () => {
    const outline = rect(0, 0, 10, 8)
    const hole = rect(3, 2, 7, 6)
    const result = triangulate(outline, [hole])
    expect(result.points).toEqual([...outline, ...hole])
    expect(result.triangles).toHaveLength(8)
    expectFloor(result, outline, [hole])
    for (const triangle of result.triangles)
      expect(inside(corners(result, triangle), { x: 5, z: 4 })).toBe(false)
  })

  it('takes a hole written either way round', () => {
    const outline = rect(0, 0, 10, 8)
    const hole = rect(3, 2, 7, 6)
    expectFloor(triangulate(outline, [reversed(hole)]), outline, [hole])
    expectFloor(triangulate(reversed(outline), [hole]), outline, [hole])
    expectFloor(triangulate(reversed(outline), [reversed(hole)]), outline, [hole])
  })

  it('takes two holes', () => {
    const outline = rect(0, 0, 14, 8)
    const holes = [rect(2, 2, 5, 6), rect(8, 1, 12, 7)]
    const result = triangulate(outline, holes)
    expect(result.triangles).toHaveLength(4 + 4 + 4 + 2 * 2 - 2)
    expectFloor(result, outline, holes)
    for (const triangle of result.triangles)
      for (const centre of [
        { x: 3.5, z: 4 },
        { x: 10, z: 4 },
      ])
        expect(inside(corners(result, triangle), centre)).toBe(false)
  })

  it('takes a hole in the leg of a concave room', () => {
    const outline = loop([0, 0], [12, 0], [12, 3], [3, 3], [3, 12], [0, 12])
    const hole = rect(1, 5, 2, 9)
    expectFloor(triangulate(outline, [hole]), outline, [hole])
  })

  it('takes a slanted hole in a room with a notch cut into its side', () => {
    const outline = loop([0, 0], [10, 0], [10, 3], [6, 3], [6, 5], [10, 5], [10, 10], [0, 10])
    const hole = loop([2, 5], [4, 3.5], [5, 5], [4, 6.5])
    expectFloor(triangulate(outline, [hole]), outline, [hole])
  })

  it('takes a hole close to the outline', () => {
    const outline = rect(0, 0, 10, 8)
    const hole = loop([4, 0.5], [6, 0.5], [6, 2], [4, 2])
    expectFloor(triangulate(outline, [hole]), outline, [hole])
  })

  it('leaves out a hole that has fewer than three points', () => {
    const outline = rect(0, 0, 8, 6)
    const result = triangulate(outline, [loop([2, 2], [3, 3])])
    expect(result.triangles).toHaveLength(2)
    expect(totalArea(result)).toBeCloseTo(48, 9)
  })

  it('takes a triangular hole', () => {
    const outline = rect(0, 0, 8, 6)
    const hole = loop([2, 2], [6, 2], [4, 4.5])
    const result = triangulate(outline, [hole])
    expect(result.triangles).toHaveLength(4 + 3 + 2 - 2)
    expectFloor(result, outline, [hole])
  })

  it('takes a hole whose nearest corner of the room is behind another hole, in either order', () => {
    const outline = rect(0, 0, 20, 10)
    const near = rect(8, 4, 10, 6)
    const wall = rect(2, 1, 6, 9)
    expectFloor(triangulate(outline, [near, wall]), outline, [near, wall])
    expectFloor(triangulate(outline, [wall, near]), outline, [wall, near])
  })

  it('does not bridge through the wall of a concave hole to the corners it hides', () => {
    // A thin U-shaped hole, open at the top, and a vertex of the room on the line below it: from there the U's inner
    // corners are nearer than its outer ones, but they are behind its bottom wall. (x0 and x1 are its sides, z0 the
    // underside of the bottom wall and `wall` the thickness; found by search.)
    for (const { at, x0, x1, z0, wall } of [
      { at: 11, x0: 6, x1: 14, z0: 1, wall: 0.64 },
      { at: 11, x0: 6, x1: 13, z0: 1, wall: 0.58 },
      { at: 5, x0: 3, x1: 13, z0: 1, wall: 0.71 },
      { at: 9, x0: 4, x1: 14, z0: 2, wall: 0.5 },
    ]) {
      const outline = loop([0, 0], [at, 0], [20, 0], [20, 12], [0, 12])
      const hole = loop(
        [x0, z0],
        [x1, z0],
        [x1, 9],
        [x1 - wall, 9],
        [x1 - wall, z0 + wall],
        [x0 + wall, z0 + wall],
        [x0 + wall, 9],
        [x0, 9],
      )
      // The middle of the bottom wall and of each arm are in the hole, so no triangle may cover them.
      const probes = [
        { x: (x0 + x1) / 2, z: z0 + wall / 2 },
        { x: x0 + wall / 2, z: 6 },
        { x: x1 - wall / 2, z: 6 },
      ]
      for (const written of [hole, reversed(hole)]) {
        const result = triangulate(outline, [written])
        expectFloor(result, outline, [hole])
        for (const probe of probes)
          for (const triangle of result.triangles)
            expect(inside(corners(result, triangle), probe)).toBe(false)
      }
    }
  })

  it('does not bridge through the corner of another hole', () => {
    // The nearest corner of the room to the hole at (4, 4) is (0, 0), on a line that passes through the other hole's corners.
    const outline = rect(0, 0, 20, 20)
    const far = rect(4, 4, 6, 6)
    const between = rect(2, 2, 3, 3)
    expectFloor(triangulate(outline, [far, between]), outline, [far, between])
    expectFloor(triangulate(outline, [between, far]), outline, [between, far])
  })

  it('leaves out a hole that lies outside the room, which no corner can reach', () => {
    const outline = rect(0, 0, 8, 6)
    const result = triangulate(outline, [rect(20, 20, 22, 22)])
    expect(result.points).toHaveLength(8)
    expect(result.triangles).toHaveLength(2)
    expect(totalArea(result)).toBeCloseTo(48, 9)
  })

  it('gives nothing for an outline of fewer than three points, holes or not', () => {
    expect(triangulate(loop([0, 0], [1, 0]), [rect(0, 1, 1, 2)]).triangles).toEqual([])
  })

  it('does not cover a hole that reaches out of the room, nor hang on it', () => {
    const outline = rect(0, 0, 8, 6)
    const result = triangulate(outline, [rect(6, 2, 10, 4)])
    expect(result.points).toHaveLength(8)
    expect(Number.isFinite(totalArea(result))).toBe(true)
  })
})

describe('triangulate a polygon that is not simple', () => {
  it('comes back with triangles for a bow-tie, and for repeated corners', () => {
    const bow = loop([0, 0], [4, 4], [4, 0], [0, 4])
    expect(triangulate(bow).triangles.length).toBeGreaterThan(0)
    const repeated = loop([0, 0], [0, 0], [6, 0], [6, 4], [0, 4])
    const result = triangulate(repeated)
    expect(totalArea(result)).toBeCloseTo(24, 9)
    for (const triangle of result.triangles) expect(polygonArea(corners(result, triangle))).toBeGreaterThan(0)
  })

  it('cuts what ear clipping cannot as a fan from the first corner left, keeping the triangles that turn the right way', () => {
    // Polygons found by search that cross themselves: clipping finds no ear in what is left of them, and the fan's last
    // triangle is the only one that turns the right way in the last two.
    expect(triangulate(loop([5, 7], [3, 5], [4, 6], [1, 3], [8, 1])).triangles).toEqual([[0, 3, 4]])
    expect(triangulate(loop([8, 1], [3, 2], [3, 5], [3, 5], [6, 3], [5, 4])).triangles).toEqual([
      [2, 1, 0],
      [5, 2, 0],
    ])
    expect(triangulate(loop([5, 4], [4, 5], [3, 5], [1, 2], [1, 5])).triangles).toEqual([[0, 4, 3]])
    expect(triangulate(loop([0, 6], [8, 1], [6, 4], [3, 8], [3, 8], [8, 5])).triangles).toEqual([
      [0, 1, 2],
      [5, 0, 2],
    ])
  })
})

describe('triangulate the shipped level', () => {
  it('cuts every sector of the depot to the floor it has', () => {
    const { level } = readLevel(depot)
    expect(level.sectors).toHaveLength(2)
    for (const sector of level.sectors) {
      const points = (corners: readonly (readonly unknown[])[]): Point[] =>
        corners.map((corner) => ({ x: corner[0] as number, z: corner[1] as number }))
      const outline = points(sector.corners)
      const holes = (sector.holes ?? []).map(points)
      expectFloor(triangulate(outline, holes), outline, holes)
    }
  })
})

describe('triangulate seeded random rooms', () => {
  /** A small deterministic generator, so a failure names the seed that made it. */
  const random = (seed: number) => {
    let state = seed
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 4294967296
    }
  }

  it('cuts star-shaped rooms of 3 to 24 corners to exactly their floor', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const next = random(seed)
      const count = 3 + Math.floor(next() * 22)
      const outline = Array.from({ length: count }, (_, i) => {
        const angle = ((i + 0.5 * next()) / count) * 2 * Math.PI
        const radius = 2 + 6 * next()
        return {
          x: Math.round(radius * Math.cos(angle) * 100) / 100,
          z: Math.round(radius * Math.sin(angle) * 100) / 100,
        }
      })
      const result = triangulate(outline)
      expect(result.triangles, `seed ${seed}`).toHaveLength(count - 2)
      expect(totalArea(result), `seed ${seed}`).toBeCloseTo(Math.abs(polygonArea(outline)), 6)
    }
  })

  it('cuts star-shaped rooms with a hole in the middle, whatever the corner nearest the hole can see', () => {
    for (let seed = 1; seed <= 250; seed++) {
      const next = random(seed * 104729)
      const count = 5 + Math.floor(next() * 16)
      const outline = Array.from({ length: count }, (_, i) => {
        const angle = ((i + 0.5 * next()) / count) * 2 * Math.PI
        const radius = 4 + 4 * next()
        return {
          x: Math.round(radius * Math.cos(angle) * 100) / 100,
          z: Math.round(radius * Math.sin(angle) * 100) / 100,
        }
      })
      const sides = 3 + Math.floor(next() * 4)
      const [cx, cz] = [next() - 0.5, next() - 0.5]
      const hole = Array.from({ length: sides }, (_, i) => {
        const angle = ((i + 0.4 * next()) / sides) * 2 * Math.PI
        const radius = 0.6 + 0.6 * next()
        return {
          x: Math.round((cx + radius * Math.cos(angle)) * 100) / 100,
          z: Math.round((cz + radius * Math.sin(angle)) * 100) / 100,
        }
      })
      // Where the loops start and which way the hole goes round change the order the ears are clipped in.
      const shift = seed % count
      const started = [...outline.slice(shift), ...outline.slice(0, shift)]
      const result = triangulate(started, [seed % 2 === 0 ? reversed(hole) : hole])
      expect(result.triangles, `seed ${seed}`).toHaveLength(count + sides)
      expect(totalArea(result), `seed ${seed}`).toBeCloseTo(floorArea(outline, [hole]), 6)
    }
  })

  it('cuts a rectangle with a few separate rectangular holes to exactly its floor', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const next = random(seed * 7919)
      const holes: Point[][] = []
      const count = 1 + Math.floor(next() * 3)
      for (let i = 0; i < count; i++) {
        const x = 1 + i * 8 + Math.floor(next() * 3)
        const z = 1 + Math.floor(next() * 3)
        holes.push(rect(x, z, x + 1 + Math.floor(next() * 4), z + 1 + Math.floor(next() * 5)))
      }
      const outline = rect(0, 0, 2 + count * 8, 12)
      const result = triangulate(outline, holes)
      expect(result.triangles, `seed ${seed}`).toHaveLength(4 + 4 * count + 2 * count - 2)
      expect(totalArea(result), `seed ${seed}`).toBeCloseTo(floorArea(outline, holes), 6)
    }
  })
})

describe('crossing', () => {
  it.each([
    ['crosses in the middle', [0, 0, 4, 4, p(0, 4), p(4, 0)], 0.5],
    ['crosses a quarter of the way', [0, 0, 4, 0, p(1, -1), p(1, 3)], 0.25],
    ['crosses going the other way', [4, 0, 0, 0, p(1, -1), p(1, 3)], 0.75],
    ['touches with its end', [0, 0, 2, 0, p(2, -1), p(2, 1)], 1],
    ['stops short', [0, 0, 1, 0, p(2, -1), p(2, 1)], -1],
    ['runs parallel', [0, 0, 4, 0, p(0, 1), p(4, 1)], -1],
    ['lies along the other segment', [0, 0, 4, 0, p(1, 0), p(3, 0)], -1],
  ] as const)('%s', (_name, [px, pz, qx, qz, a, b], expected) => {
    expect(crossing(px, pz, qx, qz, a, b)).toBe(expected)
  })
})

describe('segmentDistance', () => {
  it.each([
    ['crossing segments', [p(0, 0), p(4, 4), p(0, 4), p(4, 0)], 0],
    ['parallel, one apart', [p(0, 0), p(4, 0), p(0, 1), p(4, 1)], 1],
    ['end to end, two apart', [p(0, 0), p(1, 0), p(3, 0), p(4, 0)], 2],
    ['a corner to a corner', [p(0, 0), p(1, 0), p(4, 3), p(4, 7)], 4.242640687119286],
    ['a segment end to the middle of another', [p(0, 0), p(4, 0), p(2, 1), p(2, 5)], 1],
    ['two points', [p(0, 0), p(0, 0), p(3, 4), p(3, 4)], 5],
  ] as const)('%s', (_name, [a, b, c, d], expected) => {
    expect(segmentDistance(a, b, c, d)).toBeCloseTo(expected, 12)
  })
})

describe('polygonArea', () => {
  it('is positive counter-clockwise on the plan, negative clockwise, and zero for a line', () => {
    expect(polygonArea([p(0, 0), p(4, 0), p(4, 3), p(0, 3)])).toBe(12)
    expect(polygonArea([p(0, 3), p(4, 3), p(4, 0), p(0, 0)])).toBe(-12)
    expect(polygonArea([p(0, 0), p(1, 1)])).toBe(0)
  })
})

describe('insideSector', () => {
  const ring = {
    points: [
      [p(0, 0), p(6, 0), p(6, 6), p(0, 6)],
      [p(2, 2), p(2, 4), p(4, 4), p(4, 2)],
    ],
  }
  it('holds a point inside its outline and outside every hole', () => {
    expect(insideSector(p(1, 1), ring)).toBe(true)
    expect(insideSector(p(3, 3), ring)).toBe(false)
    expect(insideSector(p(7, 1), ring)).toBe(false)
  })
})

describe('opening and walkBlocker', () => {
  it('opens a portal between the higher floor and the lower ceiling', () => {
    const edge = { sector: { floor: 0, ceiling: 3 }, next: { floor: 0.5, ceiling: 2.5 } }
    expect(opening(edge)).toEqual({ y0: 0.5, y1: 2.5 })
  })

  it('blocks a walker at a solid wall and a step too tall to climb, not at a low step or an upper span', () => {
    expect(walkBlocker({ kind: 'wall', y0: 0, y1: 3 })).toBe(true)
    expect(walkBlocker({ kind: 'lower', y0: 0, y1: 1 })).toBe(true)
    expect(walkBlocker({ kind: 'lower', y0: 0, y1: 0.2 })).toBe(false)
    expect(walkBlocker({ kind: 'upper', y0: 2, y1: 3 })).toBe(false)
  })
})
