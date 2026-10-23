import { describe, expect, it } from 'vitest'
import { AUTHORING_INVARIANTS, courseTopFloor, TUNABLES } from './tunables'

// The tunable declarations vendored from FloorFifty (`packages/shared/src/common/tuning.ts` at ee5d44e): what a stage's
// `courseTuning` may name, the range of each and the default a missing name takes.

describe('TUNABLES', () => {
  it('declares the 35 tunables of the game', () => {
    expect(Object.keys(TUNABLES)).toHaveLength(35)
  })

  it.each([
    ['COURSE_FLOOR_COUNT', { type: 'int', min: 20, max: 100, default: 20 }],
    ['GRAVITY', { type: 'float', min: -1200, max: -100, default: -275 }],
    ['BOUNCE_VELOCITY', { type: 'float', min: 100, max: 1200, default: 268.2 }],
    ['FLOOR_GAP_MIN', { type: 'float', min: 40, max: 200, default: 540 / 4.2 }],
    ['RACE_TIME_LIMIT_TICKS', { type: 'int', min: 0, max: 36_000, default: 0 }],
    ['SURVIVAL_PUSH_AT', { type: 'float', min: 0.3, max: 0.9, default: 0.55 }],
    ['MOVING_FLOOR_SPEED_CAP', { type: 'float', min: 0, max: 400, default: 300 }],
  ] as const)('declares %s as the game does', (name, declaration) => {
    expect(TUNABLES[name]).toEqual(declaration)
  })

  it('keeps every default inside its range and every whole-number tunable whole', () => {
    for (const [name, declaration] of Object.entries(TUNABLES)) {
      expect(declaration.min, name).toBeLessThanOrEqual(declaration.default)
      expect(declaration.default, name).toBeLessThanOrEqual(declaration.max)
      if (declaration.type === 'int')
        for (const bound of [declaration.min, declaration.max, declaration.default])
          expect(Number.isInteger(bound), `${name} ${bound}`).toBe(true)
    }
  })
})

describe('AUTHORING_INVARIANTS', () => {
  it('lists the code-only names an author might try, none of them a tunable', () => {
    expect(AUTHORING_INVARIANTS).toContain('TICK_HZ')
    expect(AUTHORING_INVARIANTS).toContain('MAX_PLAYERS')
    expect(AUTHORING_INVARIANTS).toHaveLength(11)
    for (const name of AUTHORING_INVARIANTS) expect(TUNABLES).not.toHaveProperty(name)
  })
})

describe('courseTopFloor', () => {
  it('is one below the declared floor count when nothing overrides it', () => {
    expect(courseTopFloor(TUNABLES, {}, {})).toBe(19)
  })

  it('takes the base tuning, and the stage on top of it', () => {
    expect(courseTopFloor(TUNABLES, { COURSE_FLOOR_COUNT: 25 }, {})).toBe(24)
    expect(courseTopFloor(TUNABLES, { COURSE_FLOOR_COUNT: 25 }, { COURSE_FLOOR_COUNT: 31 })).toBe(30)
  })

  it('is undefined when the count is out of range or not whole, which tunableRange reports', () => {
    expect(courseTopFloor(TUNABLES, {}, { COURSE_FLOOR_COUNT: 19 })).toBeUndefined()
    expect(courseTopFloor(TUNABLES, {}, { COURSE_FLOOR_COUNT: 101 })).toBeUndefined()
    expect(courseTopFloor(TUNABLES, {}, { COURSE_FLOOR_COUNT: 20.5 })).toBeUndefined()
    expect(courseTopFloor(TUNABLES, {}, { COURSE_FLOOR_COUNT: Number.NaN })).toBeUndefined()
  })

  it('accepts the bounds of the range', () => {
    expect(courseTopFloor(TUNABLES, {}, { COURSE_FLOOR_COUNT: 20 })).toBe(19)
    expect(courseTopFloor(TUNABLES, {}, { COURSE_FLOOR_COUNT: 100 })).toBe(99)
  })

  it('starts from the declared default, not the bottom of the range', () => {
    const declarations = { COURSE_FLOOR_COUNT: { type: 'int', min: 10, max: 50, default: 30 } } as const
    expect(courseTopFloor(declarations, {}, {})).toBe(29)
  })

  it('has no top when the declarations do not know the count', () => {
    expect(courseTopFloor({}, {}, {})).toBeUndefined()
  })
})
