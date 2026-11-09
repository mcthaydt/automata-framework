import { describe, expect, it } from 'vitest'
import { spriteLamps, toCell } from '#src/features/figures/cells/sprite-lamps.ts'
import { createSceneLight } from '#src/shared/render/light/scene-light.ts'
import type { SceneLighting } from '#src/shared/render/light/scene-lighting.schema.ts'

const room = (patch: Partial<SceneLighting> = {}): SceneLighting => ({
  ambient: 0.2,
  ambientColor: 0xffffff,
  lamps: [{ id: 'lamp', x: 0, y: 3, z: 0, color: 0xff8000, strength: 2, range: 6, level: 1 }],
  boxes: [],
  planes: [],
  ...patch,
})
const CHEST: readonly [number, number, number] = [0, 1.1, 0]

describe('the lights a figure is lit by', () => {
  it('sees a lamp overhead straight above in the cell, nearer the top than the viewer', () => {
    const { lamps, ambient } = spriteLamps(createSceneLight(room()), CHEST, { pitch: 0 }, 1.5)
    expect(lamps).toHaveLength(1)
    expect(lamps[0]?.dir[1]).toBeCloseTo(1, 6)
    // 2 strength x (1 - 1.9/6)^2 of an orange: red full, blue none.
    const reach = 2 * (1 - 1.9 / 6) ** 2
    expect(lamps[0]?.rgb[0]).toBeCloseTo(reach, 6)
    expect(lamps[0]?.rgb[2]).toBe(0)
    expect(ambient[0]).toBeCloseTo(0.3, 6)
  })

  it('leaves out a lamp that is off, out of reach or behind a wall', () => {
    const off = createSceneLight(room())
    off.setLevels({ lamp: 0 })
    expect(spriteLamps(off, CHEST, { pitch: 0 }).lamps).toHaveLength(0)
    expect(spriteLamps(createSceneLight(room()), [0, 1.1, 9], { pitch: 0 }).lamps).toHaveLength(0)
    const walled = room({ planes: [{ x: 0, y: 2, z: 0, normal: [0, 1, 0], width: 4, height: 4 }] })
    expect(spriteLamps(createSceneLight(walled), CHEST, { pitch: 0 }).lamps).toHaveLength(0)
  })

  it('turns a world direction into the cell frame by azimuth then pitch', () => {
    const [x, y, z] = toCell([0, 0, 1], 0, Math.PI / 6)
    expect(x).toBeCloseTo(0, 10)
    expect(y).toBeCloseTo(-0.5, 10)
    expect(z).toBeCloseTo(Math.sqrt(3) / 2, 10)
    const [qx, , qz] = toCell([1, 0, 0], Math.PI / 2, 0)
    expect(qx).toBeCloseTo(0, 10)
    expect(qz).toBeCloseTo(1, 10)
  })
})
