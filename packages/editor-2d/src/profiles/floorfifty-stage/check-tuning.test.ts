import { describe, expect, it } from 'vitest'
import { checkTuning } from './check-tuning'
import { resolveContext, type StageCheckContext } from './check-types'
import { minimal } from './testing/check-docs'
import { setAt } from './testing/stage-texts'

// A stage's `courseTuning` against the tunable declarations (FloorFifty `validate/bounds.ts`): the name must be a
// tunable, an author-facing invariant is refused with its own words, and the value must be in range and, for a whole-number
// tunable, whole.

const error = (code: string, path: string, message: string) => ({ severity: 'error', code, path, message })

const check = (tuning: Record<string, number>, context: StageCheckContext = {}) =>
  checkTuning(setAt(minimal(), ['courseTuning'], tuning), resolveContext(context))

describe('names', () => {
  it('accepts a stage with no overrides, and tunables at their bounds', () => {
    expect(check({})).toEqual([])
    expect(check({ COURSE_FLOOR_COUNT: 20, GRAVITY: -1200, MOVING_FLOOR_CARRY: 1 })).toEqual([])
    expect(check({ COURSE_FLOOR_COUNT: 100, GRAVITY: -100, MOVING_FLOOR_CARRY: 0 })).toEqual([])
  })

  it('says a code-only invariant cannot be set, rather than that it does not exist', () => {
    expect(check({ TICK_HZ: 60 })).toEqual([
      error(
        'codeOnlyTunable',
        'courseTuning.TICK_HZ',
        'TICK_HZ is fixed in the game’s code; a stage cannot set it.',
      ),
    ])
  })

  it('names a tunable close to a misspelt one', () => {
    expect(check({ GRAVTY: -300 })).toEqual([
      error('unknownTunable', 'courseTuning.GRAVTY', '"GRAVTY" is not a tunable. Did you mean "GRAVITY"?'),
    ])
  })

  it('offers no guess for a name that is nothing like a tunable', () => {
    expect(check({ SOMETHING_ELSE_ENTIRELY: 1 })).toEqual([
      error(
        'unknownTunable',
        'courseTuning.SOMETHING_ELSE_ENTIRELY',
        '"SOMETHING_ELSE_ENTIRELY" is not a tunable.',
      ),
    ])
  })

  it('judges every name against the declarations it is given', () => {
    const tunables = { WIND: { type: 'float', min: 0, max: 1, default: 0.5 } } as const
    expect(check({ WIND: 0.2 }, { tunables })).toEqual([])
    expect(check({ GRAVITY: -300 }, { tunables }).map((f) => f.code)).toEqual(['unknownTunable'])
  })
})

describe('values', () => {
  it.each([
    [{ GRAVITY: -5000 }, 'GRAVITY', 'GRAVITY is -5000; it must be from -1200 to -100.'],
    [{ GRAVITY: -99.9 }, 'GRAVITY', 'GRAVITY is -99.9; it must be from -1200 to -100.'],
    [
      { COURSE_FLOOR_COUNT: 19 },
      'COURSE_FLOOR_COUNT',
      'COURSE_FLOOR_COUNT is 19; it must be a whole number from 20 to 100.',
    ],
    [
      { COURSE_FLOOR_COUNT: 101 },
      'COURSE_FLOOR_COUNT',
      'COURSE_FLOOR_COUNT is 101; it must be a whole number from 20 to 100.',
    ],
    [
      { COURSE_FLOOR_COUNT: 30.5 },
      'COURSE_FLOOR_COUNT',
      'COURSE_FLOOR_COUNT is 30.5; it must be a whole number from 20 to 100.',
    ],
    [{ MOVING_FLOOR_CARRY: 1.5 }, 'MOVING_FLOOR_CARRY', 'MOVING_FLOOR_CARRY is 1.5; it must be from 0 to 1.'],
  ])('refuses %j', (tuning, name, message) => {
    expect(check(tuning)).toEqual([error('tunableRange', `courseTuning.${name}`, message)])
  })

  it('says a value that is not a number is not a number', () => {
    expect(check({ GRAVITY: Number.NaN })).toEqual([
      error('tunableRange', 'courseTuning.GRAVITY', 'GRAVITY is not a number.'),
    ])
    expect(check({ COURSE_FLOOR_COUNT: Number.POSITIVE_INFINITY }).map((f) => f.code)).toEqual([
      'tunableRange',
    ])
  })

  it('reports each override, in the order the stage lists them', () => {
    expect(check({ GRAVTY: 1, GRAVITY: -5000, TICK_HZ: 5 }).map((f) => f.path)).toEqual([
      'courseTuning.GRAVTY',
      'courseTuning.GRAVITY',
      'courseTuning.TICK_HZ',
    ])
  })
})
