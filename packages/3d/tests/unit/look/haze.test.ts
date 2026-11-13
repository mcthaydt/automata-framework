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
  const lampLit = timeOfDay('lampLit')
  const night = timeOfDay('night')
  const litColour = (hex: string, time: typeof night): string =>
    `#${lightByTime(Number.parseInt(hex.slice(1), 16), time)
      .toString(16)
      .padStart(6, '0')}`
  const sum = (hex: string) =>
    [1, 3, 5].reduce((total, at) => total + Number.parseInt(hex.slice(at, at + 2), 16), 0)

  it('is the time’s own haze where the time sets one, whoever chose the profile’s colour', () => {
    const own = { ...profile, colour: '#4b5a56' }
    for (const h of [profile, own]) {
      expect(hazeAt(h, timeOfDay('day'))).toEqual(hazeOf(h, timeOfDay('day').scene.haze))
      expect(hazeAt(h, timeOfDay('dusk'))).toEqual(hazeOf(h, timeOfDay('dusk').scene.haze))
    }
  })

  it('lights the library’s own colour by a time that sets none, so the night’s veil is not a day colour', () => {
    for (const time of [night, lampLit]) {
      expect(time.scene.haze).toBeUndefined()
      expect(DEFAULT_LOOK.haze.lit).toBe(true)
      expect(hazeAt(DEFAULT_LOOK.haze, time)).toEqual({
        ...profile,
        colour: litColour(profile.colour, time),
      })
      expect(sum(hazeAt(DEFAULT_LOOK.haze, time).colour)).toBeLessThan(sum(profile.colour))
    }
  })

  it('keeps a colour a game chose as given at a time that sets none', () => {
    const chosen = '#4b5a56'
    const spread = { ...DEFAULT_LOOK.haze, colour: chosen }
    const parsed = parseLook({ haze: { colour: chosen } }).haze
    for (const h of [spread, parsed])
      for (const time of [night, lampLit, timeOfDay('bar')]) expect(hazeAt(h, time).colour).toBe(chosen)
  })

  it('lights a game’s colour only when the game says `lit`', () => {
    const chosen = '#4b5a56'
    const h = parseLook({ haze: { colour: chosen, lit: true } }).haze
    expect(hazeAt(h, night).colour).toBe(litColour(chosen, night))
  })
})

describe('the library’s haze colour', () => {
  it('is the default’s, kept through a partial override that leaves the colour alone', () => {
    expect(parseLook({}).haze.lit).toBe(true)
    expect(parseLook({ haze: { far: 6 } }).haze.lit).toBe(true)
  })

  it('is not carried by copying the profile, nor by writing a colour of one’s own', () => {
    expect({ ...DEFAULT_LOOK.haze }.lit).toBeUndefined()
    expect(parseLook({ haze: { colour: '#47655a' } }).haze.lit).toBeUndefined()
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
  // The veil's colour as the pass holds it, per channel (the pass keeps its uniforms to itself).
  const veilOf = (pass: unknown): number[] => {
    const { uR, uG, uB } = (pass as { uniforms: { uniforms: Record<string, number> } }).uniforms.uniforms
    return [uR, uG, uB].map((v) => Math.round((v as number) * 255))
  }

  it('gets a game’s own haze colour exactly, at the times that set no haze, and the library’s colour lit', () => {
    const own = parseLook({ haze: { colour: '#4b5a56' } })
    for (const name of ['night', 'lampLit', 'bar'])
      expect(veilOf(createLookPasses(own, timeOfDay(name)).haze)).toEqual([0x4b, 0x5a, 0x56])
    const night = timeOfDay('night')
    const lit = lightByTime(0x47655a, night)
    expect(veilOf(createLookPasses(DEFAULT_LOOK, night).haze)).toEqual([
      (lit >> 16) & 255,
      (lit >> 8) & 255,
      lit & 255,
    ])
  })

  it('runs after the snap, and is left out when its switch is off', () => {
    const on = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
    expect(on.haze).toBeDefined()
    expect(on.list.indexOf(on.haze as never)).toBeLessThan(on.list.indexOf(on.snap))
    const off = createLookPasses(parseLook({ switches: { haze: false } }), timeOfDay('day'))
    expect(off.haze).toBeUndefined()
  })
})
