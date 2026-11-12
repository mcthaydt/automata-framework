// The haze: the veil toward the far, as pure rules the shader repeats (`hazeShare`, `hazeOf`, `hazed`).
import { describe, expect, it } from 'vitest'
import { hazeAt, hazed, hazeOf, hazeShare } from '#src/features/look/haze.ts'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'
import { createLookPasses } from '#src/features/look/look-pass.ts'
import { lightByTime } from '#src/shared/time-of-day/time-light.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

const profile = DEFAULT_LOOK.haze

describe('the haze profile', () => {
  it('is the source look’s: teal, 0 to 10 m, up to 0.85, glowing by the light, 3 m from the eye in first person', () => {
    expect(profile).toEqual({ colour: '#47655a', near: 0, far: 10, amount: 0.85, glow: 0.5, focusFp: 3 })
    expect(DEFAULT_LOOK.switches.haze).toBe(true)
  })

  it('takes a partial override and names what is wrong', () => {
    expect(parseLook({ haze: { far: 6 } }).haze).toEqual({ ...profile, far: 6 })
    expect(() => parseLook({ haze: { near: 5, far: 5 } })).toThrow(/far/)
  })
})

describe('hazeShare', () => {
  it('is 0 before near, rises linearly, and holds at amount from far', () => {
    expect(hazeShare(-3, profile)).toBe(0)
    expect(hazeShare(0, profile)).toBe(0)
    expect(hazeShare(5, profile)).toBeCloseTo(0.425, 10)
    expect(hazeShare(10, profile)).toBeCloseTo(0.85, 10)
    expect(hazeShare(40, profile)).toBeCloseTo(0.85, 10)
  })
})

describe('hazeOf', () => {
  it('is the profile with the time’s own colour and amount where it sets them', () => {
    expect(hazeOf(profile, undefined)).toEqual(profile)
    const day = timeOfDay('day').scene.haze
    expect(day).toBeDefined()
    expect(hazeOf(profile, day)).toEqual({ ...profile, colour: '#8690b2', amount: 0.35 })
  })
})

describe('hazeAt', () => {
  it('is the time’s own haze where the time sets one', () => {
    expect(hazeAt(profile, timeOfDay('day'))).toEqual(hazeOf(profile, timeOfDay('day').scene.haze))
    expect(hazeAt(profile, timeOfDay('dusk'))).toEqual(hazeOf(profile, timeOfDay('dusk').scene.haze))
  })

  it('lights the profile’s colour by a time that sets none, as the fog is, so the night’s veil is not a day colour', () => {
    const night = timeOfDay('night')
    expect(night.scene.haze).toBeUndefined()
    const lit = lightByTime(Number.parseInt(profile.colour.slice(1), 16), night)
    expect(hazeAt(profile, night)).toEqual({ ...profile, colour: `#${lit.toString(16).padStart(6, '0')}` })
    const sum = (hex: string) =>
      [1, 3, 5].reduce((total, at) => total + Number.parseInt(hex.slice(at, at + 2), 16), 0)
    expect(sum(hazeAt(profile, night).colour)).toBeLessThan(sum(profile.colour))
  })
})

describe('hazed', () => {
  it('leaves a colour alone at no share, and is the veil at full share', () => {
    const c: [number, number, number] = [0.2, 0.4, 0.6]
    expect(hazed(c, [1, 1, 1], 0, profile)).toEqual(c)
    // veil = min(1, colour + glow × light), per channel: #47655a = 71, 101, 90 of 255.
    const veil = [71 / 255 + 0.5, 101 / 255 + 0.5, 90 / 255 + 0.5].map((v) => Math.min(1, v))
    const full = hazed(c, [1, 1, 1], 1, profile)
    for (let i = 0; i < 3; i++) expect(full[i]).toBeCloseTo(veil[i] as number, 10)
  })

  it('mixes by the share, and a dark texel gets a dark veil', () => {
    const dark = hazed([0, 0, 0], [0, 0, 0], 0.5, profile)
    expect(dark[0]).toBeCloseTo((71 / 255) * 0.5, 10)
  })
})

describe('the haze pass', () => {
  it('runs after the snap, and is left out when its switch is off', () => {
    const on = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
    expect(on.haze).toBeDefined()
    expect(on.list.indexOf(on.haze as never)).toBeLessThan(on.list.indexOf(on.snap))
    const off = createLookPasses(parseLook({ switches: { haze: false } }), timeOfDay('day'))
    expect(off.haze).toBeUndefined()
  })
})
