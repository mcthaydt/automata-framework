// Bakes every subdivided vertex (fixed lamps scaled by their level), and refreshes changed light inputs to match a
// fresh lighting pass (no upload when nothing changed), on plain vertex arrays.
import { describe, expect, it } from 'vitest'
import { ladderOf } from '#src/features/world/albedo/ladder.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { bakeVertices } from '#src/shared/render/light/vertex-bake.ts'

// A 4 × 4 floor patch of 25 vertices around the origin, facing up.
function floorPatch(): { positions: Float32Array; normals: Float32Array } {
  const positions: number[] = []
  const normals: number[] = []
  for (let i = 0; i <= 4; i++)
    for (let j = 0; j <= 4; j++) {
      positions.push(i - 2, 0, j - 2)
      normals.push(0, 1, 0)
    }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals) }
}
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const translate = (x: number, y: number, z: number) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]

const lighting = sceneLightingSchema.parse({
  ambient: 0.15,
  lamps: [
    { id: 'warm', x: -1, y: 1.5, z: 0, color: 0xffcc80, range: 3 },
    { id: 'far', x: 30, y: 1.5, z: 0, color: 0x80c0ff, range: 3 },
  ],
})

const colours = (bake: ReturnType<typeof bakeVertices>, levels = {}) => {
  const out = new Float32Array(bake.vertexCount * 4)
  bake.write(levels, out)
  return out
}

describe('bakeVertices', () => {
  it('gives every vertex an opaque colour that varies across the patch', () => {
    const { positions, normals } = floorPatch()
    const out = colours(bakeVertices(positions, normals, IDENTITY, lighting))
    expect(out.length).toBe(25 * 4)
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(1)
    expect(new Set(out).size).toBeGreaterThan(4)
  })

  it('lists only the lamps that reach a vertex', () => {
    const { positions, normals } = floorPatch()
    expect([...bakeVertices(positions, normals, IDENTITY, lighting).reachedBy]).toEqual(['warm'])
    expect([...bakeVertices(positions, normals, translate(30, 0, 0), lighting).reachedBy]).toEqual(['far'])
  })

  it('scales a lamp by its level: brighter at 1 than at 0.3, ambient only at 0', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, IDENTITY, lighting)
    const dim = colours(bake, { warm: 0.3 })
    const full = colours(bake, { warm: 1 })
    expect(full.some((v, i) => v > (dim[i] ?? 0))).toBe(true)
    expect(full.every((v, i) => v >= (dim[i] ?? 0))).toBe(true)
    const off = colours(bake, { warm: 0 })
    expect(Math.max(...off.filter((_, i) => i % 4 !== 3))).toBeCloseTo(0.15, 5)
  })

  it('after a change of levels writes what a fresh bake at those levels writes, and reports no change twice', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, IDENTITY, lighting)
    const out = new Float32Array(bake.vertexCount * 4)
    expect(bake.write({ warm: 1 }, out)).toBe(true)
    expect(bake.write({ warm: 0.4 }, out)).toBe(true)
    expect(out).toEqual(colours(bakeVertices(positions, normals, IDENTITY, lighting), { warm: 0.4 }))
    expect(bake.write({ warm: 0.4 }, out)).toBe(false)
  })

  it('writes nothing new when a lamp that reaches no vertex changes level', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, IDENTITY, lighting)
    const out = new Float32Array(bake.vertexCount * 4)
    bake.write({}, out)
    expect(bake.write({ far: 0 }, out)).toBe(false)
    expect(bake.write({ far: 0, warm: 0.5 }, out)).toBe(true)
  })

  it('places vertices and turns normals by the world matrix', () => {
    // One vertex facing +z, turned to face -x (a quarter turn about y) and moved beside the warm lamp.
    const position = new Float32Array([0, 0, 0])
    const normal = new Float32Array([0, 0, 1])
    const quarter = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 1.5, 0, 1]
    const facing = colours(bakeVertices(position, normal, quarter, lighting))
    expect(facing[0]).toBeGreaterThan(0.15)
    const away = colours(bakeVertices(position, normal, [...quarter.slice(0, 12), -2, 1.5, 0, 1], lighting))
    expect(away[0]).toBeCloseTo(0.15, 5)
  })

  it('applies contact darkening from the occluders', () => {
    const { positions, normals } = floorPatch()
    const walled = {
      ...lighting,
      lamps: [],
      planes: [{ x: 2.05, y: 1, z: 0, normal: [-1, 0, 0] as [number, number, number], width: 6, height: 2 }],
    }
    const out = colours(bakeVertices(positions, normals, IDENTITY, walled))
    // The row against the wall (x = 2) is darker than the middle (x = 0).
    expect(out[(4 * 5 + 2) * 4]).toBeLessThan(out[(2 * 5 + 2) * 4] ?? 0)
  })

  it('applies contact darkening to the ambient and fill only, never to a lamp’s light', () => {
    const { positions, normals } = floorPatch()
    const lit = { ...lighting, ambient: 0 }
    const wall = [
      { x: -2.05, y: 1, z: 0, normal: [1, 0, 0] as [number, number, number], width: 6, height: 2 },
    ]
    const without = colours(bakeVertices(positions, normals, IDENTITY, lit))
    const beside = colours(bakeVertices(positions, normals, IDENTITY, { ...lit, planes: wall }))
    expect(beside).toEqual(without)
  })

  // The old game multiplied its whole light by the contact darkening, lamps included: the pool at a wall's foot is darker than
  // the pool in the open. A room opts in with `contact.lamps` (the share of the darkening lamp light takes).
  it('with `contact.lamps` the darkening also multiplies a lamp’s light, by that share, and only near the wall', () => {
    const { positions, normals } = floorPatch()
    const lit = { ...lighting, ambient: 0 }
    const wall = [
      { x: -2.05, y: 1, z: 0, normal: [1, 0, 0] as [number, number, number], width: 6, height: 2 },
    ]
    const room = { ...lit, planes: wall }
    const plain = colours(bakeVertices(positions, normals, IDENTITY, room), { warm: 1 })
    const full = colours(
      bakeVertices(
        positions,
        normals,
        IDENTITY,
        sceneLightingSchema.parse({ ...room, contact: { lamps: 1 } }),
      ),
      { warm: 1 },
    )
    const half = colours(
      bakeVertices(
        positions,
        normals,
        IDENTITY,
        sceneLightingSchema.parse({ ...room, contact: { lamps: 0.5 } }),
      ),
      { warm: 1 },
    )
    // The row against the wall (x = -2, i = 0): darker with the opt-in; the far side (x = 2, i = 4) is as it was.
    const against = (0 * 5 + 2) * 4
    const away = (4 * 5 + 2) * 4
    expect(full[against] ?? 0).toBeLessThan((plain[against] ?? 0) * 0.9)
    expect(full[away]).toBe(plain[away])
    expect(half[against] ?? 0).toBeGreaterThan(full[against] ?? 0)
    expect(half[against] ?? 0).toBeLessThan(plain[against] ?? 0)
  })

  it('with no contact block, or `lamps: 0`, a lamp’s light is as it always was', () => {
    const { positions, normals } = floorPatch()
    const wall = [
      { x: -2.05, y: 1, z: 0, normal: [1, 0, 0] as [number, number, number], width: 6, height: 2 },
    ]
    const room = { ...lighting, planes: wall }
    const plain = colours(bakeVertices(positions, normals, IDENTITY, room), { warm: 1 })
    const zero = colours(
      bakeVertices(
        positions,
        normals,
        IDENTITY,
        sceneLightingSchema.parse({ ...room, contact: { lamps: 0 } }),
      ),
      { warm: 1 },
    )
    expect(zero).toEqual(plain)
  })
})

// The room light as a look gives it: a key, a fill and a sun in the base, a cap and steps on the sum, a shade per room.
describe('the look’s light', () => {
  const FLOOR = [{ x: 0, y: 0, z: 0, normal: [0, 1, 0] as [number, number, number], width: 40, height: 40 }]
  const base = sceneLightingSchema.parse({
    ambient: 0.15,
    colorSpace: 'srgb',
    key: { dir: [0.3, 0.8, 0.5], level: 0.09 },
    planes: FLOOR,
  })
  const peak = (out: Float32Array, vertex: number) =>
    Math.max(out[vertex * 4]!, out[vertex * 4 + 1]!, out[vertex * 4 + 2]!)

  it('writes the ambient and the key on a floor, the same at every vertex of an open patch', () => {
    const { positions, normals } = floorPatch()
    const out = colours(bakeVertices(positions, normals, IDENTITY, base))
    for (let v = 0; v < 25; v++) expect(out[v * 4]).toBeCloseTo(0.15 + 0.8 * 0.09, 5)
  })

  it('steps the light: the brightest channel is a multiple of the step, and the hue is kept', () => {
    const { positions, normals } = floorPatch()
    const out = colours(
      bakeVertices(positions, normals, IDENTITY, {
        ...base,
        step: 0.1,
        lamps: lighting.lamps,
        ambientColor: 0xffcc80,
      }),
    )
    for (let v = 0; v < 25; v++) {
      const top = peak(out, v)
      expect(Math.abs(top / 0.1 - Math.round(top / 0.1))).toBeLessThan(1e-4)
      expect(out[v * 4 + 2]! / top).toBeCloseTo(0x80 / 0xff, 1)
    }
  })

  it('caps the sum at `max` a channel', () => {
    const { positions, normals } = floorPatch()
    const bright = { ...base, max: 0.5, ambient: 1 }
    const out = colours(bakeVertices(positions, normals, IDENTITY, bright))
    for (let v = 0; v < 25; v++) expect(peak(out, v)).toBeCloseTo(0.5, 6)
  })

  it('multiplies a room’s light by the shade for each whole step it is darker', () => {
    const { positions, normals } = floorPatch()
    const plain = colours(bakeVertices(positions, normals, IDENTITY, base))
    const dim = colours(bakeVertices(positions, normals, IDENTITY, base, [], { shadeSteps: 2 }))
    expect(dim[0]).toBeCloseTo((plain[0] as number) * 0.85 ** 2, 5)
    const lighter = colours(bakeVertices(positions, normals, IDENTITY, base, [], { shadeSteps: -1 }))
    expect(lighter[0]).toBeCloseTo((plain[0] as number) / 0.85, 5)
  })

  it('adds the sun, and leaves the floor under a box in its shadow', () => {
    const { positions, normals } = floorPatch()
    const sunny = {
      ...base,
      sun: { dir: [0, 1, 0] as [number, number, number], color: 0xffffff, level: 1, shadow: true },
      boxes: [{ x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 }],
    }
    const out = colours(bakeVertices(positions, normals, IDENTITY, sunny))
    // (0, 0) is the patch's middle vertex, under the box; (−2, −2) is clear.
    expect(out[12 * 4]).toBeCloseTo(0.15 + 0.8 * 0.09, 5)
    expect(out[0]).toBeCloseTo(0.15 + 0.8 * 0.09 + 1, 5)
  })

  // A baked mesh is drawn unlit (`FlatMaterial` skips the tone map and its encode), so the screen shows the vertex colour as
  // written: the albedo times the light is written as it is, in sRGB, with no curve in between.
  it('writes the albedo times the light as the vertex colour, for an unlit material to show as it is', () => {
    const { positions, normals } = floorPatch()
    const albedo = 0x8690b2
    const out = colours(bakeVertices(positions, normals, IDENTITY, base, [], { albedo }))
    const light = 0.15 + 0.8 * 0.09
    for (const [c, a] of [
      [0, 0x86],
      [1, 0x90],
      [2, 0xb2],
    ] as const)
      expect(out[c]).toBeCloseTo((a / 255) * light, 5)
  })

  it('leaves a bright texel at 1 on screen, not past it, when the light would push it over', () => {
    const { positions, normals } = floorPatch()
    const out = colours(
      bakeVertices(positions, normals, IDENTITY, { ...base, ambient: 1, max: 1.6 }, [], { albedo: 0xffffff }),
    )
    // albedo 1 × light 1.09 → clamped at 1 on screen.
    expect(out[0]).toBeCloseTo(1, 5)
  })

  it('gives a textured mesh the light itself, past 1 where the light is, for the texture to take', () => {
    const { positions, normals } = floorPatch()
    const bright = { ...base, ambient: 1, max: 1.6 }
    const light = colours(bakeVertices(positions, normals, IDENTITY, bright))[0] as number
    const out = colours(bakeVertices(positions, normals, IDENTITY, bright, [], { textured: true }))
    // The tile is a non-sRGB texture of DUEL colours, so a texel × this is its albedo × light on screen, whole.
    expect(light).toBeGreaterThan(1)
    expect(out[0]).toBeCloseTo(light, 5)
  })
})

// A glowing swatch (a bulb, a neon, a lit window) is drawn at its own ladder step whatever the light; it dims, a step or
// two, with the lamp it belongs to.
describe('a glowing swatch', () => {
  const EMBER = ladderOf({ ramp: 'ember', step: 7 })
  const glow = { steps: EMBER.steps, base: EMBER.base, lamps: ['warm'] }
  const bright = sceneLightingSchema.parse({
    ambient: 0.05,
    colorSpace: 'srgb',
    lamps: lighting.lamps,
  })
  // A glowing mesh is drawn unlit on a white base, so its vertex colour is the step's colour as the screen shows it.
  const linear = (rgb: number): number[] =>
    [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255].map((c) => c / 255)
  const first = (out: Float32Array) => [out[0], out[1], out[2]]

  it('keeps its own step at every vertex, lit or dark', () => {
    const { positions, normals } = floorPatch()
    const out = colours(bakeVertices(positions, normals, IDENTITY, bright, [], { glow }))
    for (let v = 0; v < 25; v++)
      expect(first(out.subarray(v * 4))).toEqual(linear(EMBER.steps[7] as number).map(Math.fround))
  })

  it('dims a step under 0.9 of its lamp and two under 0.6', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, IDENTITY, bright, [], { glow })
    const at = (level: number) => first(colours(bake, { warm: level }))
    const step = (n: number) => linear(EMBER.steps[n] as number)
    expect(at(1)).toEqual(step(7).map(Math.fround))
    expect(at(0.8)).toEqual(step(6).map(Math.fround))
    expect(at(0.5)).toEqual(step(5).map(Math.fround))
    expect(at(0)).toEqual(step(5).map(Math.fround))
  })

  it('is rebaked when its lamp changes, and by no other', () => {
    const { positions, normals } = floorPatch()
    const bake = bakeVertices(positions, normals, translate(30, 0, 0), bright, [], { glow })
    expect([...bake.reachedBy]).toEqual(['warm'])
  })

  it('stays full where the lamp is not in the room’s lamps (a street lamp by day)', () => {
    const { positions, normals } = floorPatch()
    const day = { ...bright, lamps: [] }
    const out = colours(bakeVertices(positions, normals, IDENTITY, day, [], { glow }))
    expect(first(out)).toEqual(linear(EMBER.steps[7] as number).map(Math.fround))
  })
})
