import { describe, expect, it } from 'vitest'
import { PaintQueue } from '#src/features/figures/cells/paint-queue.ts'
import type { PaintedCell } from '#src/features/figures/paint/paint-cell.ts'

const paint = (): PaintedCell => ({
  width: 1,
  height: 1,
  feet: [0, 0],
  colours: new Uint8ClampedArray(4),
  normals: new Uint8ClampedArray(4),
  depth: new Float32Array(1),
  material: new Int16Array(1),
})

describe('the paint queue', () => {
  it('paints at most one cell a run, the most wanted first', () => {
    const q = new PaintQueue()
    q.request('walk-0', 2, paint)
    q.request('idle-0', 1, paint)
    q.request('walk-0', 2, paint)
    expect([q.runOne(), q.pending]).toEqual(['idle-0', 1])
  })
  it('hands each cell to its taker, and says when nothing waits', () => {
    const got: string[] = []
    const q = new PaintQueue((key) => got.push(key))
    q.request('a', 1, paint)
    expect(q.runOne()).toBe('a')
    expect(q.runOne()).toBeUndefined()
    expect(got).toEqual(['a'])
  })
  it('a request asked again more urgently moves up', () => {
    const q = new PaintQueue()
    q.request('slow', 5, paint)
    q.request('other', 3, paint)
    q.request('slow', 1, paint)
    expect(q.runOne()).toBe('slow')
  })
})
