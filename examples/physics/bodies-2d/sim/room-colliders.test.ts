import { parseRoom, ROOM } from '@af-examples/base-2d'
import { describe, expect, it } from 'vitest'
import { roomColliders } from './room-colliders.ts'

describe('roomColliders', () => {
  it('makes one rectangle per horizontal run of solid tiles in base-2d’s room', () => {
    const walls = roomColliders(parseRoom(ROOM))
    // Hand count: the ceiling and the floor (1 each), the side walls in the 22 rows between (2 each), and the
    // ten platforms (row 14 has two).
    expect(walls).toHaveLength(1 + 1 + 22 * 2 + 10)
    // Metres, y up: 16 px a metre, so the 320 × 192 px room is 20 × 12 m and a tile is half a metre.
    expect(walls.slice(0, 3)).toEqual([
      { x: 10, y: 11.75, hx: 10, hy: 0.25 }, // the ceiling, all 40 tiles of row 0
      { x: 0.25, y: 11.25, hx: 0.25, hy: 0.25 }, // row 1, the left wall
      { x: 19.75, y: 11.25, hx: 0.25, hy: 0.25 }, // row 1, the right wall
    ])
  })

  it('merges a run into one rectangle however long it is', () => {
    const walls = roomColliders({
      tileSize: 8,
      width: 4,
      height: 2,
      rows: ['.##.', '####'],
      start: { tx: 0, ty: 0 },
      goal: { tx: 3, ty: 0 },
    })
    expect(walls).toEqual([
      { x: 1, y: 0.75, hx: 0.5, hy: 0.25 },
      { x: 1, y: 0.25, hx: 1, hy: 0.25 },
    ])
  })
})
