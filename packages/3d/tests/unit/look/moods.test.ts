import { describe, expect, it } from 'vitest'
import { MOODS, moodRemap } from '#src/features/look/moods.ts'
import { DUEL } from '#src/shared/math/duel.ts'

/** The mean OKLab b of the palette after a remap: positive is yellower. */
const meanB = (remap: Uint8Array): number =>
  remap.reduce((sum, to) => sum + (DUEL[to]?.lab[2] ?? 0), 0) / remap.length

describe('the moods', () => {
  it('names the three the source registered', () => {
    expect(Object.keys(MOODS).sort()).toEqual(['coldDawn', 'sodium', 'warmNight'])
  })

  it('map DUEL to DUEL: every entry of a remap is an index into the 256 colours', () => {
    expect(DUEL.length).toBe(256)
    for (const mood of [undefined, ...Object.values(MOODS)]) {
      const remap = moodRemap(mood)
      expect(remap.length).toBe(256)
      expect([...remap].every((to) => to >= 0 && to < 256)).toBe(true)
    }
  })

  it('no mood is the identity', () => {
    expect([...moodRemap(undefined)]).toEqual(Array.from({ length: 256 }, (_, i) => i))
  })

  it('move the palette the way they say: a warm night toward yellow, a cold dawn toward blue', () => {
    const none = meanB(moodRemap(undefined))
    expect(meanB(moodRemap(MOODS.warmNight))).toBeGreaterThan(none)
    expect(meanB(moodRemap(MOODS.coldDawn))).toBeLessThan(none)
  })
})
