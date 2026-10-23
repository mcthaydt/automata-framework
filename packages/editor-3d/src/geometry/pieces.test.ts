// Wall pieces, colliders and sight walls: the toy cases come from running The Last Light's own `useMap` (src/game/
// sectors.ts at 92e6704) on the same inputs; the shipped blockouts are compared with what that code made of them
// (the golden) and checked with the collider case of Last Light's tests/scenes.test.ts.
import { describe, expect, it } from 'vitest'
import type { SectorDef } from '../format/expand'
import type { WallDef } from '../format/sector.schema'
import { BLOCKOUT_NAMES, expandedBlockout, loadGeometryGolden, piecesShape } from '../testing/geometry-golden'
import { room } from '../testing/toy-sectors'
import {
  type Edge,
  edges,
  isPortal,
  opening,
  type Piece,
  type PortalEdge,
  pieces,
  type ResolvedMap,
  resolveMap,
  resolveSectors,
  STEP,
  walkBlocker,
} from './sectors'

type Level = Pick<SectorDef, 'floor' | 'ceiling'>

/** Two rooms side by side, `a` on the left, joined by a portal on a's east wall (its edge 1) and b's west wall (edge 3). */
const joined = (a: Level, b: Level, wall: WallDef = {}): ResolvedMap =>
  resolveMap([
    room(
      'a',
      [
        [0, 0],
        [4, 0, { next: 'b', ...wall }],
        [4, 4],
        [0, 4],
      ],
      a,
    ),
    room(
      'b',
      [
        [4, 0],
        [8, 0],
        [8, 4],
        [4, 4, { next: 'a' }],
      ],
      b,
    ),
  ])

const edgeOf = (map: ResolvedMap, sector: string, index: number): Edge => {
  const found = map.sectors.find((s) => s.id === sector)?.loops[0]?.[index]
  if (!found) throw new Error(`no edge ${sector}:${index}`)
  return found
}
const portalOf = (map: ResolvedMap, sector: string, index: number): PortalEdge => {
  const found = edgeOf(map, sector, index)
  if (!isPortal(found)) throw new Error(`${sector}:${index} is not a portal`)
  return found
}
const summary = (list: readonly Piece[]) => list.map((piece) => [piece.kind, piece.y0, piece.y1])
const ground: Level = { floor: 0, ceiling: 3 }

describe('pieces', () => {
  it('builds a solid wall as one piece from floor to ceiling, and it blocks walking', () => {
    const map = resolveMap([
      room(
        'a',
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
        ],
        { floor: 0.5, ceiling: 3 },
      ),
    ])
    expect(map.pieces).toHaveLength(4)
    for (const piece of map.pieces) {
      expect(piece).toMatchObject({ kind: 'wall', y0: 0.5, y1: 3 })
      expect(walkBlocker(piece)).toBe(true)
    }
  })

  it('leaves a portal between level rooms of the same height with no piece, and the opening is the whole height', () => {
    const map = joined(ground, ground)
    const portal = portalOf(map, 'a', 1)
    expect(pieces(portal)).toEqual([])
    expect(pieces(edgeOf(map, 'b', 3))).toEqual([])
    expect(opening(portal)).toEqual({ y0: 0, y1: 3 })
    expect(map.pieces).toHaveLength(6)
  })

  it('leaves a lower piece under a portal to a floor 0.30 higher, and it blocks walking', () => {
    const map = joined(ground, { floor: 0.3, ceiling: 3 })
    const portal = portalOf(map, 'a', 1)
    expect(summary(pieces(portal))).toEqual([['lower', 0, 0.3]])
    expect(walkBlocker(pieces(portal)[0] as Piece)).toBe(true)
    // From the high side the same portal builds nothing: the high floor is the opening's bottom.
    expect(pieces(edgeOf(map, 'b', 3))).toEqual([])
    expect(opening(portal)).toEqual({ y0: 0.3, y1: 3 })
    expect(opening(portalOf(map, 'b', 3))).toEqual({ y0: 0.3, y1: 3 })
  })

  it('leaves a lower piece under a portal to a floor 0.20 higher that can be walked up, and so does STEP exactly', () => {
    for (const step of [0.2, STEP]) {
      const map = joined(ground, { floor: step, ceiling: 3 })
      const [lower] = pieces(edgeOf(map, 'a', 1))
      expect(lower, `${step}`).toMatchObject({ kind: 'lower', y0: 0, y1: step })
      expect(walkBlocker(lower as Piece), `${step}`).toBe(false)
    }
    expect(STEP).toBe(0.25)
  })

  it('leaves an upper piece over a portal to a lower ceiling, and it does not block walking', () => {
    const map = joined(ground, { floor: 0, ceiling: 2.1 })
    const portal = portalOf(map, 'a', 1)
    expect(summary(pieces(portal))).toEqual([['upper', 2.1, 3]])
    expect(walkBlocker(pieces(portal)[0] as Piece)).toBe(false)
    expect(opening(portal)).toEqual({ y0: 0, y1: 2.1 })
  })

  it('leaves both a lower and an upper piece for a step and a lintel, and the opening lies between them', () => {
    const map = joined(ground, { floor: 0.3, ceiling: 2.1 })
    const portal = portalOf(map, 'a', 1)
    expect(summary(pieces(portal))).toEqual([
      ['lower', 0, 0.3],
      ['upper', 2.1, 3],
    ])
    expect(opening(portal)).toEqual({ y0: 0.3, y1: 2.1 })
  })

  it('builds the solid walls of a room with a lower ceiling only up to that ceiling', () => {
    const map = joined(ground, { floor: 0, ceiling: 2.1 })
    expect(
      map.pieces.filter((piece) => piece.edge.sector.id === 'b').map((piece) => [piece.y0, piece.y1]),
    ).toEqual([
      [0, 2.1],
      [0, 2.1],
      [0, 2.1],
    ])
  })
})

describe('colliders and sight walls', () => {
  const colliderNames = (map: ResolvedMap) => map.colliders.map((c) => `${c.edge.sector.id}:${c.edge.index}`)

  it('has a collider for every solid wall and every step too tall to climb, in the order of the pieces', () => {
    expect(colliderNames(joined(ground, ground))).toEqual(['a:0', 'a:2', 'a:3', 'b:0', 'b:1', 'b:2'])
    const step = joined(ground, { floor: 0.3, ceiling: 3 })
    expect(colliderNames(step)).toEqual(['a:0', 'a:1', 'a:2', 'a:3', 'b:0', 'b:1', 'b:2'])
    expect(step.colliders.find((c) => c.edge === edgeOf(step, 'a', 1))).toMatchObject({ y0: 0, y1: 0.3 })
    expect(colliderNames(joined(ground, { floor: 0.2, ceiling: 3 }))).not.toContain('a:1')
    expect(colliderNames(joined(ground, { floor: 0, ceiling: 2.1 }))).not.toContain('a:1')
  })

  it('has a collider across the opening of a masked portal that blocks, and not of one that does not', () => {
    const blocking = joined(ground, { floor: 0.2, ceiling: 3 }, { mask: 'glass', block: true })
    const last = blocking.colliders[blocking.colliders.length - 1]
    expect(last).toMatchObject({ y0: 0.2, y1: 3 })
    expect(last?.edge).toBe(edgeOf(blocking, 'a', 1))
    expect(colliderNames(joined(ground, ground, { mask: 'glass', block: true })).slice(-1)).toEqual(['a:1'])
    expect(colliderNames(joined(ground, ground, { mask: 'glass' }))).not.toContain('a:1')
  })

  it('has a sight wall for each piece that spans the 1.5 m eye height, ends included', () => {
    const names = (level: Level) =>
      resolveMap([
        room(
          'a',
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
          level,
        ),
      ]).sightWalls.map((e) => e.index)
    expect(names({ floor: 0, ceiling: 1.4 })).toEqual([])
    expect(names({ floor: 1.5, ceiling: 3 })).toEqual([0, 1, 2, 3])
    expect(names({ floor: 0, ceiling: 1.5 })).toEqual([0, 1, 2, 3])
    // Glass does not stop sight, and neither does the opening: a lower step and a lintel span other heights.
    const step = joined(ground, { floor: 0.3, ceiling: 2.1 })
    expect(step.sightWalls).not.toContain(edgeOf(step, 'a', 1))
    expect(step.sightWalls).toHaveLength(6)
  })
})

describe('resolveMap', () => {
  it('is resolveSectors with the lists built on it: the same sectors and masses, every edge, and the pieces of each', () => {
    const defs = [
      room(
        'a',
        [
          [0, 0],
          [4, 0, { next: 'b' }],
          [4, 4],
          [0, 4],
        ],
        ground,
      ),
      room(
        'b',
        [
          [4, 0],
          [8, 0],
          [8, 4],
          [4, 4, { next: 'a' }],
        ],
        { floor: 0.3, ceiling: 3 },
      ),
    ]
    const map = resolveMap(defs)
    const direct = resolveSectors(defs)
    expect(map.sectors.map((s) => s.id)).toEqual(direct.sectors.map((s) => s.id))
    expect(map.masses).toEqual(direct.masses)
    expect(map.edges).toEqual(edges(map.sectors))
    expect(map.pieces).toEqual(map.edges.flatMap(pieces))
  })
})

describe.each(BLOCKOUT_NAMES)('%s', (name) => {
  const expanded = expandedBlockout(name)
  const map = resolveMap(expanded.sectors, expanded.masses)
  const golden = loadGeometryGolden()[name].map

  it("has the pieces, colliders and sight walls Last Light's own useMap made of it", () => {
    const shape = piecesShape(map)
    expect(shape.pieces).toEqual(golden.pieces)
    expect(shape.colliders).toEqual(golden.colliders)
    expect(shape.sightWalls).toEqual(golden.sightWalls)
  })

  it('has colliders that cover exactly the solid walls and the steps too tall to climb', () => {
    for (const e of map.edges.filter((edge) => !edge.next))
      expect(
        map.colliders.some(
          (c) => c.edge === e && c.y0 <= e.sector.floor + 1e-6 && c.y1 >= e.sector.floor + 1.8,
        ),
        `${e.sector.id}:${e.cut}`,
      ).toBe(true)
    for (const c of map.colliders) {
      const step = pieces(c.edge).some((piece) => piece.kind === 'lower' && piece.y1 - piece.y0 > STEP)
      expect(!c.edge.next || step || !!c.edge.wall.block, `${c.edge.sector.id}:${c.edge.cut}`).toBe(true)
    }
    expect(map.colliders.length).toBeGreaterThan(0)
  })
})
