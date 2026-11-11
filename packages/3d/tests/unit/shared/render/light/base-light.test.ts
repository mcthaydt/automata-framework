// The room's base light and the lamp's cone: the ambient with its small key on the normal, the fill that fades with
// height, the sun with its shadow, and light that comes in steps, as the look profile gives them.
import { describe, expect, it } from 'vitest'
import type { LightSample } from '#src/shared/render/light/occlusion.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { baseLight, lightModel, stepLight, vertexLight } from '#src/shared/render/light/vertex-light.ts'

const NONE = { boxes: [], planes: [] }
const floor: LightSample = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 }
const wall = (y: number): LightSample => ({ x: 0, y, z: 0, nx: 1, ny: 0, nz: 0 })
// A 3 m floor with the base the profile gives: ambient 0.15, a key of 0.09 along (0.3, 0.8, 0.5), a fill of 0.08.
const profile = {
  colorSpace: 'srgb',
  ambient: 0.15,
  ambientColor: 0xffffff,
  key: { dir: [0.3, 0.8, 0.5], level: 0.09 },
  fill: { level: 0.08, color: 0xffffff, fade: [1.5, 4, 0.25] },
  planes: [{ x: 0, y: 0, z: 0, normal: [0, 1, 0], width: 40, height: 40 }],
} as const
const model = (extra: object = {}) => lightModel(sceneLightingSchema.parse({ ...profile, ...extra }))
const lighting = (extra: object = {}) => sceneLightingSchema.parse({ ...profile, ...extra })

describe('stepLight', () => {
  it('snaps the brightest channel to the nearest step and keeps the hue', () => {
    const [r, g, b] = stepLight([0.93, 0.465, 0.2325], 0.1)
    expect(r).toBeCloseTo(0.9)
    expect(g / r).toBeCloseTo(0.5)
    expect(b / r).toBeCloseTo(0.25)
  })
  it('leaves dark light alone, and a step of 0 means no steps', () => {
    expect(stepLight([0, 0, 0], 0.1)).toEqual([0, 0, 0])
    expect(stepLight([0.93, 0.4, 0.1], 0)).toEqual([0.93, 0.4, 0.1])
  })
})

describe('baseLight', () => {
  it('is the ambient plus a small key on the normal, the key’s direction as given (not normalised)', () => {
    const lit = baseLight(floor, model(), NONE)
    // 0.15 + max(0, (0, 1, 0)·(0.3, 0.8, 0.5)) · 0.09, and the plane under it is its own floor, not a wall.
    expect(lit[0]).toBeCloseTo(0.15 + 0.8 * 0.09, 6)
    expect(baseLight({ ...floor, ny: -1 }, model(), NONE)[0]).toBeCloseTo(0.15, 6)
  })
  it('adds a fill on upright surfaces that fades with their height over the floor', () => {
    const m = model({ planes: [] })
    const at = (y: number) => baseLight(wall(y), m, NONE)[0] as number
    const key = 0.15 + 0.3 * 0.09
    expect(at(0)).toBeCloseTo(key + 0.08, 6)
    // fade = max(0.25, min(1, 1.5 - h/4)): 0.5 at 4 m, the floor of 0.25 from 5 m up.
    expect(at(4)).toBeCloseTo(key + 0.08 * 0.5, 6)
    expect(at(8)).toBeCloseTo(key + 0.08 * 0.25, 6)
    expect(baseLight(floor, m, NONE)[0]).toBeCloseTo(0.15 + 0.8 * 0.09, 6)
  })
  it('takes the fill’s height from the floor the surface stands over, not from zero', () => {
    // A wall point 2.5 m over a floor at 4 m: fade = 1.5 - 2.5/4, where over a floor at 0 it would sit at the 0.25 floor.
    const raised = {
      boxes: [],
      planes: [{ x: 0, y: 4, z: 0, normal: [0, 1, 0], width: 10, height: 10 }] as never,
    }
    const m = model({ planes: [] })
    const key = 0.15 + 0.3 * 0.09
    expect(baseLight(wall(6.5), m, raised)[0]).toBeCloseTo(key + 0.08 * 0.875, 3)
    expect(baseLight(wall(6.5), m, NONE)[0]).toBeCloseTo(key + 0.08 * 0.25, 3)
  })
  it('tints the ambient and the fill with the brightest channel of the tint at 1', () => {
    const [r, g, b] = baseLight(
      wall(0),
      model({ planes: [], ambientColor: 0x80c0ff, fill: { ...profile.fill, color: 0x80c0ff } }),
      NONE,
    )
    expect(b).toBeGreaterThan(g as number)
    expect(g).toBeGreaterThan(r as number)
    expect((b as number) / 1).toBeCloseTo(0.15 + 0.3 * 0.09 + 0.08, 6)
  })
  it('darkens the ambient and fill with the contact darkening and leaves the sun alone', () => {
    const corner = { x: 0.05, y: 0, z: 0, nx: 0, ny: 1, nz: 0 }
    const wallPlane = { x: 0, y: 1.5, z: 0, normal: [1, 0, 0], width: 10, height: 3 }
    const planes = [...profile.planes, wallPlane]
    const open = baseLight(corner, model({ planes }), { boxes: [], planes: profile.planes as never })
    const shut = baseLight(corner, model({ planes }), { boxes: [], planes: planes as never })
    expect(shut[0]).toBeLessThan(open[0] as number)
  })
})

describe('the sun', () => {
  const sun = { dir: [0, 1, 0], color: 0xffffff, level: 1, shadow: true }
  const l = lighting({ sun })
  const m = lightModel(l)
  // A crate floating 1 m over the floor, so its own foot darkens nothing.
  const crate = { x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 }
  it('adds its colour times N·L where nothing stands between', () => {
    const lit = baseLight({ ...floor, x: 3 }, m, { boxes: [crate], planes: [] })
    expect(lit[0]).toBeCloseTo(0.15 + 0.8 * 0.09 + 1, 5)
  })
  it('adds nothing to a surface facing away from it', () => {
    expect(baseLight({ ...floor, ny: -1 }, m, NONE)[0]).toBeCloseTo(0.15, 5)
  })
  it('is blocked by a box or a plane over the point, so the floor under a crate is in shadow', () => {
    const under = baseLight({ ...floor, x: 0 }, m, { boxes: [crate], planes: [] })
    const clear = baseLight({ ...floor, x: 3 }, m, { boxes: [crate], planes: [] })
    expect(under[0]).toBeLessThan(0.5)
    expect(clear[0]).toBeGreaterThan(1)
  })
  it('sees a thin caster as a soft line: a vertex it half covers is lit by about half the sun', () => {
    // Over the spread (0.175 m) either side of the vertex: its east column of the 3 × 3 grid is behind the pole.
    const pole = { x: 0.175, y: 0.2, z: 0, width: 0.06, height: 8, depth: 0.5 }
    const lit = baseLight({ x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 }, m, { boxes: [pole], planes: [] })
    const sunPart = (lit[0] as number) - (0.15 + 0.8 * 0.09)
    expect(sunPart).toBeGreaterThan(0.2)
    expect(sunPart).toBeLessThan(0.9)
  })
  it('ignores the occluders when the time casts no shadow', () => {
    const noShadow = lightModel(lighting({ sun: { ...sun, shadow: false } }))
    const lit = baseLight(floor, noShadow, { boxes: [crate], planes: [] })
    expect(lit[0]).toBeCloseTo(0.15 + 0.8 * 0.09 + 1, 5)
  })
  it('scales by the sun’s level and its colour', () => {
    const dim = lightModel(lighting({ sun: { ...sun, level: 0.5, color: 0xff8000 } }))
    const lit = baseLight(floor, dim, NONE)
    expect(lit[0]).toBeCloseTo(0.15 + 0.8 * 0.09 + 0.5, 5)
    expect(lit[2]).toBeCloseTo(0.15 + 0.8 * 0.09, 5)
  })
})

describe('a lamp’s cone', () => {
  const lamp = { id: 'l', x: 0, y: 2, z: 0, strength: 1, range: 6, color: 0xffffff, level: 1 }
  const below = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 }
  const side = { x: 2, y: 0, z: 0, nx: 0, ny: 1, nz: 0 }
  it('lights everything in range with no aim', () => {
    expect(vertexLight(side, lamp, NONE)).toBeGreaterThan(0)
  })
  it('lights straight down the aim in full, and nothing outside the cone’s edge', () => {
    const aimed = { ...lamp, aim: [0, -1, 0] as const, cone: 30 }
    expect(vertexLight(below, aimed, NONE)).toBeCloseTo(vertexLight(below, lamp, NONE), 9)
    // 2 m to the side of a lamp 2 m up is 45° off the aim.
    expect(vertexLight(side, aimed, NONE)).toBe(0)
  })
  it('softens the edge over a third of it, and takes an aim that is not a unit vector', () => {
    // cos(edge) = cos 60°; a point 45° off: (0.707 - 0.5) / 0.5 · 3 ≥ 1, so lit in full.
    const wide = { ...lamp, aim: [0, -3, 0] as const, cone: 60 }
    expect(vertexLight(side, wide, NONE)).toBeCloseTo(vertexLight(side, lamp, NONE), 9)
    // 55°: (cos 55° - 0.5) / 0.5 · 3 = 0.4: lit by 0.4.
    const off = { x: 2 / Math.tan((35 * Math.PI) / 180), y: 0, z: 0, nx: 0, ny: 1, nz: 0 }
    const part = vertexLight(off, wide, NONE) / vertexLight(off, lamp, NONE)
    expect(part).toBeCloseTo(((Math.cos((55 * Math.PI) / 180) - 0.5) / 0.5) * 3, 3)
  })
})
