import { describe, expect, test } from 'vitest'
import {
  autoScrollSpeed,
  moveRow,
  nearestUnlocked,
  previewOffsets,
  rowOffsets,
  stepTarget,
  targetIndex,
} from '#src/shared/kit/widgets/reorder-model.ts'

const rows = (heights: number[], lockedAt: number[] = []) =>
  heights.map((height, index) => ({ height, locked: lockedAt.includes(index) }))

describe('nearestUnlocked', () => {
  test('an unlocked place is its own nearest', () => {
    expect(nearestUnlocked([false, true, false], 2, 0)).toBe(2)
  })

  test('a locked place moves to the nearest unlocked one', () => {
    expect(nearestUnlocked([false, false, true, true, false], 3, 0)).toBe(4)
    expect(nearestUnlocked([false, false, true, true, false], 2, 4)).toBe(1)
  })

  test('a tie goes to the side the row came from, so it moves less', () => {
    expect(nearestUnlocked([false, true, false], 1, 0)).toBe(0)
    expect(nearestUnlocked([false, true, false], 1, 2)).toBe(2)
  })

  test('everything locked: the row stays where it is', () => {
    expect(nearestUnlocked([true, true, true], 1, 1)).toBe(1)
  })
})

describe('targetIndex', () => {
  const list = rows([40, 40, 40, 40])

  test('is the row under the pointer', () => {
    expect(targetIndex(list, 5, 0)).toBe(0)
    expect(targetIndex(list, 45, 0)).toBe(1)
    expect(targetIndex(list, 119, 0)).toBe(2)
    expect(targetIndex(list, 120, 0)).toBe(3)
  })

  test('above the list is the first place and below it is the last', () => {
    expect(targetIndex(list, -30, 2)).toBe(0)
    expect(targetIndex(list, 900, 1)).toBe(3)
  })

  test('rows of different heights are measured, not counted', () => {
    expect(targetIndex(rows([20, 100, 20]), 110, 0)).toBe(1)
    expect(targetIndex(rows([20, 100, 20]), 125, 0)).toBe(2)
  })

  test('over a locked row it lands in the nearest unlocked place', () => {
    const locked = rows([40, 40, 40, 40], [1])
    expect(targetIndex(locked, 50, 0)).toBe(0)
    expect(targetIndex(locked, 50, 3)).toBe(2)
  })
})

describe('moveRow', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']
  const none = () => false

  test('moves a row down or up and shifts the ones between', () => {
    expect(moveRow(ids, none, 0, 2)).toEqual(['b', 'c', 'a', 'd', 'e'])
    expect(moveRow(ids, none, 4, 1)).toEqual(['a', 'e', 'b', 'c', 'd'])
  })

  test('to the same place changes nothing', () => {
    expect(moveRow(ids, none, 2, 2)).toEqual(ids)
  })

  test('does not change the input', () => {
    const copy = [...ids]
    moveRow(copy, none, 0, 4)
    expect(copy).toEqual(ids)
  })

  test('locked rows keep their places while the others move around them', () => {
    const lockedB = (id: string) => id === 'b'
    expect(moveRow(ids, lockedB, 0, 2)).toEqual(['c', 'b', 'a', 'd', 'e'])
    expect(moveRow(ids, lockedB, 3, 0)).toEqual(['d', 'b', 'a', 'c', 'e'])
  })

  test('the moved row ends at the place it was sent to', () => {
    const locked = (id: string) => id === 'b' || id === 'd'
    const moved = moveRow(ids, locked, 0, 4)
    expect(moved.indexOf('a')).toBe(4)
    expect(moved[1]).toBe('b')
    expect(moved[3]).toBe('d')
  })

  test('a locked row cannot be the one that moves', () => {
    expect(moveRow(ids, (id) => id === 'a', 0, 3)).toEqual(ids)
  })
})

describe('stepTarget', () => {
  test('is the next place in that direction', () => {
    expect(stepTarget([false, false, false], 1, 1)).toBe(2)
    expect(stepTarget([false, false, false], 1, -1)).toBe(0)
  })

  test('skips locked places', () => {
    expect(stepTarget([false, true, true, false], 0, 1)).toBe(3)
    expect(stepTarget([false, true, false], 2, -1)).toBe(0)
  })

  test('clamps at the ends and before a run of locked rows', () => {
    expect(stepTarget([false, false], 1, 1)).toBe(1)
    expect(stepTarget([false, false], 0, -1)).toBe(0)
    expect(stepTarget([false, true, true], 0, 1)).toBe(0)
  })
})

describe('autoScrollSpeed', () => {
  test('is zero in the middle of the scrolling area', () => {
    expect(autoScrollSpeed(300, 100, 500)).toBe(0)
  })

  test('is negative near the top, growing the closer the pointer is to the edge', () => {
    const far = autoScrollSpeed(140, 100, 500, { edge: 48, maxSpeed: 20 })
    const near = autoScrollSpeed(110, 100, 500, { edge: 48, maxSpeed: 20 })
    expect(far).toBeLessThan(0)
    expect(near).toBeLessThan(far)
  })

  test('is positive near the bottom', () => {
    expect(autoScrollSpeed(490, 100, 500)).toBeGreaterThan(0)
  })

  test('is the maximum at the edge and beyond it', () => {
    expect(autoScrollSpeed(100, 100, 500, { edge: 48, maxSpeed: 20 })).toBe(-20)
    expect(autoScrollSpeed(-50, 100, 500, { edge: 48, maxSpeed: 20 })).toBe(-20)
    expect(autoScrollSpeed(500, 100, 500, { edge: 48, maxSpeed: 20 })).toBe(20)
    expect(autoScrollSpeed(900, 100, 500, { edge: 48, maxSpeed: 20 })).toBe(20)
  })

  test('is zero just outside the edge zone', () => {
    expect(autoScrollSpeed(148, 100, 500, { edge: 48 })).toBe(0)
    expect(autoScrollSpeed(452, 100, 500, { edge: 48 })).toBe(0)
  })

  test('in an area too short for two zones, the nearer edge wins', () => {
    expect(autoScrollSpeed(105, 100, 160, { edge: 48 })).toBeLessThan(0)
    expect(autoScrollSpeed(155, 100, 160, { edge: 48 })).toBeGreaterThan(0)
  })
})

describe('rowOffsets', () => {
  test('is how far each row moves from where it was, by original index', () => {
    // [a b c] heights 10, 20, 30; a goes to the end: order b, c, a.
    expect(rowOffsets([10, 20, 30], [1, 2, 0])).toEqual([50, -10, -10])
  })

  test('no change, no offsets', () => {
    expect(rowOffsets([10, 20, 30], [0, 1, 2])).toEqual([0, 0, 0])
  })
})

describe('previewOffsets', () => {
  test('shifts the rows between the lifted one and its target to make room', () => {
    const shapes = [10, 20, 30].map((height) => ({ height, locked: false }))
    // Row 0 moves to place 2: rows 1 and 2 rise by its height, and it falls by theirs.
    expect(previewOffsets(shapes, 0, 2)).toEqual([50, -10, -10])
  })

  test('leaves a locked row where it is', () => {
    const shapes = [
      { height: 10, locked: false },
      { height: 10, locked: true },
      { height: 10, locked: false },
    ]
    expect(previewOffsets(shapes, 0, 2)).toEqual([20, 0, -20])
  })
})
