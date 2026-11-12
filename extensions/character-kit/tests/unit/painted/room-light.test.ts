// The room's light on one painted figure (room-light.ts): a few numbers read from `SceneLight.tint` and the sun, quantised,
// whose key is exactly what lights the cell.
import { buildWorld, createSceneLight, timeOfDay, worldLighting } from '@automata/3d'
import { BASE_SCENES, baseLibrary } from '@automata/3d/base'
import { describe, expect, it } from 'vitest'
import { ROOM_LIGHT, roomLight, type Sun, type Tint } from '#src/features/painted/room-light.ts'
import {
  BASE,
  Figure,
  flatSteps,
  lightSprite,
  member,
  RAMPS,
  SPRITE_PITCH,
  type V3,
} from '#src/shared/figure-builder/door.ts'

const FEET: V3 = [0, 0, 0]
const woman = BASE.find((b) => b.def.id === 'base-f')?.def
if (woman === undefined) throw new Error('the builder has no base-f')
const grey =
  (v: number): Tint =>
  () => [v, v, v]
/** The first part of a key: the flat light's whole steps, after the exposure. */
const stepsOf = (key: string) => Number(key.split('|')[0])
/** A light that is `v` more for a normal facing `+axis` (the lean) and nothing otherwise. */
const leaning =
  (axis: 0 | 1 | 2, v: number, sign = 1): Tint =>
  (_x, _y, _z, n) => {
    const lit = n === undefined ? 0 : Math.max(0, sign * n[axis]) * v
    return [1 + lit, 1 + lit, 1 + lit]
  }

describe('roomLight', () => {
  it('under even grey light: no lamp, no exposure, steps from the level', () => {
    const light = roomLight(grey(1), undefined, FEET, 0)
    expect(light.lighting.lamps).toEqual([])
    expect(light.lighting.exposure ?? 0).toBe(0)
    expect(light.key.startsWith('0|-|-')).toBe(true)
    // A room brighter than the painted cell does not lift the figure over it (the cell is the daylight look already).
    expect(roomLight(grey(1.6), undefined, FEET, 0).key.startsWith('0|-|-')).toBe(true)
    expect(roomLight(grey(0.7), undefined, FEET, 0).key.startsWith('-2|-|-')).toBe(true)
  })

  it('a lamp to the east leans the resultant east, turned into the figure’s frame', () => {
    const east = leaning(0, 0.5)
    const at0 = roomLight(east, undefined, FEET, 0).lighting.lamps[0]
    expect(at0?.dir[0]).toBeGreaterThan(0.9)
    const quarter = roomLight(east, undefined, FEET, Math.PI / 2).lighting.lamps[0]
    expect(Math.abs(quarter?.dir[2] ?? 0)).toBeGreaterThan(0.9)
    expect(Math.abs(quarter?.dir[0] ?? 1)).toBeLessThan(0.1)
  })

  it('a figure in a pool on a dark floor is exposed down to one step over its ground', () => {
    // The chest probes are above the feet; the ring's are on the floor.
    const pool: Tint = (_x, y) => (y > 0.5 ? [1.6, 1.6, 1.6] : [0.5, 0.5, 0.5])
    const light = roomLight(pool, undefined, FEET, 0)
    expect(flatSteps([1.6, 1.6, 1.6])).toBe(2)
    expect(stepsOf(light.key)).toBe(flatSteps([0.5, 0.5, 0.5]) + 1)
  })

  it('a figure in a pool on a dark floor is held at its painted cell, no brighter', () => {
    const pool: Tint = (_x, y) => (y > 0.5 ? [1.6, 1.6, 1.6] : [0.5, 0.5, 0.5])
    expect(stepsOf(roomLight(pool, undefined, FEET, 0).key)).toBeLessThanOrEqual(0)
  })

  it('a lamp at the ceiling of light adds form and rim, never flat steps over 0', () => {
    const blazing: Tint = (_x, _y, _z, n) =>
      n === undefined ? [1.6, 1.6, 1.6] : [1.6 + Math.max(0, n[0]), 1.6, 1.6]
    const light = roomLight(blazing, undefined, FEET, 0)
    expect(light.key.startsWith('0|')).toBe(true)
    expect(light.lighting.lamps.length).toBeGreaterThan(0)
    expect(light.lighting.flat[0]).toBeLessThanOrEqual(1 + 1e-9)
    expect(roomLight(() => [1.6, 1.6, 1.6], undefined, FEET, 0).key.startsWith('0|')).toBe(true)
  })

  it('ROOM_LIGHT names the lift a figure may have over its painted cell: none', () => {
    expect(ROOM_LIGHT.lift).toBe(0)
  })

  it('two equal lamps either side cancel', () => {
    const both: Tint = (_x, _y, _z, n) => {
      const v = n === undefined ? 0 : Math.abs(n[0]) * 0.5
      return [1 + v, 1 + v, 1 + v]
    }
    expect(roomLight(both, undefined, FEET, 0).lighting.lamps).toEqual([])
  })

  it('no light: three steps down, no lamp, no NaN', () => {
    const light = roomLight(() => [0, 0, 0], undefined, FEET, 0)
    expect(stepsOf(light.key)).toBe(-3)
    expect(light.lighting.lamps).toEqual([])
    expect(Number.isFinite(light.lighting.flat[0] + light.lighting.flat[1] + light.lighting.flat[2])).toBe(
      true,
    )
    expect(light.key).toBe('-3|-|-')
  })

  it('the key changes with the light and only with it', () => {
    const base = roomLight(grey(1), undefined, FEET, 0).key
    // Inside one quantum: the same key.
    expect(roomLight(grey(1.01), undefined, FEET, 0).key).toBe(base)
    expect(roomLight(leaning(0, 0.5), undefined, FEET, 0).key).toBe(
      roomLight(leaning(0, 0.52), undefined, FEET, 0).key,
    )
    // Across one: a different key.
    expect(roomLight(grey(0.85), undefined, FEET, 0).key).not.toBe(base)
    expect(roomLight(leaning(0, 0.5), undefined, FEET, 0).key).not.toBe(
      roomLight(leaning(0, 0.9), undefined, FEET, 0).key,
    )
    // The view's turn is in it too: the same room from another side is another light on the figure.
    expect(roomLight(leaning(0, 0.5), undefined, FEET, 0).key).not.toBe(
      roomLight(leaning(0, 0.5), undefined, FEET, Math.PI / 2).key,
    )
  })

  it('by day the sun is a lamp', () => {
    const sun: Sun = { dir: [1, 0, 0], color: 0xffffff, level: 1 }
    const lit = roomLight(grey(1), sun, FEET, 0).lighting.lamps
    expect(lit).toHaveLength(1)
    expect(lit[0]?.dir[0]).toBeGreaterThan(0.9)
    expect(lit[0]?.strength).toBeCloseTo(1, 5)
    expect(roomLight(grey(1), undefined, FEET, 0).lighting.lamps).toEqual([])
    // A dark sun is none.
    expect(roomLight(grey(1), { ...sun, level: 0.01 }, FEET, 0).lighting.lamps).toEqual([])
  })

  it('by day the sun lights the figure’s flat too, and not past the ground beside it', () => {
    // A dim ambient room (0.3) and a high white sun: the flat light with the sun is well over the flat light without.
    const sun: Sun = { dir: [0.3, 0.9, 0.3], color: 0xffffff, level: 1 }
    const without = roomLight(grey(0.3), undefined, FEET, 0)
    const withSun = roomLight(grey(0.3), sun, FEET, 0)
    expect(stepsOf(without.key)).toBe(-3)
    expect(stepsOf(withSun.key)).toBeGreaterThanOrEqual(0)
    // The ground takes the sun by its slope, so the figure sits within a step of it: the sunlit floor's light is 0.3 + dir.y of the sun.
    const ground = 0.3 + (0.9 / Math.hypot(0.3, 0.9, 0.3)) * 1
    expect(stepsOf(withSun.key)).toBeLessThanOrEqual(flatSteps([ground, ground, ground]) + 1)
    // A low sun lights the ground little: the figure is held to it, never brighter than the ground beside it by more than a step.
    const low = roomLight(grey(0.3), { ...sun, dir: [1, 0.05, 0] }, FEET, 0)
    expect(stepsOf(low.key)).toBeLessThanOrEqual(flatSteps([0.3, 0.3, 0.3]) + 1)
  })

  it('one key, one picture', () => {
    const figure = new Figure(member(woman, 2))
    for (let i = 0; i < 3; i++)
      figure.update(1 / 60, { facing: Math.PI / 4, moving: false, view: { azimuth: 0, pitch: SPRITE_PITCH } })
    const a = roomLight(
      (x, y, z, n) => (n === undefined ? [1.3, 1.1, 0.8] : leaning(0, 0.5)(x, y, z, n)),
      undefined,
      FEET,
      0,
    )
    const b = roomLight(
      (x, y, z, n) => (n === undefined ? [1.301, 1.1, 0.8] : leaning(0, 0.52)(x, y, z, n)),
      undefined,
      FEET,
      0,
    )
    expect(a.key).toBe(b.key)
    expect(
      Buffer.compare(
        Buffer.from(lightSprite(figure, a.lighting)),
        Buffer.from(lightSprite(figure, b.lighting)),
      ),
    ).toBe(0)
    // A warm and a cool light with the same peak are two lights.
    const warm = roomLight(() => [1.3, 1.1, 0.8], undefined, FEET, 0).key
    const cool = roomLight(() => [0.8, 1.1, 1.3], undefined, FEET, 0).key
    expect(warm).not.toBe(cool)
  })
})

describe('roomLight in the base interior', () => {
  const level = BASE_SCENES['base-interior']
  const light = createSceneLight(
    worldLighting(buildWorld(level, baseLibrary, { night: true }), timeOfDay('lampLit')),
  )
  const at = (x: number, z: number) =>
    roomLight((px, py, pz, n) => light.tint(px, py, pz, n), light.lighting.sun, [x, 0, z], 0)

  it('under the pendant it is brighter than in the corner', () => {
    // The pendant hangs over the origin; the dimmest place of the room's floor is its corner.
    let dim = at(0, 0)
    for (let x = -3; x <= 3; x += 0.5)
      for (let z = -3; z <= 3; z += 0.5) if (stepsOf(at(x, z).key) < stepsOf(dim.key)) dim = at(x, z)
    expect(stepsOf(at(0, 0).key)).toBeGreaterThan(stepsOf(dim.key))
  })

  it('has no sun at night, so only the lamps lean', () => {
    expect(light.lighting.sun).toBeUndefined()
  })
})

describe('roomLight in the base exterior, by day', () => {
  const level = BASE_SCENES['base-exterior']
  const light = createSceneLight(
    worldLighting(buildWorld(level, baseLibrary, { night: false }), timeOfDay('day')),
  )
  const at = (x: number, z: number) =>
    roomLight((px, py, pz, n) => light.tint(px, py, pz, n), light.lighting.sun, [x, 0, z], 0)

  it('by day the flat light is the painted cell: 0 steps, over the whole ground', () => {
    expect(light.lighting.sun).toBeDefined()
    expect(stepsOf(at(0, 0).key)).toBe(0)
    let most = -Infinity
    for (let x = -6; x <= 6; x += 0.5)
      for (let z = -6; z <= 6; z += 0.5) most = Math.max(most, stepsOf(at(x, z).key))
    expect(most).toBeLessThanOrEqual(0)
    // Held at 0 the figure is not lifted, and the sun still leans on it: a lamp.
    expect(at(0, 0).lighting.lamps).toHaveLength(1)
  })

  it('a dark-skinned figure keeps its painted tone by day: no texel climbs its own ramp', () => {
    const figure = new Figure(member(woman, 2))
    for (let i = 0; i < 3; i++)
      figure.update(1 / 60, { facing: Math.PI / 4, moving: false, view: { azimuth: 0, pitch: SPRITE_PITCH } })
    // The flat light alone, with the sun's lamp left out: form and rim are one step of their own.
    const flat = { ...at(0, 0).lighting, lamps: [] }
    const lit = lightSprite(figure, flat)
    const painted = figure.painted
    const place = (c: number): [number, number] | undefined => {
      for (let r = 0; r < RAMPS.length; r++) {
        const i = RAMPS[r]?.indexOf(c) ?? -1
        if (i >= 0) return [r, i]
      }
      return undefined
    }
    const colour = (px: ArrayLike<number>, o: number) =>
      ((px[o] ?? 0) << 16) | ((px[o + 1] ?? 0) << 8) | (px[o + 2] ?? 0)
    let checked = 0
    for (let o = 0; o < painted.length; o += 4) {
      if (!painted[o + 3]) continue
      const from = place(colour(painted, o))
      if (from === undefined) continue
      const to = place(colour(lit, o))
      expect(to?.[0]).toBe(from[0])
      expect(to?.[1] ?? 99).toBeLessThanOrEqual(from[1])
      checked++
    }
    // The figure is mostly skin, so this is the skin's tone, held.
    expect(checked).toBeGreaterThan(1000)
  })
})

describe('roomLight exposed toward the floor it stands on (SceneLight.groundLuma)', () => {
  const sixThen = (luma: number) => ({ ground: () => luma, figure: 0.5 })

  it('holds a figure under 1.1 times its floor’s shown luma by whole steps down: a 0.5 figure on a 0.2 floor loses six steps', () => {
    // 0.5 / (1.1 × 0.2) = 2.27 and the light's step is a ratio of 1.17: ln 2.27 / ln 1.17 = 5.2, so six whole steps.
    expect(stepsOf(roomLight(grey(1), undefined, FEET, 0, sixThen(0.2)).key)).toBe(-6)
  })

  it('leaves a figure that is not hot as it was: a 0.5 figure on a 0.5 floor keeps its painted cell', () => {
    expect(stepsOf(roomLight(grey(1), undefined, FEET, 0, sixThen(0.5)).key)).toBe(0)
  })

  it('goes down to the window and no further: the figure just under 1.1 times the floor is not taken a step more', () => {
    // 0.5 / 0.4545 = 1.1 exactly is not hot; a hair under the floor that makes it so takes one step.
    expect(stepsOf(roomLight(grey(1), undefined, FEET, 0, sixThen(0.5 / 1.1)).key)).toBe(0)
    expect(stepsOf(roomLight(grey(1), undefined, FEET, 0, sixThen(0.5 / 1.1 - 0.001)).key)).toBe(-1)
  })

  it('reads the floor round the feet, at the feet’s own height, in four places', () => {
    const asked: [number, number, number][] = []
    roomLight(grey(1), undefined, [2, 0.12, 3], 0, {
      figure: 0.5,
      ground: (x, z, y) => {
        asked.push([x, z, y])
        return 0.5
      },
    })
    expect(asked).toHaveLength(4)
    expect(asked.every(([, , y]) => y === 0.12)).toBe(true)
    expect(new Set(asked.map(([x, z]) => `${x},${z}`))).toEqual(
      new Set([
        `${2 + ROOM_LIGHT.ring},3`,
        `${2 - ROOM_LIGHT.ring},3`,
        `2,${3 + ROOM_LIGHT.ring}`,
        `2,${3 - ROOM_LIGHT.ring}`,
      ]),
    )
  })

  it('falls back to the ring of the tint where the room has baked no floor under the feet', () => {
    const pool: Tint = (_x, y) => (y > 0.5 ? [1.6, 1.6, 1.6] : [0.5, 0.5, 0.5])
    const none = { ground: () => undefined, figure: 0.5 }
    expect(roomLight(pool, undefined, FEET, 0, none).key).toBe(roomLight(pool, undefined, FEET, 0).key)
  })

  it('is the same key without an exposure, as before', () => {
    expect(roomLight(grey(0.7), undefined, FEET, 0).key.startsWith('-2|-|-')).toBe(true)
  })
})
