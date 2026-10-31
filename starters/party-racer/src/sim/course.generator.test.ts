import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { describe, expect, it } from 'vitest'
import { PLACEHOLDER_COURSE_SEED, PLACEHOLDER_TUNING } from '../content/placeholder.content'
import { PLACEHOLDER_COURSE_HASH } from '../testing/goldens'
import { createCourse } from './course.generator'

const tuning = PLACEHOLDER_TUNING
const tall = { ...tuning, floorCount: 200 }

describe('createCourse', () => {
  it('starts every course on the same fixed, stationary floor', () => {
    for (const seed of [1, 2, 3])
      expect(createCourse(seed, tuning).floors[0]).toEqual({ index: 0, x: 0, y: 0, moving: false, speed: 0 })
  })

  it('builds floorCount floors, each one gap above the one below', () => {
    const { floors } = createCourse(7, tuning)
    expect(floors.map((f) => f.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    for (let i = 1; i < floors.length; i++)
      expect(floors[i]?.y).toBe((floors[i - 1]?.y ?? Number.NaN) + tuning.floorGap)
  })

  it('keeps floor centres inside the bounds, one floor width in from the wrap', () => {
    const course = createCourse(7, tall)
    const limit = tuning.viewportWidth / 2 - tuning.floorWidth
    expect(course.bounds).toEqual({ left: -limit, right: limit })
    for (const floor of course.floors) {
      expect(floor.x).toBeGreaterThanOrEqual(course.bounds.left)
      expect(floor.x).toBeLessThan(course.bounds.right)
    }
  })

  it('makes some floors moving, at a speed in the tuning range, and the others still', () => {
    const { floors } = createCourse(7, tall)
    const moving = floors.filter((f) => f.moving)
    expect(moving.length).toBeGreaterThan(60)
    expect(moving.length).toBeLessThan(140)
    for (const f of moving) {
      expect(f.speed).toBeGreaterThanOrEqual(tuning.movingSpeedMin)
      expect(f.speed).toBeLessThan(tuning.movingSpeedMax)
    }
    for (const f of floors.filter((f) => !f.moving)) expect(f.speed).toBe(0)
  })

  it('puts the death line deathLineMargin below the start floor', () => {
    expect(createCourse(7, tuning).deathLineY).toBe(-tuning.deathLineMargin)
  })

  it('is prefix-stable: the first n floors of a tall course are the course of n floors', () => {
    expect(createCourse(7, tall).floors.slice(0, tuning.floorCount)).toEqual(createCourse(7, tuning).floors)
  })

  it('gives a different course for a different seed', () => {
    expect(createCourse(8, tuning).floors).not.toEqual(createCourse(7, tuning).floors)
  })

  // The placeholder course, pinned: recorded from Node, and checked in every browser by the parity test.
  it('pins the placeholder course', () => {
    const course = createCourse(PLACEHOLDER_COURSE_SEED, tuning)
    expect(hex64(xxhash64(utf8(canonicalJson(course))))).toBe(PLACEHOLDER_COURSE_HASH)
  })
})
