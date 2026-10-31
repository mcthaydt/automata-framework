// Squash and stretch on a spring (M6.1a step 2), from the arcade source's cases: a knock sends x out and y in, and the
// spring settles back, drawn on 1/32 steps. Keyed by any view, not by a racer.
import { describe, expect, it } from 'vitest'
import { SquashBook } from './squash'

const SQUASH = { f: 4, zeta: 0.35, r: 0 }

describe('SquashBook', () => {
  it('knocks x out and y in, then settles to 1 with a wobble, drawn on 1/32 steps', () => {
    const book = new SquashBook(() => SQUASH)
    book.knock(1, 0.25)
    expect(book.scaleOf(1)).toEqual({ x: 1.25, y: 0.75 })
    const xs: number[] = []
    for (let i = 0; i < 90; i += 1) {
      book.update(1 / 60)
      xs.push(book.scaleOf(1).x)
    }
    expect(Math.min(...xs)).toBeLessThan(1)
    expect(xs.at(-1)).toBe(1)
    for (const x of xs) expect((x * 32) % 1).toBeCloseTo(0, 6)
  })
  it('holds the frozen view and settles everyone at once', () => {
    const book = new SquashBook(() => SQUASH)
    book.knock(1, 0.5)
    book.update(1 / 60, new Set([1]))
    expect(book.scaleOf(1).x).toBe(1.5)
    book.settle()
    expect(book.scaleOf(1)).toEqual({ x: 1, y: 1 })
  })
  it('holds a hammered squash at its amount: knocks never stack', () => {
    const book = new SquashBook(() => SQUASH)
    for (let i = 0; i < 10; i += 1) {
      book.knock(1, 0.5)
      book.update(1 / 60)
      expect(book.scaleOf(1).x).toBeLessThanOrEqual(1.5)
    }
  })
  it('rests a view it has never knocked, and counts the squashes still moving', () => {
    const book = new SquashBook(() => SQUASH)
    expect(book.scaleOf('never')).toEqual({ x: 1, y: 1 })
    book.knock('a', 0.3)
    expect(book.moving).toBe(1)
    for (let i = 0; i < 300; i += 1) book.update(1 / 60)
    expect(book.moving).toBe(0)
  })
})
