import { describe, expect, it } from 'vitest'
import { blockedWith, crossingThrough, THROUGH } from '#src/shared/places.ts'

describe('blockedWith', () => {
  it('asks the wall test for the segment and the doors for a door', () => {
    const calls: unknown[] = []
    const blocked = blockedWith(
      (a, b, margin) => {
        calls.push([a, b, margin])
        return true
      },
      { gate: true, hatch: false },
    )
    expect(blocked.segment({ x: 0, z: 0 }, { x: 1, z: 1 }, 0.2)).toBe(true)
    expect(calls).toEqual([[{ x: 0, z: 0 }, { x: 1, z: 1 }, 0.2]])
    expect(blocked.open('gate')).toBe(true)
    expect(blocked.open('hatch')).toBe(false)
    expect(blocked.open('missing')).toBe(false)
  })
})

describe('crossingThrough', () => {
  it('goes THROUGH metres past the middle, against the normal that points into the room being left', () => {
    expect(THROUGH).toBe(0.5)
    // An edge on x = 4 whose normal points to -x (into the room on the left): the far room is at +x.
    expect(crossingThrough({ x: 4, z: 2 }, { x: -1, z: 0 })).toEqual({
      x: 4,
      z: 2,
      into: { x: 4.5, z: 2 },
    })
    expect(crossingThrough({ x: 1, z: 1 }, { x: 0, z: 1 }).into).toEqual({ x: 1, z: 0.5 })
  })
})
