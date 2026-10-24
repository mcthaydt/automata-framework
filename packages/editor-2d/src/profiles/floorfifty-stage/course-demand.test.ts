import { describe, expect, it } from 'vitest'
import { bounceBudget, stepDemands } from './course-demand'
import { type Course, createCourse } from './course-floors'
import { type CourseTuning, resolveCourseTuning } from './course-tuning'
import { courseGoldens } from './testing/goldens'

// How much of one bounce each step of a course asks for (FloorFifty `packages/shared/src/level/demand.ts`): 0 is a floor
// straight overhead, 1 a step no player can make. The Course view draws it as the demand strip.

function tuningOf(overrides: Record<string, number> = {}): CourseTuning {
  const result = resolveCourseTuning(overrides)
  if (!result.ok) throw new Error(result.error.map((p) => p.message).join(' '))
  return result.value
}

const standard = tuningOf()

describe('against the game', () => {
  it.each(courseGoldens().cases)(
    'gives the bounce budget and the steps of $name, seed $seed, exactly',
    (golden) => {
      const tuning = tuningOf(golden.tuning)
      expect(bounceBudget(tuning)).toBe(golden.budget)
      expect(stepDemands(createCourse(golden.seed, tuning), tuning)).toEqual(golden.demands)
    },
  )

  it('matches the slice review’s measured Rooftops steps (FloorFifty’s own test)', () => {
    const demands = stepDemands(createCourse(35229, standard), standard)
    expect(demands).toHaveLength(19)
    expect(demands[0]).toBeCloseTo(0.11, 2)
    expect(demands[6]).toBeCloseTo(0.94, 2)
    expect(demands[18]).toBeCloseTo(0.84, 2)
  })
})

describe('bounceBudget', () => {
  it('is the run of one bounce plus the width a floor and a player share', () => {
    expect(bounceBudget(standard)).toBeCloseTo(356 * (268.2 / 275) + 89.5, 1)
  })

  it('grows with speed and bounce, and shrinks with gravity', () => {
    const base = bounceBudget(standard)
    expect(bounceBudget(tuningOf({ MAX_MOVE_SPEED: 400 }))).toBeGreaterThan(base)
    expect(bounceBudget(tuningOf({ BOUNCE_VELOCITY: 300 }))).toBeGreaterThan(base)
    expect(bounceBudget(tuningOf({ GRAVITY: -400 }))).toBeLessThan(base)
    expect(bounceBudget(tuningOf({ FLOOR_WIDTH: 200 }))).toBeGreaterThan(base)
    expect(bounceBudget(tuningOf({ PLAYER_WIDTH: 90 }))).toBeGreaterThan(base)
  })
})

describe('stepDemands', () => {
  const floors = (xs: readonly number[]): Course => ({
    seed: 0,
    floorCount: xs.length,
    floors: xs.map((x, index) => ({
      id: `floor-${index}`,
      index,
      x,
      y: index * 128,
      kind: 'stationary',
      speed: 0,
      direction: 1,
    })),
    bounds: { left: -360, right: 360 },
    deathLineY: -265,
  })

  it('has one step for each floor above the first', () => {
    expect(stepDemands(floors([0]), standard)).toEqual([])
    expect(stepDemands(floors([0, 10, 20]), standard)).toHaveLength(2)
  })

  it('is 0 for a floor straight overhead and the distance over the budget otherwise', () => {
    const budget = bounceBudget(standard)
    const [straight, sideways, leftwards] = stepDemands(floors([0, 0, 100, 0]), standard)
    expect(straight).toBe(0)
    expect(sideways).toBe(100 / budget)
    expect(leftwards).toBe(100 / budget)
  })

  it('takes the short way round the screen’s wrap', () => {
    const budget = bounceBudget(standard)
    expect(stepDemands(floors([-400, 400]), standard)[0]).toBe(160 / budget)
    expect(stepDemands(floors([400, -400]), standard)[0]).toBe(160 / budget)
    expect(stepDemands(floors([-100, 380]), standard)[0]).toBe(480 / budget)
  })
})
