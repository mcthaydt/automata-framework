// Sector resolution: the toy cases come from running The Last Light's own `resolveSectors` (src/game/sectors.ts at
// 92e6704) on the same inputs; the shipped blockouts are compared with what that code made of them (the golden) and
// checked with the geometry cases of Last Light's tests/scenes.test.ts.
import { describe, expect, it } from 'vitest'
import type { Corner } from '../format/expand'
import type { Point } from '../format/sector.schema'
import {
  BLOCKOUT_NAMES,
  expandedBlockout,
  type GoldenGrid,
  loadGeometryGolden,
  sectorsShape,
} from '../testing/geometry-golden'
import { room, square } from '../testing/toy-sectors'
import {
  crossing,
  DEFAULT_TRIM,
  edges,
  floorAt,
  insideSector,
  polygonArea,
  type Resolved,
  resolveSectors,
  type Sector,
  sectorAt,
  segmentDistance,
  WALL_THICK,
} from './sectors'

const at = <T>(items: readonly T[], index: number): T => items[index] as T
const loopOf = (sector: Sector, loop = 0): Sector['loops'][number] => at(sector.loops, loop)
const only = (resolved: Resolved): Sector => at(resolved.sectors, 0)
const p = (x: number, z: number): Point => ({ x, z })
// Last Light's normal of an edge along x is `{ x: -0, z: 1 }`: compare as JSON, which writes -0 as 0.
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe('resolveSectors: loops', () => {
  it('turns a clockwise outer loop round so the room is on the left, each wall staying on its own edge', () => {
    const clockwise: Corner[] = [
      [0, 0, { cut: 'west' }],
      [0, 4, { cut: 'north' }],
      [4, 4, { cut: 'east' }],
      [4, 0, { cut: 'south' }],
    ]
    const sector = only(resolveSectors([room('a', clockwise)]))
    expect(sector.points).toEqual([[p(0, 0), p(4, 0), p(4, 4), p(0, 4)]])
    expect(polygonArea(at(sector.points, 0))).toBe(16)
    expect(loopOf(sector).map((edge) => edge.cut)).toEqual(['south', 'east', 'north', 'west'])
    expect(plain(loopOf(sector).map((edge) => edge.normal))).toEqual([p(0, 1), p(-1, 0), p(0, -1), p(1, 0)])
  })

  it('turns a counter-clockwise hole round, and a hole is outside the room', () => {
    const sector = only(resolveSectors([room('a', square(0, 0, 4, 4), { holes: [square(1, 1, 2, 2)] })]))
    expect(sector.points).toEqual([
      [p(0, 0), p(4, 0), p(4, 4), p(0, 4)],
      [p(1, 1), p(1, 2), p(2, 2), p(2, 1)],
    ])
    expect(polygonArea(at(sector.points, 1))).toBe(-1)
    expect(plain(loopOf(sector, 1).map((edge) => edge.normal))).toEqual([
      p(-1, 0),
      p(0, 1),
      p(1, 0),
      p(0, -1),
    ])
    expect(insideSector(p(1.5, 1.5), sector)).toBe(false)
    expect(insideSector(p(3, 3), sector)).toBe(true)
  })

  it('gives each edge its direction, length, distance along the loop, and its neighbours', () => {
    const sector = only(resolveSectors([room('a', square(0, 0, 4, 4), { holes: [square(1, 1, 2, 2)] })]))
    const outer = loopOf(sector)
    expect(outer.map((edge) => [edge.loop, edge.index, edge.length, edge.u0])).toEqual([
      [0, 0, 4, 0],
      [0, 1, 4, 4],
      [0, 2, 4, 8],
      [0, 3, 4, 12],
    ])
    expect(plain(outer.map((edge) => edge.dir))).toEqual([p(1, 0), p(0, 1), p(-1, 0), p(0, -1)])
    expect(at(outer, 0)).toMatchObject({ a: p(0, 0), b: p(4, 0), wall: {}, cut: 'a:0:0', thick: WALL_THICK })
    for (const edge of outer) {
      expect(edge.succ.prev).toBe(edge)
      expect(edge.prev.succ).toBe(edge)
      expect(edge.sector).toBe(sector)
    }
    expect(at(outer, 3).succ).toBe(at(outer, 0))
    expect(at(outer, 0).prev).toBe(at(outer, 3))
    expect(loopOf(sector, 1).map((edge) => [edge.loop, edge.length, edge.u0])).toEqual([
      [1, 1, 0],
      [1, 1, 1],
      [1, 1, 2],
      [1, 1, 3],
    ])
    expect(edges([sector])).toHaveLength(8)
  })

  it('gives a sector and an edge the default trim, overridden by the sector then by the wall', () => {
    const wall = { trim: { rail: 0.5 }, thick: 0.3 }
    const corners: Corner[] = [
      [0, 0, wall],
      [4, 0],
      [4, 4],
      [0, 4],
    ]
    const sector = only(resolveSectors([room('a', corners, { trim: { skirting: 0.2 } })]))
    expect(sector.trim).toEqual({ ...DEFAULT_TRIM, skirting: 0.2 })
    expect(loopOf(sector).map((edge) => edge.trim)).toEqual([
      { skirting: 0.2, wainscot: 1.14, rail: 0.5, cap: true },
      { skirting: 0.2, wainscot: 1.14, rail: 0.08, cap: true },
      { skirting: 0.2, wainscot: 1.14, rail: 0.08, cap: true },
      { skirting: 0.2, wainscot: 1.14, rail: 0.08, cap: true },
    ])
    expect(at(loopOf(sector), 0)).toMatchObject({ thick: 0.3, wall })
    expect(DEFAULT_TRIM).toEqual({ skirting: 0.14, wainscot: 1.14, rail: 0.08, cap: true })
  })
})

describe('resolveSectors: portals', () => {
  const pair = [
    room('a', [
      [0, 0],
      [4, 0, { next: 'b' }],
      [4, 4],
      [0, 4],
    ]),
    room('b', [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4, { next: 'a' }],
    ]),
  ]

  it('points a portal at the sector it names, the same object', () => {
    const { sectors } = resolveSectors(pair)
    const a = at(sectors, 0)
    const b = at(sectors, 1)
    expect(at(loopOf(a), 1).next).toBe(b)
    expect(at(loopOf(b), 3).next).toBe(a)
    expect(at(loopOf(a), 0).next).toBeUndefined()
  })

  it('refuses a portal to a sector that does not exist', () => {
    const bad = room('a', [
      [0, 0],
      [4, 0, { next: 'zz' }],
      [4, 4],
      [0, 4],
    ])
    expect(() => resolveSectors([bad])).toThrow('a: unknown portal target zz')
  })
})

describe('resolveSectors: pilasters', () => {
  const south = (pilaster: { start?: [number, number]; end?: [number, number] }): Corner[] => [
    [0, 0, { cut: 'south', pilaster }],
    [4, 0],
    [4, 4],
    [0, 4],
  ]

  it('builds a start pilaster as three notch walls round a mass of masonry, and drops the pilaster from the wall', () => {
    const resolved = resolveSectors([room('a', south({ start: [0.5, 0.25] }))])
    const sector = only(resolved)
    expect(sector.points).toEqual([[p(0, 0), p(0, 0.25), p(0.5, 0.25), p(0.5, 0), p(4, 0), p(4, 4), p(0, 4)]])
    const loop = loopOf(sector)
    expect(loop.map((edge) => edge.wall)).toEqual([
      { cut: 'south', thick: 0 },
      { cut: 'south', thick: 0 },
      { cut: 'south', thick: 0 },
      { cut: 'south' },
      {},
      {},
      {},
    ])
    expect(loop.map((edge) => [edge.length, edge.u0, edge.thick])).toEqual([
      [0.25, 0, 0],
      [0.5, 0.25, 0],
      [0.25, 0.75, 0],
      [3.5, 1, WALL_THICK],
      [4, 4.5, WALL_THICK],
      [4, 8.5, WALL_THICK],
      [4, 12.5, WALL_THICK],
    ])
    expect(resolved.masses).toEqual([
      { points: [p(0, -0.125), p(0.5, -0.125), p(0.5, 0.25), p(0, 0.25)], top: 3, cut: 'south' },
    ])
  })

  it('builds an end pilaster at the far end of the wall', () => {
    const resolved = resolveSectors([room('a', south({ end: [0.5, 0.25] }))])
    expect(only(resolved).points).toEqual([
      [p(0, 0), p(3.5, 0), p(3.5, 0.25), p(4, 0.25), p(4, 0), p(4, 4), p(0, 4)],
    ])
    expect(resolved.masses).toEqual([
      { points: [p(3.5, -0.125), p(4, -0.125), p(4, 0.25), p(3.5, 0.25)], top: 3, cut: 'south' },
    ])
  })

  it('mirrors a pilaster when its loop is turned round: the start of a clockwise wall is the end of the room-on-left one', () => {
    const clockwise: Corner[] = [
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 0, { cut: 'south', pilaster: { start: [0.5, 0.25] } }],
    ]
    const turned = resolveSectors([room('a', clockwise)])
    const end = resolveSectors([room('a', south({ end: [0.5, 0.25] }))])
    expect(turned.sectors.map((s) => s.points)).toEqual(end.sectors.map((s) => s.points))
    expect(turned.masses).toEqual(end.masses)
  })

  it('keeps the masses it is given, adds the pilasters after them, and changes neither its input nor the list', () => {
    const given = [{ points: [p(9, 9), p(10, 9), p(10, 10)], top: 2 }]
    const defs = [room('a', south({ start: [0.5, 0.25] }))]
    const before = structuredClone({ defs, given })
    const resolved = resolveSectors(defs, given)
    expect(resolved.masses).toHaveLength(2)
    expect(at(resolved.masses, 0)).toBe(at(given, 0))
    expect(structuredClone({ defs, given })).toEqual(before)
    expect(given).toHaveLength(1)
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
    expect(segmentDistance(a, b, c, d)).toBe(expected)
  })
})

describe('polygonArea', () => {
  it('is positive counter-clockwise on the plan, negative clockwise, and zero for a line', () => {
    expect(polygonArea([p(0, 0), p(4, 0), p(4, 3), p(0, 3)])).toBe(12)
    expect(polygonArea([p(0, 3), p(4, 3), p(4, 0), p(0, 0)])).toBe(-12)
    expect(polygonArea([p(0, 0), p(1, 1)])).toBe(0)
  })
})

describe('sectorAt and floorAt', () => {
  const resolved = resolveSectors([
    room(
      'low',
      [
        [0, 0],
        [4, 0, { next: 'high' }],
        [4, 4],
        [0, 4],
      ],
      { holes: [square(1, 1, 2, 2)] },
    ),
    room('high', square(4, 0, 8, 4), { floor: 0.5 }),
  ])
  const nameAt = (x: number, z: number) => sectorAt(resolved, p(x, z))?.id

  it('finds the sector a point is in, and none in a hole or outside the map', () => {
    expect(nameAt(0.5, 0.5)).toBe('low')
    expect(nameAt(3, 3)).toBe('low')
    expect(nameAt(5, 2)).toBe('high')
    expect(nameAt(1.5, 1.5)).toBeUndefined()
    expect(nameAt(9, 9)).toBeUndefined()
    expect(nameAt(-1, 0)).toBeUndefined()
  })

  it('gives a point on a shared wall to the sector it is on the near side of, as Last Light does', () => {
    expect(nameAt(4, 2)).toBe('high')
    expect(nameAt(0, 0)).toBe('low')
    expect(nameAt(1, 1)).toBeUndefined()
  })

  it('gives the floor under a point, and 0 outside the map', () => {
    expect(floorAt(resolved, 0.5, 0.5)).toBe(0)
    expect(floorAt(resolved, 5, 2)).toBe(0.5)
    expect(floorAt(resolved, 9, 9)).toBe(0)
  })
})

describe.each(BLOCKOUT_NAMES)('%s', (name) => {
  const expanded = expandedBlockout(name)
  const resolved = resolveSectors(expanded.sectors, expanded.masses)
  const golden = loadGeometryGolden()[name]

  it("resolves to exactly what Last Light's own resolveSectors made of it (sectors, edges and masses)", () => {
    expect(sectorsShape(resolved)).toEqual(golden.map.sectors)
    expect(JSON.parse(JSON.stringify(resolved.masses))).toEqual(golden.map.masses)
  })

  it("finds the same sector and floor as Last Light's on a 0.5 m grid over the plan", () => {
    const { step, x0, z0 } = golden.grid
    const points = resolved.sectors.flatMap((s) => s.points.flat())
    const maxX = Math.max(...points.map((q) => q.x))
    const maxZ = Math.max(...points.map((q) => q.z))
    const grid: GoldenGrid = { step, x0, z0, sector: [], floor: [] }
    for (let z = z0; z <= maxZ + step; z += step) {
      const sectorRow: number[] = []
      const floorRow: number[] = []
      for (let x = x0; x <= maxX + step; x += step) {
        const found = sectorAt(resolved, p(x, z))
        sectorRow.push(found ? resolved.sectors.indexOf(found) : -1)
        floorRow.push(floorAt(resolved, x, z))
      }
      grid.sector.push(sectorRow)
      grid.floor.push(floorRow)
    }
    expect(grid).toEqual(golden.grid)
  })

  const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z) < 1e-6

  it('has every loop closed, simple and wound with the room on its left', () => {
    for (const s of resolved.sectors)
      s.loops.forEach((loop, li) => {
        expect(loop.length, s.id).toBeGreaterThanOrEqual(3)
        const area = polygonArea(at(s.points, li))
        if (li === 0) expect(area, `${s.id} outer`).toBeGreaterThan(0)
        else expect(area, `${s.id} hole`).toBeLessThan(0)
        for (const e of loop) {
          expect(e.length, `${s.id} edge ${e.index}`).toBeGreaterThan(1e-3)
          expect(near(e.b, e.succ.a), `${s.id} edge ${e.index} joins the next`).toBe(true)
          // A point just inside each edge is inside the room.
          const probe = {
            x: (e.a.x + e.b.x) / 2 + e.normal.x * 0.01,
            z: (e.a.z + e.b.z) / 2 + e.normal.z * 0.01,
          }
          expect(insideSector(probe, s), `${s.id} edge ${e.index} faces in`).toBe(true)
        }
        for (const e of loop)
          for (const f of loop) {
            if (e === f || e.succ === f || f.succ === e) continue
            expect(
              crossing(e.a.x, e.a.z, e.b.x, e.b.z, f.a, f.b),
              `${s.id}: edges ${e.index} and ${f.index} cross`,
            ).toBeLessThan(0)
          }
      })
  })

  it('has sectors that do not overlap', () => {
    for (const s of resolved.sectors)
      for (const t of resolved.sectors)
        if (s !== t)
          for (const corner of at(t.points, 0)) {
            // A point just inside one sector's corner is not inside another.
            const outline = at(t.points, 0)
            const centre = outline.reduce(
              (m, q) => ({ x: m.x + q.x / outline.length, z: m.z + q.z / outline.length }),
              { x: 0, z: 0 },
            )
            const inner = {
              x: corner.x + (centre.x - corner.x) * 0.02,
              z: corner.z + (centre.z - corner.z) * 0.02,
            }
            if (insideSector(inner, t))
              expect(insideSector(inner, s), `${t.id} corner inside ${s.id}`).toBe(false)
          }
  })

  it('has portals that match on both sides', () => {
    for (const e of edges(resolved.sectors)) {
      if (!e.next) continue
      const back = e.next.loops.flat().find((f) => f.next === e.sector && near(f.a, e.b) && near(f.b, e.a))
      expect(back, `${e.sector.id} → ${e.next.id}`).toBeTruthy()
    }
  })
})
