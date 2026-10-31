// The lock's selection math (DESIGN.md §11.1, cases G3-e and G3-h): pure functions, so no sim is made.
import { describe, expect, it } from 'vitest'
import { LOCK_RANGE, metres } from '../constants.ts'
import { cycleLock, lineOfSight, lockCandidates, selectLock } from './lock-target.ts'

const ORIGIN = { x: 0, z: 0 }
const at = (id: number, x: number, z: number) => ({ id, x: metres(x), z: metres(z) })
const wall = (minX: number, minZ: number, maxX: number, maxZ: number) => ({
  minX: metres(minX),
  minZ: metres(minZ),
  maxX: metres(maxX),
  maxZ: metres(maxZ),
})
/** Turn units: 0 toward +z, 16,384 toward +x. */
const TOWARD_X = 16_384

describe('lineOfSight', () => {
  it('is clear with no wall between and blocked by a wall across the line', () => {
    expect(lineOfSight([wall(2, 4, 3, 5)], ORIGIN, at(0, 0, 10))).toBe(true)
    expect(lineOfSight([wall(-1, 4, 1, 5)], ORIGIN, at(0, 0, 10))).toBe(false)
  })

  it('is blocked by a wall across a diagonal line and clear past its corner', () => {
    expect(lineOfSight([wall(4, 4, 6, 6)], ORIGIN, at(0, 10, 10))).toBe(false)
    expect(lineOfSight([wall(4, 6, 5, 7)], ORIGIN, at(0, 10, 10))).toBe(true)
  })

  it('stays clear along a wall’s face and when touching only its corner', () => {
    expect(lineOfSight([wall(1, 4, 2, 5)], at(0, 1, 0), at(0, 1, 10))).toBe(true)
    expect(lineOfSight([wall(5, 5, 6, 6)], ORIGIN, at(0, 5, 5))).toBe(true)
  })

  it('is clear for a wall wholly behind either end', () => {
    expect(lineOfSight([wall(-1, -5, 1, -4)], ORIGIN, at(0, 0, 10))).toBe(true)
    expect(lineOfSight([wall(-1, 11, 1, 12)], ORIGIN, at(0, 0, 10))).toBe(true)
  })
})

describe('lockCandidates', () => {
  it('keeps targets within 12 m with a clear line, in id order', () => {
    const edge = { id: 2, x: LOCK_RANGE, z: 0 }
    const beyond = { id: 1, x: 0, z: LOCK_RANGE + 1 }
    const hidden = at(3, 0, -6)
    const seen = at(4, -3, 3)
    const candidates = lockCandidates([wall(-1, -4, 1, -3)], ORIGIN, [seen, hidden, beyond, edge])
    expect(candidates.map((point) => point.id)).toEqual([2, 4])
  })
})

describe('selectLock (G3-e)', () => {
  it('picks the smallest angle rank × 4 + distance rank inside the cone', () => {
    // Ahead and far (angle rank 0, distance rank 1: 1) beats nearer but off-axis (1, 0: 4).
    expect(selectLock([at(3, 2, 4), at(5, 0, 8)], ORIGIN, 0)).toBe(5)
  })

  it('lets a much nearer target win when the angles rank the other way only once', () => {
    // A: angle rank 1, distance rank 0 (4). B: angle 0, distance 2 (2). C: angle 2, distance 1 (9).
    expect(selectLock([at(1, 1, 2), at(2, 0, 9), at(3, -3, 4)], ORIGIN, 0)).toBe(2)
  })

  it('breaks a tie by the lower id', () => {
    expect(selectLock([at(7, 2, 6), at(4, -2, 6)], ORIGIN, 0)).toBe(4)
  })

  it('measures the cone around the heading, not the facing', () => {
    expect(selectLock([at(1, 0, 8), at(2, 8, 0)], ORIGIN, TOWARD_X)).toBe(2)
  })

  it('leaves out targets past 60° from the heading', () => {
    // 7 m away, past the 6 m fallback: 59° off is inside the cone, 61° off is not.
    const deg = (angle: number) => (angle * Math.PI) / 180
    const off = (id: number, angle: number) => at(id, 7 * Math.sin(deg(angle)), 7 * Math.cos(deg(angle)))
    expect(selectLock([off(1, 59)], ORIGIN, 0)).toBe(1)
    expect(selectLock([off(1, -59)], ORIGIN, 0)).toBe(1)
    expect(selectLock([off(1, 61)], ORIGIN, 0)).toBe(0)
    // Inside the cone wins however far; a nearer one behind does not.
    expect(selectLock([at(2, 1.75, -0.97), off(1, 30)], ORIGIN, 0)).toBe(1)
  })

  it('takes the nearest within 6 m in any direction when the cone is empty', () => {
    expect(selectLock([at(9, 5, 0), at(10, 0, -4)], ORIGIN, 0)).toBe(10)
    expect(selectLock([at(9, 4, 0), at(10, -4, 0)], ORIGIN, 0)).toBe(9)
  })

  it('selects none when the cone is empty and nothing is within 6 m', () => {
    expect(selectLock([at(9, 7, 0)], ORIGIN, 0)).toBe(0)
    expect(selectLock([], ORIGIN, 0)).toBe(0)
  })
})

describe('cycleLock (G3-h)', () => {
  // Around Wick at the origin: 1 toward +z (0), 2 toward +x (16,384), 3 toward −z, 4 toward −x.
  const ring = [at(1, 0, 5), at(2, 5, 0), at(3, 0, -5), at(4, -5, 0)]
  const of = (id: number | undefined) => ring.find((point) => point.id === id) ?? at(0, 0, 0)

  it('visits every candidate once clockwise (decreasing turn units) and wraps', () => {
    const visited = [1]
    for (let i = 0; i < 4; i++) visited.push(cycleLock(ring, ORIGIN, of(visited[visited.length - 1]), 1))
    expect(visited).toEqual([1, 4, 3, 2, 1])
  })

  it('visits them anticlockwise with dir −1', () => {
    const visited = [1]
    for (let i = 0; i < 4; i++) visited.push(cycleLock(ring, ORIGIN, of(visited[visited.length - 1]), -1))
    expect(visited).toEqual([1, 2, 3, 4, 1])
  })

  it('keeps the only candidate, and breaks a same-angle tie by the lower id', () => {
    expect(cycleLock([at(1, 0, 5)], ORIGIN, at(1, 0, 5), 1)).toBe(1)
    expect(cycleLock([at(1, 0, 5), at(6, 5, 0), at(5, 8, 0)], ORIGIN, at(1, 0, 5), -1)).toBe(5)
  })

  it('moves on from a target that is no longer a candidate, and selects none from no candidates', () => {
    expect(cycleLock(ring.slice(1), ORIGIN, of(1), 1)).toBe(4)
    expect(cycleLock([], ORIGIN, of(1), 1)).toBe(0)
  })
})
