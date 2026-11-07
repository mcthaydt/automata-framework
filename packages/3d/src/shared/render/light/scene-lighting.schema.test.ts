import { describe, expect, it } from 'vitest'
import { sceneLightingSchema } from './scene-lighting.schema.ts'

const lamp = { id: 'desk', x: 0, y: 2, z: 0, color: 0xffd8a0, range: 4 }

describe('sceneLightingSchema', () => {
  it('fills the defaults: a white ambient, full strength and level, no occluders and no fog', () => {
    const lighting = sceneLightingSchema.parse({ ambient: 0.2, lamps: [lamp] })
    expect(lighting).toEqual({
      ambient: 0.2,
      ambientColor: 0xffffff,
      lamps: [{ ...lamp, strength: 1, level: 1 }],
      boxes: [],
      planes: [],
    })
  })

  it('reads boxes (base at y) and planes (normal made unit length)', () => {
    const lighting = sceneLightingSchema.parse({
      ambient: 0,
      boxes: [{ id: 'desk', x: 1, y: 0, z: 2, width: 1, height: 0.8, depth: 0.5 }],
      planes: [{ x: 0, y: 1.5, z: -3, normal: [0, 0, 2], width: 6, height: 3 }],
      fog: { near: 4, far: 12, color: 0x2e222f },
    })
    expect(lighting.boxes[0]?.height).toBe(0.8)
    expect(lighting.planes[0]?.normal).toEqual([0, 0, 1])
    expect(lighting.fog).toEqual({ near: 4, far: 12, color: 0x2e222f })
  })

  it.each([
    ['an ambient above 1', { ambient: 1.5 }, ['ambient']],
    ['a lamp with no range', { ambient: 0, lamps: [{ ...lamp, range: 0 }] }, ['lamps', 0, 'range']],
    ['a colour past 0xffffff', { ambient: 0, lamps: [{ ...lamp, color: 0x1000000 }] }, ['lamps', 0, 'color']],
    ['a negative level', { ambient: 0, lamps: [{ ...lamp, level: -1 }] }, ['lamps', 0, 'level']],
    [
      'a zero normal',
      { ambient: 0, planes: [{ x: 0, y: 0, z: 0, normal: [0, 0, 0], width: 1, height: 1 }] },
      ['planes', 0, 'normal'],
    ],
    [
      'fog whose far is not past its near',
      { ambient: 0, fog: { near: 5, far: 5, color: 0 } },
      ['fog', 'far'],
    ],
    ['a misspelt lamps table', { ambient: 0, lamp: [lamp] }, []],
    ['a misspelt ambient colour', { ambient: 0, ambientColour: 0xffffff }, []],
    ['an unknown fog key', { ambient: 0, fog: { near: 1, far: 2, color: 0, density: 1 } }, ['fog']],
    ['an unknown lamp key', { ambient: 0, lamps: [{ ...lamp, radius: 3 }] }, ['lamps', 0]],
    ['a duplicate lamp id', { ambient: 0, lamps: [lamp, { ...lamp, x: 3 }] }, ['lamps', 1, 'id']],
  ])('refuses %s at its path', (_what, input, path) => {
    const result = sceneLightingSchema.safeParse(input)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(path)
  })
})
