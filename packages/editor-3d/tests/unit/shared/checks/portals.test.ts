// Last Light's `portals` (scripts/pipeline/blockout-lib.ts, 92e6704): every portal has its reverse over exactly the
// same segment.
import { describe, expect, it } from 'vitest'
import { portalProblems } from '#src/shared/checks/portals.ts'
import { plainContext } from '#src/testing/check-context.ts'
import { room, square } from '#src/testing/toy-sectors.ts'

const west = square(0, 0, 4, 4)
/** `a`'s east wall is a portal into `b`. */
const a = room('a', [
  [0, 0],
  [4, 0, { next: 'b' }],
  [4, 4],
  [0, 4],
])
const problems = (...rooms: ReturnType<typeof room>[]) => portalProblems(plainContext(rooms))

describe('portalProblems', () => {
  it('passes a portal with its reverse over the same segment', () => {
    const b = room('b', [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4, { next: 'a' }],
    ])
    expect(problems(a, b)).toEqual([])
    expect(problems(room('a', west), room('b', square(4.125, 0, 8, 4)))).toEqual([])
  })

  it("fails a one-sided portal, with Last Light's sentence and the portal's wall", () => {
    const [problem, ...more] = problems(a, room('b', square(4, 0, 8, 4)))
    expect(more).toEqual([])
    expect(problem?.message).toBe('a → b from (4, 0) to (4, 4) has no matching portal back')
    expect(problem?.locator).toEqual({ selection: 'wall:a/1', at: { x: 4, z: 0 } })
  })

  it('fails a reverse over a different segment, once for each of the two portals', () => {
    const half = room('b', [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4, { next: 'a' }],
      [4, 2],
    ])
    expect(problems(a, half).map((problem) => problem.message)).toEqual([
      'a → b from (4, 0) to (4, 4) has no matching portal back',
      'b → a from (4, 4) to (4, 2) has no matching portal back',
    ])
  })

  it('matches ends to a micrometre and no further', () => {
    const near = (z: number) =>
      room('b', [
        [4, 0],
        [8, 0],
        [8, 4],
        [4, z, { next: 'a' }],
      ])
    expect(problems(a, near(4.0000005))).toEqual([])
    expect(problems(a, near(4.000005))).toHaveLength(2)
  })

  it('matches a portal to the reverse that points back at it, not at some other room', () => {
    const b = room('b', [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4, { next: 'c' }],
    ])
    const c = room('c', square(20, 0, 24, 4))
    expect(problems(a, b, c).map((problem) => problem.message)).toEqual([
      'a → b from (4, 0) to (4, 4) has no matching portal back',
      'b → c from (4, 4) to (4, 0) has no matching portal back',
    ])
  })

  it('has nothing to say about a level with no portals', () => {
    expect(problems(room('a', west), room('b', square(10, 0, 14, 4)))).toEqual([])
  })
})
