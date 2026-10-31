// Where the loupe and the nudge pad go (ED3D.6g-b step 2; ED3D spec §10: clear of the contact point and of the screen
// edge). A 800 by 600 canvas; the lens is 140 px, the pad 148 px.
import { describe, expect, it } from 'vitest'
import { loupePlace, nudgePlace } from './loupe-place'

const CANVAS = { w: 800, h: 600 }
const inside = (box: { x: number; y: number }, size: number) =>
  box.x >= 0 && box.y >= 0 && box.x + size <= CANVAS.w && box.y + size <= CANVAS.h
const covers = (box: { x: number; y: number }, size: number, at: { x: number; y: number }) =>
  at.x >= box.x && at.x <= box.x + size && at.y >= box.y && at.y <= box.y + size

describe('loupePlace', () => {
  it('puts the lens above and right of the point, a finger clear of it', () => {
    expect(loupePlace({ x: 300, y: 300 }, CANVAS)).toEqual({ x: 356, y: 104 })
  })

  it('flips left near the right edge and below near the top, staying on the canvas and off the point', () => {
    for (const at of [
      { x: 780, y: 300 },
      { x: 300, y: 20 },
      { x: 790, y: 10 },
      { x: 10, y: 590 },
    ]) {
      const box = loupePlace(at, CANVAS)
      expect(inside(box, 140), JSON.stringify(at)).toBe(true)
      expect(covers(box, 140, at), JSON.stringify(at)).toBe(false)
    }
    expect(loupePlace({ x: 780, y: 300 }, CANVAS)).toEqual({ x: 584, y: 104 })
    expect(loupePlace({ x: 300, y: 20 }, CANVAS)).toEqual({ x: 356, y: 76 })
  })
})

describe('nudgePlace', () => {
  it('puts the pad in the bottom-right corner', () => {
    expect(nudgePlace(undefined, CANVAS)).toEqual({ x: 640, y: 440 })
    expect(nudgePlace({ x: 100, y: 100 }, CANVAS)).toEqual({ x: 640, y: 440 })
  })

  it('moves it to the bottom-left when the point is under it or within a finger of it', () => {
    expect(nudgePlace({ x: 700, y: 500 }, CANVAS)).toEqual({ x: 12, y: 440 })
    expect(nudgePlace({ x: 625, y: 430 }, CANVAS)).toEqual({ x: 12, y: 440 })
  })
})
