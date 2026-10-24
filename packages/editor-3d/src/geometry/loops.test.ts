import { describe, expect, it } from 'vitest'
import { crossesItself, insideLoop, insideOutline, loopArea, outlineProblem, segmentsTouch } from './loops'

const square = [
  [0, 0],
  [2, 0],
  [2, 2],
  [0, 2],
] as const
// An L: the notch is the square from (1, 1) to (2, 2).
const ell = [
  [0, 0],
  [2, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
] as const

describe('loopArea', () => {
  it('is positive for a loop that runs counter-clockwise on the plan and negative for the reverse', () => {
    expect(loopArea(square)).toBe(4)
    expect(loopArea([...square].reverse())).toBe(-4)
    expect(
      loopArea([
        [0, 0],
        [1, 0],
        [0, 1],
      ]),
    ).toBe(0.5)
    expect(loopArea(ell)).toBe(3)
  })

  it('reads only the first two members of a corner, whatever follows', () => {
    expect(
      loopArea([
        [0, 0, { next: 'a' }],
        [2, 0],
        [2, 2, 'west'],
        [0, 2],
      ]),
    ).toBe(4)
  })
})

describe('insideLoop and insideOutline', () => {
  it('tells inside from outside, for a convex and for a concave loop', () => {
    expect(insideLoop(1, 1, square)).toBe(true)
    expect(insideLoop(3, 1, square)).toBe(false)
    expect(insideLoop(0.5, 1.5, ell)).toBe(true)
    expect(insideLoop(1.5, 1.5, ell)).toBe(false)
  })

  it('leaves a hole out of the outline', () => {
    const hole = [
      [0.5, 0.5],
      [1.5, 0.5],
      [1.5, 1.5],
      [0.5, 1.5],
    ] as const
    expect(insideOutline(0.25, 0.25, square, [hole])).toBe(true)
    expect(insideOutline(1, 1, square, [hole])).toBe(false)
    expect(insideOutline(1, 1, square)).toBe(true)
    expect(insideOutline(1, 1, square, undefined)).toBe(true)
  })
})

describe('segmentsTouch', () => {
  it('is true for a crossing, for an end resting on the other segment and for an overlap', () => {
    expect(segmentsTouch([0, 0], [2, 2], [0, 2], [2, 0])).toBe(true)
    expect(segmentsTouch([0, 0], [2, 0], [1, 0], [1, 2])).toBe(true)
    expect(segmentsTouch([0, 0], [2, 0], [1, 0], [3, 0])).toBe(true)
    expect(segmentsTouch([0, 0], [2, 0], [2, 0], [2, 2])).toBe(true)
  })

  it('is false for segments apart, on one line or not, and for a line that would cross if it went on', () => {
    expect(segmentsTouch([0, 0], [1, 0], [2, 0], [3, 0])).toBe(false)
    expect(segmentsTouch([0, 0], [2, 0], [0, 1], [2, 1])).toBe(false)
    expect(segmentsTouch([0, 0], [1, 1], [3, 0], [0, 3])).toBe(false)
  })
})

describe('crossesItself', () => {
  it('is false for a convex loop, a concave one and a loop with a straight-through corner', () => {
    expect(crossesItself(square)).toBe(false)
    expect(crossesItself(ell)).toBe(false)
    expect(
      crossesItself([
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    ).toBe(false)
  })

  it('is true for a bow tie', () => {
    expect(
      crossesItself([
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 2],
      ]),
    ).toBe(true)
  })

  it('is true when a corner rests on a wall that is not its neighbour', () => {
    expect(
      crossesItself([
        [0, 0],
        [4, 0],
        [4, 4],
        [2, 0],
        [0, 4],
      ]),
    ).toBe(true)
  })

  it('is true when a wall folds back over the one before it', () => {
    expect(
      crossesItself([
        [0, 0],
        [2, 0],
        [1, 0],
        [1, 2],
      ]),
    ).toBe(true)
  })

  it('is true when the closing wall crosses the first', () => {
    expect(
      crossesItself([
        [0, 0],
        [2, 0],
        [2, 2],
        [1, -1],
      ]),
    ).toBe(true)
  })
})

describe('outlineProblem', () => {
  it('has nothing to say about a loop that is fine, drawn either way round', () => {
    expect(outlineProblem(square)).toBeUndefined()
    expect(outlineProblem([...square].reverse())).toBeUndefined()
    expect(outlineProblem(ell)).toBeUndefined()
  })

  it('says a sector needs at least three corners (ED3-m)', () => {
    expect(outlineProblem([])).toBe('a sector needs at least three corners')
    expect(
      outlineProblem([
        [0, 0],
        [1, 1],
      ]),
    ).toBe('a sector needs at least three corners')
  })

  it('names a repeated corner, a loop with no area and a loop that crosses itself', () => {
    expect(
      outlineProblem([
        [0, 0],
        [2, 0],
        [2, 0],
        [0, 2],
      ]),
    ).toBe('corners 1 and 2 are the same point')
    expect(
      outlineProblem([
        [0, 0],
        [2, 0],
        [0, 2],
        [0, 0],
      ]),
    ).toBe('corners 3 and 0 are the same point')
    expect(
      outlineProblem([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toBe('the outline has no area')
    expect(
      outlineProblem([
        [0, 0],
        [2, 2],
        [2, 0],
        [0, 2],
      ]),
    ).toBe('the outline crosses itself')
  })

  it('refuses a coordinate that is not a finite number', () => {
    expect(
      outlineProblem([
        [0, 0],
        [Number.NaN, 0],
        [2, 2],
      ]),
    ).toBe('corner 1 is not a point')
    expect(
      outlineProblem([
        [0, 0],
        [1, Number.POSITIVE_INFINITY],
        [2, 2],
      ]),
    ).toBe('corner 1 is not a point')
  })
})
