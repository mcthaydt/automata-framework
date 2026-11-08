// A rule Last Light does not check on a document (its engine takes whatever heights a sector has): a ceiling must be
// above its floor, and a portal must leave an opening, or no one can pass and the wall pieces are inside out.
import { describe, expect, it } from 'vitest'
import { heightProblems } from '#src/shared/checks/heights.ts'
import { plainContext } from '#src/testing/check-context.ts'
import { room, square } from '#src/testing/toy-sectors.ts'

const west = [
  [0, 0],
  [4, 0, { next: 'b' }],
  [4, 4],
  [0, 4],
] as const
const east = [
  [4, 0],
  [8, 0],
  [8, 4],
  [4, 4, { next: 'a' }],
] as const
/** Two rooms joined by a portal each way, `b` with the given heights. */
const joined = (b: { floor?: number; ceiling?: number }) =>
  heightProblems(
    plainContext([
      room('a', west.map((c) => [...c]) as never),
      room('b', east.map((c) => [...c]) as never, b),
    ]),
  )

describe('heightProblems', () => {
  it('passes a room with a ceiling above its floor, however low, and under ground', () => {
    const one = (more: { floor?: number; ceiling?: number }) =>
      heightProblems(plainContext([room('a', square(0, 0, 4, 4), more)]))
    expect(one({})).toEqual([])
    expect(one({ floor: 0, ceiling: 0.01 })).toEqual([])
    expect(one({ floor: -5, ceiling: -2 })).toEqual([])
  })

  it('fails a ceiling at or below its floor, and locates the sector', () => {
    for (const ceiling of [0, -1]) {
      const [problem, ...more] = heightProblems(plainContext([room('a', square(0, 0, 4, 4), { ceiling })]))
      expect(more).toEqual([])
      expect(problem?.message).toBe(`a: the ceiling (${ceiling} m) is not above the floor (0 m)`)
      expect(problem?.locator).toEqual({ selection: 'sector:a' })
    }
  })

  it('passes a portal across a step and under a lintel, which leave an opening', () => {
    expect(joined({})).toEqual([])
    expect(joined({ floor: 0.2 })).toEqual([])
    expect(joined({ ceiling: 2.1 })).toEqual([])
    expect(joined({ floor: 2.9 })).toEqual([])
  })

  it("fails a portal whose two sides leave no opening: a floor at the neighbour's ceiling, or above it", () => {
    for (const floor of [3, 5]) {
      const [problem, ...more] = joined({ floor, ceiling: floor + 3 })
      expect(more, `floor ${floor}: once, though both rooms have the portal`).toEqual([])
      expect(problem?.message).toBe(
        `a and b: their portal at (4, 2) leaves no opening (the higher floor is ${floor} m, the lower ceiling 3 m)`,
      )
      expect(problem?.locator).toEqual({ selection: 'wall:a/1', at: { x: 4, z: 0 } })
    }
  })

  it('says it once for a portal with no reverse, and for each portal that is its own pair', () => {
    const lone = heightProblems(
      plainContext([
        room('a', west.map((c) => [...c]) as never),
        room('b', square(4, 0, 8, 4), { floor: 3, ceiling: 6 }),
      ]),
    )
    expect(lone).toHaveLength(1)
  })

  it('reports a ceiling problem and a portal problem separately, the sectors first', () => {
    const found = joined({ floor: 5, ceiling: 4 })
    expect(found.map((problem) => problem.message)).toEqual([
      'b: the ceiling (4 m) is not above the floor (5 m)',
      'a and b: their portal at (4, 2) leaves no opening (the higher floor is 5 m, the lower ceiling 3 m)',
    ])
  })
})
