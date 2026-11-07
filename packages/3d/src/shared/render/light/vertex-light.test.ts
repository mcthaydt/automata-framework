// The direct-light cases are ported from The Last Light `tests/indirect-light.test.ts` at 92e6704 ("Gouraud direct
// light responds to distance, normal direction, and solid occlusion"; "does not let a bench collision volume shadow
// its own smaller seat"), on a fixture room with the same desk and bench.
import { describe, expect, it } from 'vitest'
import { sceneLightingSchema } from './scene-lighting.schema.ts'
import { characterTint, vertexLight } from './vertex-light.ts'

const room = sceneLightingSchema.parse({
  ambient: 0.2,
  ambientColor: 0xffffff,
  boxes: [
    { id: 'bench', x: -2.85, y: 0, z: 3.35, width: 1.6, height: 0.8, depth: 0.5 },
    { id: 'desk', x: 3.45, y: 0, z: 1.35, width: 1.2, height: 0.8, depth: 0.8 },
  ],
  planes: [{ x: 0, y: 1.5, z: 6.9, normal: [0, 0, -1], width: 10, height: 3 }],
})
const lamp = { id: 'l', x: 0, y: 2, z: 3, strength: 3, range: 4, color: 0xffcc80, level: 1 }

describe('vertexLight', () => {
  it('responds to distance, normal direction and solid occlusion', () => {
    const point = { x: 0, y: 0.01, z: 3, nx: 0, ny: 1, nz: 0 }
    expect(vertexLight(point, lamp, room)).toBeGreaterThan(0)
    expect(vertexLight({ ...point, ny: -1 }, lamp, room)).toBe(0)
    expect(vertexLight({ ...point, x: 10 }, lamp, room)).toBe(0)
    const acrossDesk = { x: 3.45, y: 0.5, z: 2.1, nx: 0, ny: 0, nz: -1 }
    const behindDesk = { ...lamp, x: 3.45, y: 0.5, z: 0.6 }
    expect(vertexLight(acrossDesk, behindDesk, { boxes: [], planes: [] })).toBeGreaterThan(0)
    expect(vertexLight(acrossDesk, behindDesk, room)).toBe(0)
  })

  it('falls off as (1 - d/range)² times strength, and N·L', () => {
    const below = { x: 0, y: 0, z: 3, nx: 0, ny: 1, nz: 0 }
    // 2 m straight below a 4 m lamp of strength 3: (1 - 0.5)² · 3.
    expect(vertexLight(below, lamp, { boxes: [], planes: [] })).toBeCloseTo(0.75, 2)
  })

  it('does not let a bench collision volume shadow its own smaller seat', () => {
    const seat = { x: -2.85, y: 0.55, z: 3.35, nx: 0, ny: 1, nz: 0 }
    const over = { ...lamp, x: -3.5, y: 2.4, z: 5.5, strength: 2.8, range: 7 }
    expect(vertexLight(seat, over, room)).toBe(0)
    expect(vertexLight(seat, over, room, ['bench'])).toBeGreaterThan(0)
  })
})

describe('characterTint (M3R-D4)', () => {
  const lit = { ...room, lamps: [lamp] }
  it('is the ambient light out of every lamp’s range', () => {
    expect(characterTint([20, 1, 20], undefined, lit)).toEqual([0.2, 0.2, 0.2])
  })

  it('adds the lamps in range, in their colour, more when the normal faces the lamp', () => {
    const near = characterTint([0, 1, 3], undefined, lit)
    expect(near[0]).toBeGreaterThan(0.2)
    expect(near[0]).toBeGreaterThan(near[2])
    const facing = characterTint([1, 1, 3], [-1, 0, 0], lit)
    const away = characterTint([1, 1, 3], [1, 0, 0], lit)
    expect(facing[0]).toBeGreaterThan(away[0])
    expect(away).toEqual([0.2, 0.2, 0.2])
  })

  it('scales a lamp by its level (the content level unless the sim set one), and walls block it', () => {
    const full = characterTint([0, 1, 3], undefined, lit)
    expect(characterTint([0, 1, 3], undefined, lit, { l: 0 })).toEqual([0.2, 0.2, 0.2])
    expect(characterTint([0, 1, 3], undefined, lit, { l: 0.5 })[0]).toBeLessThan(full[0])
    // Behind the south wall, the lamp moved to the far side of it.
    const beyond = { ...lit, lamps: [{ ...lamp, z: 6.5 }] }
    expect(characterTint([0, 1, 7.4], undefined, beyond)).toEqual([0.2, 0.2, 0.2])
  })
})
