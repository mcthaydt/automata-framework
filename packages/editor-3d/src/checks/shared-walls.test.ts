// Last Light's `sharedWalls` (scripts/pipeline/blockout-lib.ts, 92e6704) on toy rooms: two solid walls of different
// rooms on one line, facing each other, hide each other's face from every lamp.
import { describe, expect, it } from 'vitest'
import { plainContext } from '../testing/check-context'
import { room, square } from '../testing/toy-sectors'
import { sharedWallProblems } from './shared-walls'

const problems = (...rooms: ReturnType<typeof room>[]) => sharedWallProblems(plainContext(rooms))

describe('sharedWallProblems', () => {
  it("passes two rooms a wall apart, as an opening's connector leaves them", () => {
    expect(problems(room('a', square(0, 0, 4, 4)), room('b', square(4.125, 0, 8, 4)))).toEqual([])
  })

  it("fails two rooms whose walls are on one line, with Last Light's sentence, and locates both walls", () => {
    const [problem, ...more] = problems(room('a', square(0, 0, 4, 4)), room('b', square(4, 0, 8, 4)))
    expect(more).toEqual([])
    expect(problem?.message).toBe(
      "a and b share a solid wall line from (4, 0) for 4.00 m: stand them apart with an opening's connector",
    )
    expect(problem?.locator).toEqual({ selection: 'wall:a/1', at: { x: 4, z: 0 } })
    expect(problem?.related).toEqual([{ selection: 'wall:b/3', at: { x: 4, z: 4 } }])
  })

  it('counts the length they share, and lets a shared line of 1 cm or less pass', () => {
    expect(
      problems(room('a', square(0, 0, 4, 4)), room('b', square(4, 3.98, 8, 8))).map((p) => p.message),
    ).toEqual([
      "a and b share a solid wall line from (4, 0) for 0.02 m: stand them apart with an opening's connector",
    ])
    expect(problems(room('a', square(0, 0, 4, 4)), room('b', square(4, 3.995, 8, 8)))).toEqual([])
  })

  it('takes walls within a millimetre of each other as one line, and walls 2 mm apart as two', () => {
    expect(problems(room('a', square(0, 0, 4, 4)), room('b', square(4.0005, 0, 8, 4)))).toHaveLength(1)
    expect(problems(room('a', square(0, 0, 4, 4)), room('b', square(4.002, 0, 8, 4)))).toEqual([])
  })

  it("does not compare a room with itself: a hole's wall may stand on the outer wall's line", () => {
    expect(problems(room('a', square(0, 0, 4, 4), { holes: [square(3, 1, 4, 3)] }))).toEqual([])
  })

  it('passes walls that are not opposed: at an angle', () => {
    expect(
      problems(
        room('a', square(0, 0, 4, 4)),
        room('b', [
          [4, 0],
          [8, 0],
          [8, 4],
        ]),
      ),
    ).toEqual([])
  })

  it('passes two rooms that only touch at a corner', () => {
    expect(problems(room('a', square(0, 0, 4, 4)), room('b', square(4, 4, 8, 8)))).toEqual([])
  })

  it('leaves portals alone: they are not solid', () => {
    const a = room('a', [
      [0, 0],
      [4, 0, { next: 'b' }],
      [4, 4],
      [0, 4],
    ])
    const b = room('b', [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4, { next: 'a' }],
    ])
    expect(problems(a, b)).toEqual([])
  })

  it('lists each pair once, in the order Last Light walks the walls', () => {
    const found = problems(
      room('a', square(0, 0, 4, 4)),
      room('b', square(4, 0, 8, 4)),
      room('c', square(0, 4, 4, 8)),
    ).map((p) => p.message)
    expect(found).toEqual([
      "a and b share a solid wall line from (4, 0) for 4.00 m: stand them apart with an opening's connector",
      "a and c share a solid wall line from (4, 4) for 4.00 m: stand them apart with an opening's connector",
    ])
  })
})
