// The light a time of day casts on a game's own colours, and the time a level file names. Core owns both so every game
// (and the editor's views) plays a level in the light its file says: an edit that does not show in play is not an edit.
import { describe, expect, it } from 'vitest'
import { levelTime, lightByTime } from '#src/shared/time-of-day/time-light.ts'
import { timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

const channels = (colour: number): [number, number, number] => [
  (colour >> 16) & 0xff,
  (colour >> 8) & 0xff,
  colour & 0xff,
]
const brightness = (colour: number): number => channels(colour).reduce((sum, c) => sum + c, 0)

describe('levelTime', () => {
  it('is the day when the level names no time', () => {
    expect(levelTime(undefined)).toEqual(timeOfDay('day'))
  })

  it('is the library’s time for a name', () => {
    expect(levelTime('night')).toEqual(timeOfDay('night'))
    expect(levelTime('lampLit').name).toBe('lampLit')
  })

  it('keeps a time’s own changes over its preset', () => {
    const time = levelTime({ preset: 'dusk', scene: { grade: { tint: '#112233', amount: 0.5 } } })
    expect(time.name).toBe('dusk')
    expect(time.scene.grade).toEqual({ tint: '#112233', amount: 0.5 })
    expect(time.scene.light).toEqual(timeOfDay('dusk').scene.light)
  })

  it('is the day for a time with changes and no preset', () => {
    expect(levelTime({ figure: { exposure: 1 } }).figure.exposure).toBe(1)
    expect(levelTime({ figure: { exposure: 1 } }).name).toBe('day')
  })

  it('says which times there are for a name the library lacks', () => {
    expect(() => levelTime('midnight')).toThrow(/no time of day called "midnight"/)
  })
})

describe('lightByTime', () => {
  const ROOM = [0xcdd2da, 0x8690b2, 0xffb108, 0x31222a]

  it('leaves a colour as it is by day, so a game drawn by day looks as it always did', () => {
    for (const colour of ROOM) expect(lightByTime(colour, timeOfDay('day'))).toBe(colour)
  })

  it('makes the colour darker through the evening and the night', () => {
    const lit = (name: string) => brightness(lightByTime(0xcdd2da, timeOfDay(name)))
    expect(lit('golden')).toBeLessThan(lit('day'))
    expect(lit('dusk')).toBeLessThan(lit('golden'))
    expect(lit('night')).toBeLessThan(lit('dusk'))
  })

  it('tells the six times apart: each is a different colour on the same wall', () => {
    const walls = ['day', 'golden', 'dusk', 'night', 'lampLit', 'bar'].map((name) =>
      lightByTime(0xcdd2da, timeOfDay(name)),
    )
    expect(new Set(walls).size).toBe(6)
    // Not just a brightness: any two times are at least 12 apart in some channel (out of 255).
    for (let a = 0; a < walls.length; a++)
      for (let b = a + 1; b < walls.length; b++) {
        const [x, y] = [channels(walls[a] as number), channels(walls[b] as number)]
        expect(Math.max(...x.map((c, i) => Math.abs(c - (y[i] as number))))).toBeGreaterThanOrEqual(12)
      }
  })

  it('makes golden hour golden: red stays high and blue falls away', () => {
    const [r, , b] = channels(lightByTime(0xcdd2da, timeOfDay('golden')))
    expect(r).toBeGreaterThan(b + 40)
  })

  it('makes the night blue rather than only grey', () => {
    const [r, , b] = channels(lightByTime(0xcdd2da, timeOfDay('night')))
    expect(b).toBeGreaterThan(r)
  })

  it('never goes black: the player can still see the floor they have to cross', () => {
    for (const name of ['night', 'bar']) {
      const [r, g, b] = channels(lightByTime(0xffffff, timeOfDay(name)))
      expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(0x30)
    }
  })

  it('follows a time’s own changes to its ambient light', () => {
    const dim = levelTime({
      preset: 'day',
      scene: { light: { ...timeOfDay('day').scene.light, ambient: { level: 0.1, tint: '#c7d6ff' } } },
    })
    expect(brightness(lightByTime(0xcdd2da, dim))).toBeLessThan(
      brightness(lightByTime(0xcdd2da, timeOfDay('dusk'))),
    )
  })
})
