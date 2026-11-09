import { describe, expect, it } from 'vitest'
import { cellHash, fromWire, toWire } from '#src/testing/wire.ts'

describe('what is carried to a page', () => {
  it('returns typed arrays and sets as they were', () => {
    const value = {
      verts: new Float32Array([1.5, -2, 3]),
      tris: new Int32Array([4, 5]),
      set: new Set(['a', 'b']),
      n: 7,
    }
    const back = fromWire<typeof value>(toWire(value))
    expect(back.verts).toBeInstanceOf(Float32Array)
    expect([...back.verts]).toEqual([1.5, -2, 3])
    expect([...back.tris]).toEqual([4, 5])
    expect([...back.set]).toEqual(['a', 'b'])
    expect(back.n).toBe(7)
  })

  it('hashes two cells alike only when every channel is', async () => {
    const make = (shade: number) => ({
      width: 1,
      height: 1,
      feet: [0, 0] as [number, number],
      colours: new Uint8ClampedArray([shade, 0, 0, 255]),
      normals: new Uint8ClampedArray(4),
      depth: new Float32Array(1),
      material: new Int16Array(1),
    })
    expect(await cellHash(make(1))).toBe(await cellHash(make(1)))
    expect(await cellHash(make(1))).not.toBe(await cellHash(make(2)))
  })
})
