// Nav clearance: the toy cases come from running The Last Light's own `clear`, `nearestNode`, `nearAWall` and
// `throughWall` (src/game/nav.ts at 92e6704) on the same inputs; the shipped blockouts are compared with what that
// code answered (the golden) and checked with the nav cases of Last Light's tests/scenes.test.ts.
import { describe, expect, it } from 'vitest'
import type { Box } from '../format/expand'
import type { Point, SectorDef } from '../format/sector.schema'
import { BLOCKOUT_NAMES, expandedBlockout, loadGeometryGolden, navShape } from '../testing/geometry-golden'
import { room, square } from '../testing/toy-sectors'
import {
  clear,
  type NavWorld,
  navWorld,
  nearAWall,
  nearestNode,
  openDoors,
  segmentHitsBox,
  throughWall,
} from './nav'
import { resolveMap, sectorAt } from './sectors'

const p = (x: number, z: number): Point => ({ x, z })
const box = (id: string, kind: Box['kind'], x: number, z: number, w: number, d: number): Box => ({
  id,
  kind,
  x,
  z,
  y: 0,
  w,
  h: 1,
  d,
})
const worldOf = (defs: SectorDef[], boxes: Box[] = [], nodes: Record<string, Point> = {}): NavWorld =>
  navWorld(resolveMap(defs), { boxes, nodes, edges: [] })

describe('segmentHitsBox', () => {
  const desk = box('desk', 'desk', 4, 4, 1, 1)

  it('hits a box it runs through and misses one it passes, with the margin growing the box', () => {
    expect(segmentHitsBox(p(1, 4), p(7, 4), desk)).toBe(true)
    expect(segmentHitsBox(p(1, 2), p(7, 2), desk)).toBe(false)
    expect(segmentHitsBox(p(1, 4), p(3, 4), desk)).toBe(false)
    expect(segmentHitsBox(p(1, 4), p(3, 4), desk, 0.6)).toBe(true)
  })

  it('counts a graze as a hit, and a miss by a hair as a miss', () => {
    expect(segmentHitsBox(p(1, 3.5), p(7, 3.5), desk)).toBe(true)
    expect(segmentHitsBox(p(1, 3.4999), p(7, 3.4999), desk)).toBe(false)
    expect(segmentHitsBox(p(1, 3.4), p(7, 3.4), desk, 0.1)).toBe(true)
  })

  it('treats a segment parallel to a face as a hit inside the face and a miss outside it', () => {
    expect(segmentHitsBox(p(3.6, 1), p(3.6, 7), desk)).toBe(true)
    expect(segmentHitsBox(p(3.4, 1), p(3.4, 7), desk)).toBe(false)
  })
})

describe('clear and throughWall: walls', () => {
  const two = worldOf([room('a', square(0, 0, 4, 4)), room('b', square(5, 0, 9, 4))])

  it('is not clear through a wall, and a walk through a wall is through a wall', () => {
    expect(clear(two, p(2, 2), p(7, 2), {})).toBe(false)
    expect(throughWall(two, p(2, 2), p(7, 2))).toBe(true)
    expect(clear(two, p(1, 1), p(3, 3), {})).toBe(true)
    expect(throughWall(two, p(1, 1), p(3, 3))).toBe(false)
  })

  it('counts touching a wall as through it', () => {
    expect(throughWall(two, p(1, 1), p(4, 1))).toBe(true)
  })

  it('keeps its distance from a wall by the margin', () => {
    expect(clear(two, p(0.1, 2), p(3.9, 2), {}, 0)).toBe(true)
    expect(clear(two, p(0.1, 2), p(3.9, 2), {}, 0.3)).toBe(false)
    expect(nearAWall(two, p(0.1, 2), 0.3)).toBe(true)
    expect(nearAWall(two, p(0.1, 2), 0.05)).toBe(false)
    expect(nearAWall(two, p(2, 2), 0.3)).toBe(false)
  })

  it('allows a walk exactly the margin from a wall, and not a hair closer', () => {
    expect(clear(two, p(0.25, 1), p(0.25, 3), {}, 0.25)).toBe(true)
    expect(clear(two, p(0.25, 1), p(0.25, 3), {}, 0.2501)).toBe(false)
    expect(nearAWall(two, p(0.25, 2), 0.25)).toBe(false)
  })
})

describe('clear: furniture, doors and exits', () => {
  const hall = worldOf(
    [room('r', square(0, 0, 8, 8))],
    [box('desk', 'desk', 4, 4, 1, 1), box('d1', 'door', 2, 6, 0.2, 2), box('x', 'exit', 7, 7, 1, 1)],
  )

  it('is not clear through furniture, and clear when only walls count', () => {
    expect(clear(hall, p(1, 4), p(7, 4), {})).toBe(false)
    expect(clear(hall, p(1, 4), p(7, 4), {}, 0, true)).toBe(true)
  })

  it('keeps its distance from furniture by the margin', () => {
    expect(clear(hall, p(1, 3.2), p(7, 3.2), {}, 0)).toBe(true)
    expect(clear(hall, p(1, 3.2), p(7, 3.2), {}, 0.2)).toBe(true)
    expect(clear(hall, p(1, 3.2), p(7, 3.2), {}, 0.4)).toBe(false)
  })

  it('is not clear through a shut door, even for walls only, and clear once the door is open', () => {
    expect(clear(hall, p(1, 6), p(3, 6), {})).toBe(false)
    expect(clear(hall, p(1, 6), p(3, 6), { d1: false })).toBe(false)
    expect(clear(hall, p(1, 6), p(3, 6), {}, 0, true)).toBe(false)
    expect(clear(hall, p(1, 6), p(3, 6), { d1: true })).toBe(true)
  })

  it('is never clear through an exit, but clear past one', () => {
    expect(clear(hall, p(5, 7), p(7.9, 7), { d1: true })).toBe(false)
    expect(clear(hall, p(5, 7), p(7.9, 7), { d1: true }, 0, true)).toBe(false)
    expect(clear(hall, p(5, 6), p(7.9, 6), { d1: true })).toBe(true)
  })

  it('ignores an obstacle an end is inside, or within the margin of (a hotspot on a desk)', () => {
    expect(clear(hall, p(4, 4), p(7, 4), {})).toBe(true)
    expect(clear(hall, p(1, 4), p(4, 4), {})).toBe(true)
    expect(clear(hall, p(1, 4), p(3.3, 4), {}, 0.3)).toBe(true)
  })
})

describe('clear: raised floors', () => {
  const counter = worldOf([
    room('F', square(0, 0, 8, 8), {
      holes: [
        [
          [2, 2, { next: 'C' }],
          [2, 4, { next: 'C' }],
          [4, 4, { next: 'C' }],
          [4, 2, { next: 'C' }],
        ],
      ],
    }),
    room(
      'C',
      [
        [2, 2, { next: 'F' }],
        [4, 2, { next: 'F' }],
        [4, 4, { next: 'F' }],
        [2, 4, { next: 'F' }],
      ],
      { floor: 0.9 },
    ),
  ])
  // A dock D at 0.9 with a stair S at 0.7 beside it: S is a step from D, so neither is a free-standing solid.
  const dock = worldOf([
    room('F', square(0, 0, 8, 8), {
      holes: [
        [
          [2, 2, { next: 'D' }],
          [2, 4, { next: 'D' }],
          [4, 4, { next: 'D' }],
          [5, 4, { next: 'S' }],
          [5, 2, { next: 'S' }],
          [4, 2, { next: 'D' }],
        ],
      ],
    }),
    room(
      'D',
      [
        [2, 2, { next: 'F' }],
        [4, 2, { next: 'S' }],
        [4, 4, { next: 'F' }],
        [2, 4, { next: 'F' }],
      ],
      { floor: 0.9 },
    ),
    room(
      'S',
      [
        [4, 2, { next: 'F' }],
        [5, 2, { next: 'F' }],
        [5, 4, { next: 'F' }],
        [4, 4, { next: 'D' }],
      ],
      { floor: 0.7 },
    ),
  ])

  it('is not clear across a counter, but a walk that ends on its top ignores its sides (a hotspot on the counter)', () => {
    expect(clear(counter, p(1, 3), p(5, 3), {})).toBe(false)
    expect(throughWall(counter, p(1, 3), p(5, 3))).toBe(true)
    expect(clear(counter, p(1, 3), p(3, 3), {})).toBe(true)
    expect(clear(counter, p(3, 3), p(1, 3), {})).toBe(true)
    expect(clear(counter, p(1, 3), p(3, 3), {}, 0.3)).toBe(true)
    expect(throughWall(counter, p(1, 3), p(3, 3))).toBe(false)
    expect(nearAWall(counter, p(2.1, 3), 0.3)).toBe(false)
  })

  it('keeps the margin from the counter for a walk that does not end on it', () => {
    expect(clear(counter, p(1, 1), p(5, 1), {})).toBe(true)
    expect(clear(counter, p(1, 1.9), p(5, 1.9), {}, 0.3)).toBe(false)
    expect(nearAWall(counter, p(1.9, 3), 0.3)).toBe(true)
  })

  it('keeps the sides of a dock and its stair: a walk between levels goes round by the stairs', () => {
    expect(clear(dock, p(1, 3), p(3, 3), {})).toBe(false)
    expect(clear(dock, p(6, 3), p(4.5, 3), {})).toBe(false)
    expect(clear(dock, p(1, 3), p(6, 3), {})).toBe(false)
    // From the stair to the dock is a rise of 0.2: a step that can be climbed.
    expect(clear(dock, p(4.5, 3), p(3, 3), {})).toBe(true)
  })
})

describe('openDoors', () => {
  it('opens every door box and nothing else: a desk or an exit stays what it is', () => {
    const boxes = [
      box('d1', 'door', 2, 6, 0.2, 2),
      box('desk', 'desk', 4, 4, 1, 1),
      box('x', 'exit', 7, 7, 1, 1),
      box('d2', 'door', 5, 6, 0.2, 2),
    ]
    expect(openDoors({ boxes })).toEqual({ d1: true, d2: true })
    expect(openDoors({ boxes: [] })).toEqual({})
  })
})

describe('nearestNode', () => {
  const two = (nodes: Record<string, Point>) =>
    worldOf([room('a', square(0, 0, 4, 4)), room('b', square(5, 0, 9, 4))], [], nodes)

  it('picks the nearest node that can be walked to', () => {
    const world = two({ n1: p(2, 2), n2: p(7, 2), n3: p(3, 3) })
    expect(nearestNode(world, p(3.5, 3.5), {})).toBe('n3')
    const hall = worldOf([room('r', square(0, 0, 8, 8))], [box('desk', 'desk', 4, 4, 1, 1)], {
      near: p(3, 4),
      far: p(7, 4),
    })
    expect(nearestNode(hall, p(4.9, 4), {})).toBe('far')
    expect(nearestNode(hall, p(2.9, 4), {})).toBe('near')
  })

  it('takes the first of two nodes at the same distance', () => {
    const world = worldOf([room('a', square(0, 0, 4, 4))], [], { first: p(2, 1), second: p(2, 3) })
    expect(nearestNode(world, p(2, 2), {})).toBe('first')
  })

  it('returns null when no node can be walked to, or there are none', () => {
    expect(nearestNode(two({ n2: p(7, 2) }), p(1, 1), {})).toBeNull()
    expect(nearestNode(two({}), p(1, 1), {})).toBeNull()
  })

  it('keeps 0.2 m from walls unless told otherwise', () => {
    const world = two({ n1: p(2, 2), n3: p(3, 3) })
    expect(nearestNode(world, p(3.9, 3.9), {})).toBeNull()
    expect(nearestNode(world, p(3.9, 3.9), {}, 0.3)).toBeNull()
    expect(nearestNode(world, p(3.9, 3.9), {}, 0.02)).toBe('n3')
  })
})

describe.each(BLOCKOUT_NAMES)('%s', (name) => {
  const expanded = expandedBlockout(name)
  const map = resolveMap(expanded.sectors, expanded.masses)
  const world = navWorld(map, expanded)
  const open = openDoors(expanded)

  it("answers every nav question as Last Light's own nav code did", () => {
    expect(navShape(world, expanded)).toEqual(loadGeometryGolden()[name].nav)
  })

  it('has every navigation node standing inside a sector', () => {
    expect(Object.keys(world.nodes).length).toBeGreaterThan(0)
    for (const [node, at] of Object.entries(world.nodes)) expect(sectorAt(map, at), node).toBeTruthy()
  })

  it('has every navigation edge clear with the doors open', () => {
    for (const [a, b] of world.edges) {
      expect(clear(world, world.nodes[a] as Point, world.nodes[b] as Point, open, 0.3), `${a} → ${b}`).toBe(
        true,
      )
    }
  })

  it('has every hotspot reachable from the spawn with the doors open', () => {
    // Nodes connected to the one nearest the spawn point.
    const start = nearestNode(world, expanded.spawn, open)
    expect(start, 'a node near the spawn').toBeTruthy()
    const seen = new Set([start as string])
    const queue = [start as string]
    while (queue.length) {
      const node = queue.shift() as string
      for (const [a, b] of world.edges) {
        const next = a === node ? b : b === node ? a : null
        if (next && !seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    const free = (at: Point) =>
      !!sectorAt(map, at) &&
      !world.boxes.some(
        (b) =>
          b.kind !== 'door' && Math.abs(at.x - b.x) < b.w / 2 + 0.3 && Math.abs(at.z - b.z) < b.d / 2 + 0.3,
      )
    for (const h of expanded.hotspots) {
      let ok = false
      for (let r = 0.35; r <= h.reach * 0.8 && !ok; r += 0.1)
        for (let a = 0; a < 32 && !ok; a++) {
          const at = {
            x: h.x + Math.cos((a / 32) * Math.PI * 2) * r,
            z: h.z + Math.sin((a / 32) * Math.PI * 2) * r,
          }
          ok = free(at) && [...seen].some((node) => clear(world, world.nodes[node] as Point, at, open, 0.3))
        }
      expect(ok, h.id).toBe(true)
    }
  })
})
