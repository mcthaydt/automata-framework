// One time of day (spec 6): the figure source's and the environment source's six shared names merged into one
// library, each entry holding the scene's light, haze and grade, the figure's key and steps, and the label the
// editor shows.

import { describe, expect, it } from 'vitest'
import { FIGURE_KEY, timeOfDaySchema } from '#src/shared/time-of-day/time-of-day.schema.ts'
import { TIMES, timeOfDay } from '#src/shared/time-of-day/time-of-day.ts'

describe('the times of day', () => {
  it('merges the six times of day', () => {
    expect(TIMES.map((t) => t.name)).toEqual(['day', 'golden', 'dusk', 'night', 'lampLit', 'bar'])
    expect(timeOfDay('dusk').figure.key).toBeDefined()
  })
  it('says them in the editor’s words', () => {
    expect(TIMES.map((t) => t.label)).toEqual([
      'Day',
      'Golden hour',
      'Dusk',
      'Night',
      'Lamplight',
      'Bar light',
    ])
  })
  it('keeps every number from the figure source: exposure, the cast’s lift, the ambient tint', () => {
    expect(timeOfDay('night').figure).toEqual({ exposure: -2, lift: 1, key: FIGURE_KEY })
    expect(timeOfDay('night').scene.grade).toEqual({ tint: '#3d5083', amount: 0.35 })
    expect(timeOfDay('day').figure).toEqual({ exposure: 0, lift: 0, key: FIGURE_KEY })
  })
  it('keeps every number from the environment source: light, haze, sky', () => {
    const day = timeOfDay('day').scene
    expect(day.light.sun).toEqual({ level: 1, colour: '#fff3d6' })
    expect(day.haze).toEqual({ colour: '#8690b2', amount: 0.35 })
    expect(day.sky).toHaveLength(5)
    expect(timeOfDay('night').scene.stars).toBe(0.006)
    expect(timeOfDay('bar').scene.light.shadow).toBe(false)
  })
  it('lets a level override a part of a time without touching the library', () => {
    const dim = timeOfDay('day', { figure: { exposure: -1 } })
    expect(dim.figure.exposure).toBe(-1)
    expect(dim.figure.key).toEqual(FIGURE_KEY)
    expect(timeOfDay('day').figure.exposure).toBe(0)
  })
  it('names the times there are when asked for one that is not', () => {
    expect(() => timeOfDay('teatime')).toThrow(
      'There is no time of day called "teatime" (day, golden, dusk, night, lampLit, bar)',
    )
  })
  it('refuses an entry whose colour is not a hex colour, at the field', () => {
    const read = timeOfDaySchema.safeParse({
      ...timeOfDay('day'),
      scene: { ...timeOfDay('day').scene, grade: { tint: 'blue', amount: 0.1 } },
    })
    expect(read.success).toBe(false)
    expect(JSON.stringify(read.error?.issues[0]?.path)).toBe('["scene","grade","tint"]')
  })
})
