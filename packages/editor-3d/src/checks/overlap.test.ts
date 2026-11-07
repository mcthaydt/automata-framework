// A rule Last Light has only as a test ("sectors do not overlap", tests/scenes.test.ts): no point on the plan is in two
// sectors. New here, so its evidence is seeded layouts: touching, nested, holed and concave ones that must pass or fail.

import type { Corner } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { insideSector } from '../geometry/sectors'
import { plainContext } from '../testing/check-context'
import { room, square } from '../testing/toy-sectors'
import { overlapProblems } from './overlap'

const rooms = (...defs: ReturnType<typeof room>[]) => {
  const context = plainContext(defs)
  return { context, found: overlapProblems(context) }
}
const ring = (outer: Corner[], hole: Corner[]) => room('a', outer, { holes: [hole] })

describe('overlapProblems', () => {
  it("passes rooms side by side, a connector's width apart, and rooms that touch along a wall or at a corner", () => {
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(4.125, 0, 8, 4))).found).toEqual([])
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(4, 0, 8, 4))).found).toEqual([])
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(4, 4, 8, 8))).found).toEqual([])
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(4, 1, 8, 2))).found).toEqual([])
  })

  const overlapping: [string, ReturnType<typeof room>, ReturnType<typeof room>][] = [
    ['a partial overlap', room('a', square(0, 0, 4, 4)), room('b', square(2, 2, 6, 6))],
    ['one room inside another', room('a', square(0, 0, 10, 10)), room('b', square(2, 2, 4, 4))],
    [
      'one room inside another, the other way round',
      room('a', square(2, 2, 4, 4)),
      room('b', square(0, 0, 10, 10)),
    ],
    ['two identical rooms', room('a', square(0, 0, 4, 4)), room('b', square(0, 0, 4, 4))],
    ['a cross-shaped pair', room('a', square(0, 3, 10, 5)), room('b', square(4, 0, 6, 10))],
    [
      'rooms that share two walls and overlap, with no wall crossing',
      room('a', square(0, 0, 4, 4)),
      room('b', square(2, 0, 6, 4)),
    ],
    ['a room across the corner of another', room('a', square(0, 0, 4, 4)), room('b', square(3, 3, 8, 8))],
    [
      'a room that fits in another along a shared wall',
      room('a', square(0, 0, 4, 4)),
      room('b', square(0, 1, 2, 3)),
    ],
  ]
  for (const [what, first, second] of overlapping) {
    it(`fails ${what}, naming both rooms and locating a point in both`, () => {
      const { context, found } = rooms(first, second)
      expect(found).toHaveLength(1)
      const [problem] = found
      expect(problem?.message).toMatch(/^a and b overlap near \(-?[\d.]+, -?[\d.]+\)$/)
      expect(problem?.locator?.selection).toBe('sector:a')
      expect(problem?.related?.map((locator) => locator.selection)).toEqual(['sector:b'])
      const at = problem?.locator?.at
      expect(at).toBeDefined()
      for (const sector of context.map.sectors)
        expect(insideSector(at as never, sector), sector.id).toBe(true)
    })
  }

  it("does not count a hole's inside: a room placed in the hole passes, one that fills it exactly passes", () => {
    const outer = square(0, 0, 10, 10)
    const hole = square(3, 3, 7, 7)
    expect(rooms(ring(outer, hole), room('b', square(4, 4, 6, 6))).found).toEqual([])
    expect(rooms(ring(outer, hole), room('b', square(3, 3, 7, 7))).found).toEqual([])
  })

  it('fails a room that is half in the hole and half in the body', () => {
    const { found } = rooms(ring(square(0, 0, 10, 10), square(3, 3, 7, 7)), room('b', square(2, 4, 5, 6)))
    expect(found).toHaveLength(1)
  })

  it('reads a concave room by its shape and not its bounding box', () => {
    const l: Corner[] = [
      [0, 0],
      [6, 0],
      [6, 2],
      [2, 2],
      [2, 6],
      [0, 6],
    ]
    expect(rooms(room('a', l), room('b', square(3, 3, 5, 5))).found).toEqual([])
    expect(rooms(room('a', l), room('b', square(1, 1, 3, 3))).found).toHaveLength(1)
  })

  it("does not take a very thin overlap for a touch, nor a hair's breadth gap for an overlap", () => {
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(3.99, 0, 8, 4))).found).toHaveLength(1)
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(4.000001, 0, 8, 4))).found).toEqual([])
  })

  it('finds an overlap that is only a centimetre across, and lets one under a millimetre go as a touch', () => {
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(3.99, 3.99, 8, 8))).found).toHaveLength(1)
    expect(rooms(room('a', square(0, 0, 4, 4)), room('b', square(3.9995, 3.9995, 8, 8))).found).toEqual([])
  })

  it('lists each overlapping pair once, in sector order', () => {
    const { found } = rooms(
      room('a', square(0, 0, 4, 4)),
      room('b', square(3, 0, 7, 4)),
      room('c', square(6, 0, 10, 4)),
    )
    expect(found.map((problem) => problem.message.replace(/ near .*/, ''))).toEqual([
      'a and b overlap',
      'b and c overlap',
    ])
  })

  it('does not look at height: rooms one above the other are still one on the other on the plan', () => {
    const { found } = rooms(
      room('a', square(0, 0, 4, 4)),
      room('b', square(0, 0, 4, 4), { floor: 3, ceiling: 6 }),
    )
    expect(found).toHaveLength(1)
  })

  it('has nothing to say about one room, or none', () => {
    expect(rooms(room('a', square(0, 0, 4, 4))).found).toEqual([])
    expect(rooms().found).toEqual([])
  })
})
