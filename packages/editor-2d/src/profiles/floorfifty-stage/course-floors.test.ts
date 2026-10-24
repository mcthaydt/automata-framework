import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { courseBounds, createCourse, rampBand, VIEWPORT_WIDTH } from './course-floors'
import { type CourseTuning, resolveCourseTuning } from './course-tuning'
import { courseGoldens } from './testing/goldens'

// The seeded course (FloorFifty `packages/shared/src/level/course.ts`), ported for the Course view (2D editor spec
// §10.5). The goldens are the game's own output for nine seeds and tunings; the other tests are the game's own claims.

function tuningOf(overrides: Record<string, number> = {}): CourseTuning {
  const result = resolveCourseTuning(overrides)
  if (!result.ok) throw new Error(result.error.map((p) => p.message).join(' '))
  return result.value
}

const standard = tuningOf()
const tall = tuningOf({ COURSE_FLOOR_COUNT: 100 })

describe('createCourse against the game', () => {
  it.each(courseGoldens().cases)('gives the course of $name, seed $seed, exactly', (golden) => {
    const course = createCourse(golden.seed, tuningOf(golden.tuning))
    expect(course.seed).toBe(golden.seed)
    expect(course.floorCount).toBe(golden.floorCount)
    expect(course.bounds).toEqual(golden.bounds)
    expect(course.deathLineY).toBe(golden.deathLineY)
    expect(course.floors.map((f) => [f.index, f.x, f.y, f.kind, f.speed, f.direction])).toEqual(golden.floors)
  })

  // Measured in FloorFifty at b7b3513, before the demand ramp existed (`tests/shared/level/ramp.test.ts`): the hash of
  // the first fifty floors as the game's own objects, so the key order of a floor counts too.
  it.each([
    [35229, '70f907b132cf89daeafa64dacf034c042e3d32236e8e75762d91861b59aee081'],
    [34528, '70e62ba16c4d6ece9613fd2b93671a2544ebc8eafd1f683344567ed0353f4587'],
    [107255, 'a4cbb79973b51c5e596c0b3c6e8d120107edd2114f4bed588235f036183b8159'],
  ])('leaves seed %s’s floors 0 to 49 as the game drew them before the ramp', (seed, hash) => {
    const floors = createCourse(seed, tuningOf({ COURSE_FLOOR_COUNT: 50 })).floors
    expect(createHash('sha256').update(JSON.stringify(floors)).digest('hex')).toBe(hash)
  })
})

describe('createCourse', () => {
  it('draws the same course from the same seed and another from another seed', () => {
    expect(createCourse(4182, standard)).toEqual(createCourse(4182, standard))
    expect(createCourse(4182, standard)).not.toEqual(createCourse(4183, standard))
  })

  it('has as many floors as COURSE_FLOOR_COUNT', () => {
    expect(createCourse(4182, standard).floors).toHaveLength(20)
    expect(createCourse(4182, tall).floors).toHaveLength(100)
    expect(createCourse(4182, standard).floorCount).toBe(20)
  })

  it('keeps the first n floors of a tall course those of an n-floor course', () => {
    const short = createCourse(4182, standard)
    expect(createCourse(4182, tall).floors.slice(0, short.floors.length)).toEqual(short.floors)
  })

  it('anchors a fixed starting floor, and builds the others upward from it', () => {
    const course = createCourse(4182, standard)
    expect(course.floors[0]).toEqual({
      id: 'floor-0',
      index: 0,
      x: 0,
      y: 0,
      kind: 'stationary',
      speed: 0,
      direction: 1,
    })
    expect(course.floors[1]?.id).toBe('floor-1')
    expect(course.floors[1]?.y).toBeGreaterThan(0)
  })

  it('keeps every floor inside the horizontal bounds', () => {
    const course = createCourse(4182, tall)
    for (const floor of course.floors) {
      expect(floor.x).toBeGreaterThanOrEqual(course.bounds.left)
      expect(floor.x).toBeLessThanOrEqual(course.bounds.right)
    }
  })

  it('places each floor one FLOOR_GAP_MIN above the one below', () => {
    const gap = tuningOf({ FLOOR_GAP_MIN: 100 })
    const course = createCourse(99, gap)
    course.floors.forEach((floor, index) => {
      expect(floor.y).toBeCloseTo(index * 100, 9)
    })
  })

  it('puts the death line DEATH_LINE_MARGIN below the starting floor', () => {
    expect(createCourse(4182, standard).deathLineY).toBe(-265)
    expect(createCourse(4182, tuningOf({ DEATH_LINE_MARGIN: 400 })).deathLineY).toBe(-400)
  })

  it('gives a moving floor a speed within the range, and a stationary floor none', () => {
    const course = createCourse(4182, standard)
    const moving = course.floors.filter((floor) => floor.kind === 'moving')
    expect(moving.length).toBeGreaterThan(0)
    for (const floor of course.floors) {
      if (floor.kind === 'stationary') expect(floor.speed).toBe(0)
      else {
        expect(floor.speed).toBeGreaterThanOrEqual(100)
        expect(floor.speed).toBeLessThan(200)
      }
    }
  })

  it('starts every moving floor to the right', () => {
    for (const floor of createCourse(4182, tall).floors) expect(floor.direction).toBe(1)
  })
})

describe('courseBounds', () => {
  it('insets the screen by a whole floor width on each side, not half', () => {
    expect(VIEWPORT_WIDTH).toBe(960)
    expect(courseBounds(standard)).toEqual({ left: -360, right: 360 })
    expect(courseBounds(tuningOf({ FLOOR_WIDTH: 200 }))).toEqual({ left: -280, right: 280 })
  })
})

describe('rampBand', () => {
  it('is 0 below the ramp, then 1, 2, … every DEMAND_RAMP_BAND_FLOORS', () => {
    expect([0, 49, 50, 59, 60, 99].map((index) => rampBand(index, standard))).toEqual([0, 0, 1, 1, 2, 5])
  })

  it('starts at DEMAND_RAMP_FROM_FLOOR and bands by DEMAND_RAMP_BAND_FLOORS', () => {
    const steep = tuningOf({ DEMAND_RAMP_FROM_FLOOR: 60, DEMAND_RAMP_BAND_FLOORS: 3 })
    expect([59, 60, 62, 63, 66].map((index) => rampBand(index, steep))).toEqual([0, 1, 1, 2, 3])
  })
})

describe('the demand ramp', () => {
  it('raises the share of moving floors by its step per band, up to its cap', () => {
    const share = (overrides: Record<string, number>, band: number): number => {
      const ramped = tuningOf({ COURSE_FLOOR_COUNT: 100, ...overrides })
      let moving = 0
      let total = 0
      for (let seed = 0; seed < 400; seed++)
        for (const floor of createCourse(seed * 7919 + 13, ramped).floors) {
          if (rampBand(floor.index, ramped) !== band) continue
          total++
          if (floor.kind === 'moving') moving++
        }
      return moving / total
    }
    expect(Math.abs(share({}, 1) - 0.55)).toBeLessThan(0.03)
    expect(Math.abs(share({}, 5) - 0.75)).toBeLessThan(0.03)
    expect(Math.abs(share({ MOVING_SHARE_STEP: 0.5, MOVING_SHARE_MAX: 0.8 }, 3) - 0.8)).toBeLessThan(0.03)
  })

  it('raises the speed by its step per band, up to its cap', () => {
    const ramped = tuningOf({ COURSE_FLOOR_COUNT: 100, MOVING_SPEED_STEP: 100, MOVING_FLOOR_SPEED_CAP: 250 })
    const moving = createCourse(35229, ramped).floors.filter((f) => f.kind === 'moving' && f.index >= 50)
    expect(moving.length).toBeGreaterThan(5)
    for (const floor of moving) {
      // Band 1 draws from 200 to the cap; from band 2 on both ends are the cap.
      expect(floor.speed).toBeGreaterThanOrEqual(200)
      expect(floor.speed).toBeLessThanOrEqual(250)
      if (rampBand(floor.index, ramped) >= 2) expect(floor.speed).toBe(250)
    }
  })
})
