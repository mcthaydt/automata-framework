// Turning a wall or a loop round (ED3D.6e): when two sectors are joined, one that was written the other way round is
// turned round so that its walls run the way the other's do. A wall keeps what it says; what has a place along it is
// measured from its new start.
import { describe, expect, it } from 'vitest'
import type { EditCorner, EditWall } from '../profile/sector-access'
import { reversedLoop, reversedWall } from './wall-geometry'

describe('reversedWall', () => {
  it('measures a door and a window from the other end of the wall', () => {
    expect(reversedWall({ door: { at: 2, width: 1, height: 2 } }, 8)).toEqual({
      door: { at: 6, width: 1, height: 2 },
    })
    expect(reversedWall({ window: { at: 1.5, width: 1, y0: 1, y1: 2 } }, 8)).toEqual({
      window: { at: 6.5, width: 1, y0: 1, y1: 2 },
    })
  })

  it('writes the new place to four decimals, as the codec writes a number', () => {
    // 7.3 - 2.1 is 5.199999999999999 in floating point.
    expect(reversedWall({ window: { at: 2.1, width: 1, y0: 1, y1: 2 } }, 7.3)).toEqual({
      window: { at: 5.2, width: 1, y0: 1, y1: 2 },
    })
    expect(reversedWall({ door: { at: 2.1, width: 1, height: 2 } }, 7.3)).toEqual({
      door: { at: 5.2, width: 1, height: 2 },
    })
    expect(reversedWall({ next: 'dock', hatch: [1.5, 2.1] }, 7.3)).toEqual({
      next: 'dock',
      hatch: [5.2, 5.8],
    })
  })

  it('swaps the two ends of a hatch, measured from the other end', () => {
    expect(reversedWall({ next: 'dock', hatch: [1, 3] }, 8)).toEqual({ next: 'dock', hatch: [5, 7] })
  })

  it('swaps the start and the end of a pilaster, and keeps one that has only one', () => {
    expect(reversedWall({ pilaster: { start: [0.2, 0.1], end: [0.3, 0.2] } }, 8)).toEqual({
      pilaster: { start: [0.3, 0.2], end: [0.2, 0.1] },
    })
    const onlyStart = reversedWall({ pilaster: { start: [0.2, 0.1] } }, 8) as EditWall
    expect(onlyStart).toEqual({ pilaster: { end: [0.2, 0.1] } })
    expect(Object.keys(onlyStart.pilaster ?? {})).toEqual(['end'])
  })

  it('leaves everything with no place along the wall as it is', () => {
    const wall: EditWall = {
      texture: 'brick',
      thick: 0.3,
      occlude: 'fade',
      trim: { skirting: 0.2 },
      pan: [1, 2],
      cut: 'north',
    }
    expect(reversedWall(wall, 8)).toEqual(wall)
  })

  it('hands back the same wall when nothing has a place along it, and a name or nothing as they are', () => {
    const wall: EditWall = { texture: 'brick' }
    expect(reversedWall(wall, 8)).toBe(wall)
    expect(reversedWall('north', 8)).toBe('north')
    expect(reversedWall(undefined, 8)).toBeUndefined()
  })

  it('writes places to four decimals', () => {
    expect(reversedWall({ door: { at: 2.1111, width: 1, height: 2 } }, 7.3333)).toEqual({
      door: { at: 5.2222, width: 1, height: 2 },
    })
  })

  it('does not change the wall it is given', () => {
    const wall: EditWall = { door: { at: 2, width: 1, height: 2 }, pilaster: { start: [1, 1] } }
    const before = structuredClone(wall)
    reversedWall(wall, 8)
    expect(wall).toEqual(before)
  })
})

describe('reversedLoop', () => {
  const square = (walls: readonly (string | EditWall | undefined)[]): EditCorner[] => [
    [0, 0, walls[0]] as EditCorner,
    [8, 0, walls[1]] as EditCorner,
    [8, 6, walls[2]] as EditCorner,
    [0, 6, walls[3]] as EditCorner,
  ]

  it('goes round the other way from the first corner, each wall now starting at the corner that ends it', () => {
    const turned = reversedLoop(
      square([{ texture: 'a' }, { texture: 'b' }, { texture: 'c' }, { texture: 'd' }]),
    )
    expect(turned).toEqual([
      [0, 0, { texture: 'd' }],
      [0, 6, { texture: 'c' }],
      [8, 6, { texture: 'b' }],
      [8, 0, { texture: 'a' }],
    ])
  })

  it('turns each wall round by its own length', () => {
    const turned = reversedLoop(
      square([{ door: { at: 2, width: 1, height: 2 } }, undefined, undefined, undefined]),
    )
    // The 8 m north wall is now the last one, from (8, 0) back to (0, 0).
    expect(turned[3]).toEqual([8, 0, { door: { at: 6, width: 1, height: 2 } }])
    const west = reversedLoop(
      square([undefined, undefined, undefined, { window: { at: 1, width: 1, y0: 1, y1: 2 } }]),
    )
    // The 6 m west wall is the first one now, from (0, 0) to (0, 6).
    expect(west[0]).toEqual([0, 0, { window: { at: 5, width: 1, y0: 1, y1: 2 } }])
  })

  it('keeps a bare corner bare and a name a name', () => {
    const turned = reversedLoop(square([undefined, 'east', undefined, undefined]))
    expect(turned).toEqual([
      [0, 0],
      [0, 6],
      [8, 6, 'east'],
      [8, 0],
    ])
    expect(turned[0]).toHaveLength(2)
  })

  it('is the loop it began as when turned twice', () => {
    const loop = square([
      { door: { at: 2.5, width: 1, height: 2 } },
      'east',
      { hatch: [1, 2] },
      { pilaster: { end: [1, 1] } },
    ])
    expect(reversedLoop(reversedLoop(loop))).toEqual(loop)
  })

  it('turns a triangle', () => {
    const loop: EditCorner[] = [
      [0, 0, { texture: 'a' }],
      [4, 0, { texture: 'b' }],
      [0, 3, { texture: 'c' }],
    ]
    expect(reversedLoop(loop)).toEqual([
      [0, 0, { texture: 'c' }],
      [0, 3, { texture: 'b' }],
      [4, 0, { texture: 'a' }],
    ])
  })
})
