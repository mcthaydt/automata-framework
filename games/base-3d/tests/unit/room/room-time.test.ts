// The time of day the level file names is the light the room is played in. The editor's Time of day picker writes it
// (`time: "night"`, or `{ "preset": "dusk", ...changes }` for a time with changes of its own), so the game must read it:
// an edit that does not show in play is not an edit.
import { timeOfDay } from '@automata/3d'
import { describe, expect, it } from 'vitest'
import { levelTime, timeShade } from '#src/features/room/room-time.ts'

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

// The look has no light of its own from a time of day (core's `time` only reaches the passes extensions add), so base-3d
// reads the time's ambient light as how bright the room's own colours are: the day is the room as drawn, night is dim.
describe('timeShade', () => {
  it('is 1 for the day, so a level that says nothing, or "day", looks as it always has', () => {
    expect(timeShade(timeOfDay('day'))).toBe(1)
  })

  it('is darker at night than at dusk, and dusk is no brighter than the day', () => {
    expect(timeShade(timeOfDay('night'))).toBeLessThan(timeShade(timeOfDay('dusk')))
    expect(timeShade(timeOfDay('dusk'))).toBeLessThanOrEqual(1)
    expect(timeShade(timeOfDay('night'))).toBeGreaterThanOrEqual(0.4)
  })

  it('follows a time’s own changes to its ambient level', () => {
    const dim = levelTime({
      preset: 'day',
      scene: { light: { ...timeOfDay('day').scene.light, ambient: { level: 0.1, tint: '#ffffff' } } },
    })
    expect(timeShade(dim)).toBeLessThan(0.6)
    expect(timeShade(dim)).toBeGreaterThanOrEqual(0.4)
  })
})
