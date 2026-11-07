// Views lean into their motion (M6.1a step 2), from the arcade source's cases: each skews toward its sideways velocity on its own
// spring, drawn on whole steps, never past a quarter over the cap.
import { describe, expect, it } from 'vitest'
import { LeanBook, type LeanTuning, leanTarget } from './lean'

const DEG = Math.PI / 180
const TUNING: LeanTuning = { maxDeg: 12, fullSpeed: 356, stepDeg: 3, spring: { f: 3, zeta: 0.6, r: 0 } }
const move = (book: LeanBook, vx: number, n: number, tuning = TUNING, frozen?: ReadonlySet<number>) => {
  for (let i = 0; i < n; i += 1) book.update([{ id: 1, vx }], 1 / 60, tuning, frozen)
}

describe('lean', () => {
  it('leans with the motion, up to the cap', () => {
    // A negative skew.x leans the top of the sprite to the right.
    expect(leanTarget(356, TUNING)).toBeCloseTo(-12 * DEG, 6)
    expect(leanTarget(-356, TUNING)).toBeCloseTo(12 * DEG, 6)
    expect(leanTarget(178, TUNING)).toBeCloseTo(-6 * DEG, 6)
    expect(leanTarget(5000, TUNING)).toBeCloseTo(-12 * DEG, 6)
  })
  it('draws on whole lean steps, and comes back upright when the view stops', () => {
    const book = new LeanBook()
    move(book, 356, 60)
    expect(Math.abs(book.drawnOf(1) / (3 * DEG)) % 1).toBeCloseTo(0, 6)
    expect(book.drawnOf(1)).toBeLessThan(0)
    move(book, 0, 180)
    expect(book.drawnOf(1)).toBe(0)
  })
  it('swings through upright to the far side on a turn', () => {
    const book = new LeanBook()
    move(book, 356, 60)
    const drawn: number[] = []
    for (let i = 0; i < 60; i += 1) {
      move(book, -356, 1)
      drawn.push(book.drawnOf(1))
    }
    expect(Math.max(...drawn)).toBeGreaterThan(12 * DEG - 1e-9)
  })
  it('a mashed turn stays within the cap, however low the damping is tuned', () => {
    const loose = { ...TUNING, spring: { f: 6, zeta: 0.05, r: 2 } }
    const book = new LeanBook()
    for (let i = 0; i < 240; i += 1) {
      move(book, i % 30 < 15 ? 356 : -356, 1, loose)
      expect(Math.abs(book.drawnOf(1))).toBeLessThanOrEqual(12 * 1.25 * DEG + 1e-9)
    }
  })
  it('holds a frozen view’s lean, and settles everyone upright at once', () => {
    const book = new LeanBook()
    move(book, 356, 30)
    const held = book.drawnOf(1)
    move(book, -356, 1, TUNING, new Set([1]))
    expect(book.drawnOf(1)).toBe(held)
    book.settle()
    expect(book.drawnOf(1)).toBe(0)
  })
  it('braces hard toward a wall for a moment, then lets go', () => {
    const book = new LeanBook()
    book.brace(1, true, 1000)
    expect(book.drawnOf(1, 1050)).toBeCloseTo(-18 * DEG, 6)
    expect(book.drawnOf(1, 1200)).toBe(0)
  })
})
