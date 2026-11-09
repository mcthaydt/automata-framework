import { describe, expect, it } from 'vitest'
import { CellCache, cellBytes } from '#src/features/figures/cells/cell-cache.ts'
import { cellKey } from '#src/features/figures/cells/cell-key.ts'
import type { PaintedCell } from '#src/features/figures/paint/paint-cell.ts'

const cellOf = (_name: string): PaintedCell => ({
  width: 4,
  height: 4,
  feet: [2, 3],
  colours: new Uint8ClampedArray(64),
  normals: new Uint8ClampedArray(64),
  depth: new Float32Array(16),
  material: new Int16Array(16),
})
const CELL_BYTES = cellBytes(cellOf('x'))

describe('the cell cache', () => {
  it('a full cache never drops a cell shown this frame', () => {
    const cache = new CellCache(3 * CELL_BYTES)
    for (const k of ['a', 'b', 'c']) cache.put(k, cellOf(k))
    cache.hold(['a'])
    cache.put('d', cellOf('d'))
    expect(['a', 'b', 'c', 'd'].map((k) => cache.get(k) !== undefined)).toEqual([true, false, true, true])
    expect(cache.bytes).toBeLessThanOrEqual(3 * CELL_BYTES)
  })
  it('drops the least recently used first', () => {
    const cache = new CellCache(2 * CELL_BYTES)
    cache.put('a', cellOf('a'))
    cache.put('b', cellOf('b'))
    cache.get('a')
    cache.put('c', cellOf('c'))
    expect(['a', 'b', 'c'].map((k) => cache.get(k) !== undefined)).toEqual([true, false, true])
  })
  it('counts a replaced cell once', () => {
    const cache = new CellCache(4 * CELL_BYTES)
    cache.put('a', cellOf('a'))
    cache.put('a', cellOf('a'))
    expect(cache.bytes).toBe(CELL_BYTES)
  })
})

describe('the cell key', () => {
  const parts = {
    pose: 'idle-3',
    direction: 2,
    pitch: 0.3141592,
    density: 2,
    outfit: 'base',
    item: null,
    face: 'neutral',
  }
  it('tells poses, views, densities and what is worn apart', () => {
    const keys = new Set([
      cellKey(parts),
      cellKey({ ...parts, pose: 'walk-1' }),
      cellKey({ ...parts, direction: 3 }),
      cellKey({ ...parts, pitch: 0.35 }),
      cellKey({ ...parts, density: 1.5 }),
      cellKey({ ...parts, outfit: 'coat' }),
      cellKey({ ...parts, item: 'torch' }),
      cellKey({ ...parts, face: 'smile' }),
    ])
    expect(keys.size).toBe(8)
  })
  it('is the same for the same cell', () => {
    expect(cellKey({ ...parts })).toBe(cellKey({ ...parts, pitch: 0.31415921 }))
  })
})
