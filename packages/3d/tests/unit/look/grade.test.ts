// The mood grade: a mood moves every colour in OKLab (lightness scaled, chroma scaled, a and b shifted, a pull toward a
// colour) before the snap, so what comes out is snapped back onto the palette. The rules are pure; the pass repeats them.
import { describe, expect, it } from 'vitest'
import { gradeColour, IDENTITY, MOODS, mixMoods, moodOf, registerMood } from '#src/features/look/grade.ts'
import { oklab } from '#src/shared/math/colour.ts'

const channels = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255]

describe('gradeColour', () => {
  it('leaves a colour alone under the identity mood', () => {
    for (const c of [0x000000, 0xf5f7fa, 0x7a7799, 0xffbc4e, 0x328ca7])
      expect(channels(gradeColour(c, IDENTITY))).toEqual(channels(c))
  })

  it('warms a colour under warm night: its b rises and its a does too, its lightness is kept', () => {
    const before = oklab(0x7a7799)
    const after = oklab(gradeColour(0x7a7799, MOODS.warmNight as never))
    expect(after[2]).toBeGreaterThan(before[2])
    expect(after[1]).toBeGreaterThan(before[1])
    expect(after[0]).toBeCloseTo(before[0], 1)
  })

  it('cools a colour under cold dawn: its b falls and it is lighter', () => {
    const before = oklab(0x96b2d9)
    const after = oklab(gradeColour(0x96b2d9, MOODS.coldDawn as never))
    expect(after[2]).toBeLessThan(before[2])
    expect(after[0]).toBeGreaterThan(before[0])
  })

  it('pulls a and b toward the mood’s pull colour by its amount', () => {
    const mood = { L: 1, a: 0, b: 0, chroma: 1, pull: [0, 0.05, 0.1, 1] as [number, number, number, number] }
    const lab = oklab(gradeColour(0x7a7799, mood))
    expect(lab[1]).toBeCloseTo(0.05, 1)
    expect(lab[2]).toBeCloseTo(0.1, 1)
  })
})

describe('moods', () => {
  it('has the three built in, and takes more by name without changing the built-ins', () => {
    expect(Object.keys(MOODS)).toEqual(['warmNight', 'coldDawn', 'sodium'])
    registerMood('teal', { L: 1, a: -0.02, b: -0.01, chroma: 1 })
    expect(moodOf('teal')?.a).toBe(-0.02)
    expect(moodOf('warmNight')).toBe(MOODS.warmNight)
    expect(moodOf('nope')).toBeUndefined()
  })

  it('mixes two moods, none being the identity', () => {
    const half = mixMoods(undefined, MOODS.coldDawn, 0.5)
    expect(half.L).toBeCloseTo(1.015, 5)
    expect(half.b).toBeCloseTo(-0.0175, 5)
    expect(mixMoods(MOODS.warmNight, MOODS.warmNight, 0.3).chroma).toBeCloseTo(1.03, 5)
  })
})
