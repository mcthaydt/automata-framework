import type { Blocked } from '@automata/nav/sim'
import { describe, expect, it } from 'vitest'
import { type Obstacle, withObstacles } from '#src/shared/obstacles.ts'

// A game's boxes, wrapped round the walls' answer: a segment is blocked when the walls block it or it comes within the walker's
// margin of a box.

const open: Blocked = { segment: () => false, open: (door) => door === 'front' }
const crate: Obstacle = { id: 'crate', x0: 1, z0: 1, x1: 2, z1: 2 }
const blocked = withObstacles(open, [crate])

describe('withObstacles', () => {
  it('blocks a segment through a box', () => {
    expect(blocked.segment({ x: 0, z: 1.5 }, { x: 3, z: 1.5 }, 0)).toBe(true)
  })

  it('does not block one that passes beside it by more than the margin', () => {
    expect(blocked.segment({ x: 0, z: 0.5 }, { x: 3, z: 0.5 }, 0.2)).toBe(false)
  })

  it('blocks one that passes within the margin', () => {
    expect(blocked.segment({ x: 0, z: 0.9 }, { x: 3, z: 0.9 }, 0.2)).toBe(true)
  })

  it('does not block one that stops short of it', () => {
    expect(blocked.segment({ x: 0, z: 1.5 }, { x: 0.7, z: 1.5 }, 0.2)).toBe(false)
  })

  it('keeps the walls: a segment they block stays blocked, and a door answers as it did', () => {
    const walled = withObstacles({ segment: () => true, open: () => true }, [crate])
    expect(walled.segment({ x: 5, z: 5 }, { x: 6, z: 6 }, 0)).toBe(true)
    expect(blocked.open('front')).toBe(true)
    expect(blocked.open('back')).toBe(false)
  })

  it('does not block a segment that ends on a box, or starts on one: a thing on furniture is walked up to, and a walker on it may leave', () => {
    expect(blocked.segment({ x: 0, z: 1.5 }, { x: 1.5, z: 1.5 }, 0.2)).toBe(false)
    expect(blocked.segment({ x: 1.5, z: 1.5 }, { x: 3, z: 1.5 }, 0.2)).toBe(false)
  })

  it('blocks nothing more with no boxes', () => {
    expect(withObstacles(open, []).segment({ x: 0, z: 1.5 }, { x: 3, z: 1.5 }, 0.2)).toBe(false)
  })
})
