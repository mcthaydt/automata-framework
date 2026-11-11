// The room's light on one painted figure (room-light.ts): a few numbers read from `SceneLight.tint` and the sun, quantised,
// whose key is exactly what lights the cell.
import { buildWorld, createSceneLight, timeOfDay, worldLighting } from '@automata/3d'
import { BASE_SCENES, baseLibrary } from '@automata/3d/base'
import { describe, expect, it } from 'vitest'
import { roomLight, type Sun, type Tint } from '#src/features/painted/room-light.ts'
import {
  BASE,
  Figure,
  flatSteps,
  lightSprite,
  member,
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
    expect(roomLight(grey(1.6), undefined, FEET, 0).key.startsWith('2|-|-')).toBe(true)
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

  it('a figure no brighter than its ground is not exposed', () => {
    expect(stepsOf(roomLight(grey(1.6), undefined, FEET, 0).key)).toBe(2)
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
    expect(roomLight(grey(1.2), undefined, FEET, 0).key).not.toBe(base)
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
