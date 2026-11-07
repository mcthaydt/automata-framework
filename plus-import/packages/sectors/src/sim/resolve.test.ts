// SC-a: the clinic resolves to the adventure source's own loops, portals, edges, masses and colliders, and passes the
// source's sector checks (its scenes test), re-pointed at the index-linked resolution (S4-D3). The sim's geometry is
// dmath and the source's is Math, so derived numbers are compared within 1e-12 and everything else exactly (S4-D5).
import { DEFAULT_TRIM, WALL_THICK } from '@mcthaydt/automata-sector-format'
import { describe, expect, it } from 'vitest'
import { clinicMap, clinicResolved } from '../testing/clinic'
import { crossing, insideSector, polygonArea } from './queries'
import { type Edge, resolveMap } from './resolve'

const TOLERANCE = 1e-12
const close = (actual: number, expected: number): boolean => Math.abs(actual - expected) <= TOLERANCE
const near = (p: { x: number; z: number }, q: { x: number; z: number }): boolean =>
  Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.z - q.z) < 1e-6

const map = resolveMap(clinicMap())
const source = clinicResolved()

describe('resolveMap of the clinic (SC-a)', () => {
  it('has the source’s sectors, loops and edges, in order', () => {
    expect(source.sourceCommit).toBe('92e67047a33161c5cfb1c5f9d8b981e91e1c55b9')
    expect(map.sectors.map((s) => s.id)).toEqual(source.sectors.map((s) => s.id))
    map.sectors.forEach((sector, s) => {
      const expected = source.sectors[s]
      expect(
        sector.loops.map((loop) => loop.length),
        sector.id,
      ).toEqual(expected?.loops.map((loop) => loop.length))
      sector.loops.forEach((loop, li) => {
        loop.forEach((edge, i) => {
          const want = expected?.loops[li]?.[i]
          const where = `${sector.id} loop ${li} edge ${i}`
          expect({ loop: edge.loop, index: edge.index, cut: edge.cut, thick: edge.thick }, where).toEqual({
            loop: want?.loop,
            index: want?.index,
            cut: want?.cut,
            thick: want?.thick,
          })
          expect(edge.next === undefined ? null : map.sectors[edge.next]?.id, `${where} portal`).toBe(
            want?.next,
          )
          for (const [actual, wanted] of [
            [edge.a.x, want?.a.x],
            [edge.a.z, want?.a.z],
            [edge.b.x, want?.b.x],
            [edge.b.z, want?.b.z],
            [edge.length, want?.length],
            [edge.u0, want?.u0],
          ] as const)
            expect(close(actual, wanted as number), `${where}: ${actual} vs ${wanted}`).toBe(true)
        })
      })
    })
  })

  it('has the source’s masses and colliders', () => {
    expect(map.masses).toEqual(source.masses)
    const colliders = map.colliders.map((c) => ({
      sector: map.sectors[c.sector]?.id,
      loop: c.loop,
      index: c.index,
      y0: c.y0,
      y1: c.y1,
    }))
    expect(colliders).toEqual(source.colliders)
  })
})

describe('the source’s sector checks, on the clinic', () => {
  it('every loop is closed, simple and wound with the room on its left', () => {
    for (const s of map.sectors)
      s.loops.forEach((loop, li) => {
        expect(loop.length, s.id).toBeGreaterThanOrEqual(3)
        const area = polygonArea(s.points[li] ?? [])
        if (li === 0) expect(area, `${s.id} outer`).toBeGreaterThan(0)
        else expect(area, `${s.id} hole`).toBeLessThan(0)
        for (const e of loop) {
          expect(e.length, `${s.id} edge ${e.index}`).toBeGreaterThan(1e-3)
          expect(near(e.b, (loop[e.succ] as Edge).a), `${s.id} edge ${e.index} joins the next`).toBe(true)
          const probe = {
            x: (e.a.x + e.b.x) / 2 + e.normal.x * 0.01,
            z: (e.a.z + e.b.z) / 2 + e.normal.z * 0.01,
          }
          expect(insideSector(probe, s), `${s.id} edge ${e.index} faces in`).toBe(true)
        }
        for (const e of loop)
          for (const f of loop) {
            if (e === f || e.succ === f.index || f.succ === e.index) continue
            expect(
              crossing(e.a.x, e.a.z, e.b.x, e.b.z, f.a, f.b),
              `${s.id}: ${e.index} and ${f.index}`,
            ).toBeLessThan(0)
          }
      })
  })

  it('sectors do not overlap', () => {
    for (const s of map.sectors)
      for (const t of map.sectors) {
        if (s === t) continue
        const outer = t.points[0] ?? []
        const centre = outer.reduce(
          (m, q) => ({ x: m.x + q.x / outer.length, z: m.z + q.z / outer.length }),
          {
            x: 0,
            z: 0,
          },
        )
        for (const p of outer) {
          const inner = { x: p.x + (centre.x - p.x) * 0.02, z: p.z + (centre.z - p.z) * 0.02 }
          if (insideSector(inner, t))
            expect(insideSector(inner, s), `${t.id} corner inside ${s.id}`).toBe(false)
        }
      }
  })

  it('portals match on both sides', () => {
    for (const e of map.edges) {
      if (e.next === undefined) continue
      const back = map.sectors[e.next]?.loops
        .flat()
        .find((f) => f.next === e.sector && near(f.a, e.b) && near(f.b, e.a))
      expect(back, `${map.sectors[e.sector]?.id} → ${map.sectors[e.next]?.id}`).toBeTruthy()
    }
  })
})

describe('resolveMap', () => {
  const room = (corners: unknown[], more: object = {}) => ({
    sectors: [{ id: 'r', zone: 'r', floor: 0, ceiling: 3, light: 1, corners, ...more }],
  })

  it('winds an outer loop counter-clockwise and a hole clockwise, keeping each wall on its own edge', () => {
    const clockwise = room(
      [
        [0, 0, { cut: 'west' }],
        [0, 4, { cut: 'north' }],
        [4, 4, { cut: 'east' }],
        [4, 0, { cut: 'south' }],
      ],
      {
        holes: [
          [
            [1, 1],
            [2, 1],
            [2, 2],
            [1, 2],
          ],
        ],
      },
    )
    const sector = resolveMap(clockwise as never).sectors[0]
    expect(polygonArea(sector?.points[0] ?? [])).toBeGreaterThan(0)
    expect(polygonArea(sector?.points[1] ?? [])).toBeLessThan(0)
    // The wall that ran 0,0 → 0,4 now runs 0,4 → 0,0 and keeps its cut group.
    const west = sector?.loops[0]?.find((e) => e.cut === 'west')
    expect([west?.a, west?.b]).toEqual([
      { x: 0, z: 4 },
      { x: 0, z: 0 },
    ])
  })

  it('lays the sector’s and the wall’s trim over the default, and defaults thick and cut', () => {
    const resolved = resolveMap(
      room(
        [
          [0, 0, { trim: { rail: 0 } }],
          [4, 0, { thick: 0.3 }],
          [4, 4],
          [0, 4],
        ],
        { trim: { cap: false } },
      ) as never,
    )
    const [first, second, third] = resolved.sectors[0]?.loops[0] ?? []
    expect(resolved.sectors[0]?.trim).toEqual({ ...DEFAULT_TRIM, cap: false })
    expect(first?.trim).toEqual({ ...DEFAULT_TRIM, cap: false, rail: 0 })
    expect([first?.thick, second?.thick]).toEqual([WALL_THICK, 0.3])
    expect(third?.cut).toBe('r:0:2')
  })

  it('expands a pilaster into three walls round one mass of masonry', () => {
    const resolved = resolveMap(
      room([
        [0, 0, { pilaster: { start: [0.5, 0.2] }, cut: 'south' }],
        [4, 0],
        [4, 4],
        [0, 4],
      ]) as never,
    )
    const loop = resolved.sectors[0]?.loops[0] ?? []
    expect(loop.length).toBe(7)
    expect(loop.slice(0, 4).map((e) => e.notch)).toEqual([true, true, true, false])
    expect(loop.slice(0, 3).map((e) => e.thick)).toEqual([0, 0, 0])
    expect(resolved.masses).toEqual([
      {
        points: [
          { x: 0, z: -WALL_THICK },
          { x: 0.5, z: -WALL_THICK },
          { x: 0.5, z: 0.2 },
          { x: 0, z: 0.2 },
        ],
        top: 3,
        cut: 'south',
      },
    ])
  })
})
