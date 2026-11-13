// The sky pass: the time of day's bands, clouds, a horizon of silhouette layers and the haze below it, drawn where no
// mesh is. The shader is generated from the time and the layers; these tests pin what it is generated from.
import { describe, expect, it } from 'vitest'
import { hazeAt } from '#src/features/look/haze.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { horizonProfile, skyShaders } from '#src/features/look/sky-pass.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

const CITY = { kind: 'city', colour: '#7a7799', height: 0.2, seed: 3 } as const

describe('the horizon profile', () => {
  it('is a seamless ring: yaw 0 and yaw 360 are the same height', () => {
    for (const kind of ['mountains', 'hills', 'trees', 'city'] as const)
      expect(horizonProfile(kind, 0.2, 3, 360)).toBeCloseTo(horizonProfile(kind, 0.2, 3, 0), 9)
  })

  it('stays under the layer’s height, and a city is blocks of a few degrees', () => {
    for (let yaw = 0; yaw < 360; yaw += 7)
      expect(horizonProfile('city', 0.2, 3, yaw)).toBeLessThanOrEqual(0.2)
    // One block spans 3.2 degrees: two yaws in the same block are the same height.
    expect(horizonProfile('city', 0.2, 3, 10.1)).toBe(horizonProfile('city', 0.2, 3, 11.9))
  })

  it('depends on the seed', () => {
    expect(horizonProfile('city', 0.2, 3, 50)).not.toBe(horizonProfile('city', 0.2, 4, 50))
  })
})

describe('skyShaders', () => {
  it('bakes the time’s bands, in both languages', () => {
    const day = timeOfDay('day')
    const { gl, gpu } = skyShaders(day, [CITY])
    for (const band of day.scene.sky.slice(1)) expect(gl).toContain(band.at.toFixed(4))
    expect(gpu).toContain('fn effect(')
    expect(gl).toContain('vec4 effect(')
  })

  it('draws the ground below the horizon in the library’s haze colour, lit by the time that sets none', () => {
    const night = timeOfDay('night')
    expect(night.scene.haze).toBeUndefined()
    const [r, g, b] = [1, 3, 5].map((at) =>
      (Number.parseInt(hazeAt(DEFAULT_LOOK.haze, night).colour.slice(at, at + 2), 16) / 255).toFixed(4),
    )
    expect(skyShaders(night, []).gl).toContain(`vec3(${r}, ${g}, ${b}) * k`)
  })

  it('draws a city’s lit windows only when there is no sun', () => {
    expect(skyShaders(timeOfDay('day'), [CITY]).gl).not.toContain('WINDOWS')
    expect(skyShaders(timeOfDay('night'), [CITY]).gl).toContain('WINDOWS')
  })

  it('leaves out clouds at night', () => {
    expect(skyShaders(timeOfDay('day'), []).gl).toContain('CLOUDS')
    expect(skyShaders(timeOfDay('night'), []).gl).not.toContain('CLOUDS')
  })
})
