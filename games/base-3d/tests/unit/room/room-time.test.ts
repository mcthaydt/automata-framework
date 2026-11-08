// The time of day the level file names is the light the room is played in. The editor's Time of day picker writes it
// (`time: "night"`, or `{ "preset": "dusk", ...changes }` for a time with changes of its own), so the game must read it:
// an edit that does not show in play is not an edit.
import { timeOfDay } from '@automata/3d'
import { describe, expect, it } from 'vitest'
import { levelTime } from '#src/features/room/room-time.ts'

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
