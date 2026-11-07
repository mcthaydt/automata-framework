// A surface and its placement (EnvironmentBuilder `world/surface.ts` at 6d82a52, its tests ported).
import { describe, expect, it } from 'vitest'
import { isSurfaceTex, texOf, tileName, wallFrame } from '#src/features/world/surface.ts'

describe('a surface', () => {
  it('names a swatch, as a string or with its placement', () => {
    expect(tileName('oak')).toBe('oak')
    expect(tileName({ tile: 'oak', repeat: [2, 1] })).toBe('oak')
  })
  it('is a placement only if it is an object with a tile', () => {
    expect(isSurfaceTex({ tile: 'x' })).toBe(true)
    for (const not of ['x', { kind: 'bulb' }, ['x'], null, undefined]) expect(isSurfaceTex(not)).toBe(false)
  })
})

describe('texOf', () => {
  const frame = { o: [1, 0, 2], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] } as const
  it('gives a plain name no placement (it tiles in the world)', () => {
    expect(texOf('oak', 'wall', frame)).toBeUndefined()
    expect(texOf(undefined, 'wall', frame)).toBeUndefined()
  })
  it('aligns by site: a wall to its frame, a floor or ceiling to the world', () => {
    expect(texOf({ tile: 'oak' }, 'plane')).toEqual({})
    expect(texOf({ tile: 'oak' }, 'wall', frame)?.frame).toBe(frame)
  })
  it('lets `align` choose where it makes sense', () => {
    expect(texOf({ tile: 'oak', align: 'world' }, 'wall', frame)).toEqual({})
    expect(texOf({ tile: 'oak', align: 'wall' }, 'plane', frame)).toEqual({})
    expect(texOf({ tile: 'oak', align: 'object' }, 'wall', frame)?.frame).toBe(frame)
  })
  it('keeps the repeat, pan and turn it is given, and only those', () => {
    expect(texOf({ tile: 'oak', repeat: [2, 1], pan: [0.1, 0], turn: true }, 'wall', frame)).toEqual({
      frame,
      repeat: [2, 1],
      pan: [0.1, 0],
      turn: true,
    })
    expect(texOf({ tile: 'oak', pan: [0.1, 0] }, 'plane')).toEqual({ pan: [0.1, 0] })
  })
})

describe('a wall’s frame', () => {
  it('starts at the wall’s start on the floor, running left to right seen from the room', () => {
    const f = wallFrame([1, 2], 0.5, [0, 1])
    const want = { o: [1, 0.5, 2], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
    for (const k of ['o', 'x', 'y', 'z'] as const)
      for (const [i, c] of f[k].entries()) expect(c).toBeCloseTo(want[k][i] as number, 12)
  })
  it('is right-handed for every wall direction', () => {
    for (const n of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const f = wallFrame([0, 0], 0, n)
      const cross = [
        f.x[1] * f.y[2] - f.x[2] * f.y[1],
        f.x[2] * f.y[0] - f.x[0] * f.y[2],
        f.x[0] * f.y[1] - f.x[1] * f.y[0],
      ]
      for (const [i, c] of cross.entries()) expect(c).toBeCloseTo(f.z[i] as number, 12)
    }
  })
})
