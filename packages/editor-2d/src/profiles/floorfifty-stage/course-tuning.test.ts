import { describe, expect, it } from 'vitest'
import { COURSE_TUNABLE_NAMES, resolveCourseTuning } from './course-tuning'
import { TUNABLES } from './tunables'

// The tunables the course reads (FloorFifty `common/tuning.ts` `resolveTuning`, the 16 names `course.ts` and `demand.ts`
// use), resolved from the stage's `courseTuning` over `tuning.toml` over the declared default.

function resolved(...args: Parameters<typeof resolveCourseTuning>) {
  const result = resolveCourseTuning(...args)
  if (!result.ok) throw new Error(`not resolved: ${result.error.map((e) => e.message).join(' ')}`)
  return result.value
}

function problems(...args: Parameters<typeof resolveCourseTuning>) {
  const result = resolveCourseTuning(...args)
  if (result.ok) throw new Error('resolved')
  return result.error
}

describe('resolveCourseTuning', () => {
  it('reads the 16 tunables the course uses', () => {
    expect([...COURSE_TUNABLE_NAMES].sort()).toEqual([
      'BOUNCE_VELOCITY',
      'COURSE_FLOOR_COUNT',
      'DEATH_LINE_MARGIN',
      'DEMAND_RAMP_BAND_FLOORS',
      'DEMAND_RAMP_FROM_FLOOR',
      'FLOOR_GAP_MIN',
      'FLOOR_WIDTH',
      'GRAVITY',
      'MAX_MOVE_SPEED',
      'MOVING_FLOOR_SPEED_CAP',
      'MOVING_FLOOR_SPEED_MAX',
      'MOVING_FLOOR_SPEED_MIN',
      'MOVING_SHARE_MAX',
      'MOVING_SHARE_STEP',
      'MOVING_SPEED_STEP',
      'PLAYER_WIDTH',
    ])
  })

  it('takes the declared default of each when nothing is set', () => {
    const tuning = resolved({})
    expect(Object.keys(tuning).sort()).toEqual([...COURSE_TUNABLE_NAMES].sort())
    for (const name of COURSE_TUNABLE_NAMES) expect(tuning[name], name).toBe(TUNABLES[name]?.default)
    expect(tuning.COURSE_FLOOR_COUNT).toBe(20)
    expect(tuning.FLOOR_GAP_MIN).toBe(540 / 4.2)
  })

  it('puts the base layer over the default, and the stage’s own over the base', () => {
    const tuning = resolved({ FLOOR_WIDTH: 150 }, { baseTuning: { FLOOR_WIDTH: 100, GRAVITY: -300 } })
    expect(tuning.FLOOR_WIDTH).toBe(150)
    expect(tuning.GRAVITY).toBe(-300)
    expect(tuning.PLAYER_WIDTH).toBe(59)
  })

  it('takes a value at either end of its range', () => {
    expect(resolved({ COURSE_FLOOR_COUNT: 20 }).COURSE_FLOOR_COUNT).toBe(20)
    expect(resolved({ COURSE_FLOOR_COUNT: 100 }).COURSE_FLOOR_COUNT).toBe(100)
    expect(resolved({ GRAVITY: -1200 }).GRAVITY).toBe(-1200)
    expect(resolved({ GRAVITY: -100 }).GRAVITY).toBe(-100)
  })

  it('refuses a value out of range, naming it and its range', () => {
    expect(problems({ COURSE_FLOOR_COUNT: 19 })).toEqual([
      {
        name: 'COURSE_FLOOR_COUNT',
        message: 'COURSE_FLOOR_COUNT is 19; it must be a whole number from 20 to 100.',
      },
    ])
    expect(problems({ COURSE_FLOOR_COUNT: 101 })).toHaveLength(1)
    expect(problems({ GRAVITY: -99 })).toEqual([
      { name: 'GRAVITY', message: 'GRAVITY is -99; it must be from -1200 to -100.' },
    ])
    expect(problems({ GRAVITY: -1201 })).toHaveLength(1)
  })

  it('refuses a fraction for a whole-number tunable, and a fraction is fine for a float one', () => {
    expect(problems({ FLOOR_WIDTH: 120.5 })[0]?.message).toBe(
      'FLOOR_WIDTH is 120.5; it must be a whole number from 64 to 256.',
    )
    expect(resolved({ FLOOR_GAP_MIN: 100.5 }).FLOOR_GAP_MIN).toBe(100.5)
  })

  it('refuses a value that is not a number', () => {
    expect(problems({ FLOOR_WIDTH: Number.NaN })).toEqual([
      { name: 'FLOOR_WIDTH', message: 'FLOOR_WIDTH is not a number.' },
    ])
  })

  it('reports every bad value at once, in the order of the names', () => {
    const found = problems({ PLAYER_WIDTH: 1000, COURSE_FLOOR_COUNT: 5, GRAVITY: 0 })
    expect(found.map((p) => p.name)).toEqual(['COURSE_FLOOR_COUNT', 'PLAYER_WIDTH', 'GRAVITY'])
  })

  it('judges a bad value of the base layer only when the stage does not replace it', () => {
    expect(problems({}, { baseTuning: { FLOOR_WIDTH: 5 } }).map((p) => p.name)).toEqual(['FLOOR_WIDTH'])
    expect(resolved({ FLOOR_WIDTH: 150 }, { baseTuning: { FLOOR_WIDTH: 5 } }).FLOOR_WIDTH).toBe(150)
  })

  it('leaves the names the course does not read, and names the game does not know, to the checks', () => {
    const tuning = resolved({ SURVIVAL_RISE_START: 9999, NOT_A_TUNABLE: 1, TICK_HZ: 5 })
    expect(Object.keys(tuning)).toHaveLength(16)
  })

  it('judges against the declarations of the context', () => {
    const wider = {
      ...TUNABLES,
      COURSE_FLOOR_COUNT: { type: 'int', min: 20, max: 200, default: 30 },
    } as const
    expect(resolved({ COURSE_FLOOR_COUNT: 150 }, { tunables: wider }).COURSE_FLOOR_COUNT).toBe(150)
    expect(resolved({}, { tunables: wider }).COURSE_FLOOR_COUNT).toBe(30)
  })

  it('says so when the declarations leave out a name the course reads', () => {
    const { GRAVITY: _gravity, ...without } = TUNABLES
    expect(problems({}, { tunables: without })).toEqual([
      { name: 'GRAVITY', message: 'GRAVITY is not declared.' },
    ])
  })
})
