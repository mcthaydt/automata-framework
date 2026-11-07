import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { checkTuning, checkTuningLayer } from '#src/shared/tuning/check-tuning.ts'
import { FIXTURES, INVARIANTS, TUNABLE_DEFAULTS, TUNABLES } from '#src/testing/fixture-game.ts'

const declared = { tunables: TUNABLES, invariants: INVARIANTS }
const shippedTuning = parse(readFileSync(join(FIXTURES, 'valid/content/tuning.toml'), 'utf8'))

// Ported from FloorFifty tests/content/validate/bounds.test.ts (122a220).
describe('checkTuning with code-owned declarations (FloorFifty)', () => {
  it("accepts FloorFifty's shipped tuning.toml and keeps its values", () => {
    const result = checkTuning(shippedTuning, declared)
    expect(result.problems).toEqual([])
    expect(result.values['GRAVITY']).toBe(-275)
    expect(result.values['FLOOR_GAP_MIN']).toBe(128.57142857142856)
    expect(result.meta['GRAVITY']).toEqual({ type: 'float', value: -275, min: -1200, max: -100 })
  })

  it('accepts a base transcribed from the declarations', () => {
    expect(checkTuning(TUNABLE_DEFAULTS, declared).problems).toEqual([])
  })

  it('requires a complete base', () => {
    expect(checkTuning({}, declared).problems).toContainEqual({
      path: ['COURSE_FLOOR_COUNT'],
      code: 'missingField',
      message: 'base tuning must declare COURSE_FLOOR_COUNT',
    })
  })

  it('refuses a value that is not a finite number (FloorFifty), for games that layer tuning themselves', () => {
    const layer = (gravity: number) => checkTuningLayer({ GRAVITY: gravity }, declared, { complete: false })
    for (const gravity of [Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(layer(gravity)).toEqual([
        {
          path: ['GRAVITY'],
          code: 'invalidType',
          message: `GRAVITY must be a finite number, received ${gravity}`,
        },
      ])
    }
  })

  it('checks partial layers for type, range, unknown names and invariants', () => {
    const layer = (values: Record<string, unknown>) => checkTuningLayer(values, declared, { complete: false })
    expect(layer({ COURSE_FLOOR_COUNT: 20.5 })).toEqual([
      {
        path: ['COURSE_FLOOR_COUNT'],
        code: 'invalidType',
        message: 'COURSE_FLOOR_COUNT is declared int, received 20.5',
      },
    ])
    expect(layer({ TICK_HZ: 30 })).toEqual([
      {
        path: ['TICK_HZ'],
        code: 'invariantNotAuthorable',
        message: 'TICK_HZ is a code-only invariant and cannot be authored',
      },
    ])
    expect(layer({ GRAVTIY: -275 })).toEqual([
      { path: ['GRAVTIY'], code: 'unknownField', message: 'unknown tunable: GRAVTIY' },
    ])
    expect(layer({ GRAVITY: 'heavy' })).toEqual([
      { path: ['GRAVITY'], code: 'invalidType', message: 'GRAVITY must be a number' },
    ])
  })

  it('accepts inclusive endpoints and refuses one step beyond', () => {
    const layer = (gravity: number) => checkTuningLayer({ GRAVITY: gravity }, declared, { complete: false })
    expect(layer(-1200)).toEqual([])
    expect(layer(-100)).toEqual([])
    expect(layer(-1201)).toEqual([
      { path: ['GRAVITY'], code: 'outOfRange', message: 'expected -1200..-100, received -1201' },
    ])
  })

  it('refuses an inline range when the ranges are declared in code', () => {
    expect(
      checkTuningLayer({ GRAVITY: { value: -275, min: -300, max: 0 } }, declared, { complete: false }),
    ).toEqual([
      {
        path: ['GRAVITY'],
        code: 'invalidType',
        message: 'the range of GRAVITY is declared in code; write a bare number',
      },
    ])
  })
})

// A0+A1 spec §5: `{ value, min, max, step }` in tuning.toml when the game declares nothing in code.
describe('checkTuning with authored ranges', () => {
  it('reads bare and ranged values with their metadata', () => {
    const result = checkTuning(
      {
        GRAVITY: { value: -275.5, min: -1200, max: -100, step: 0.5 },
        LIVES: { value: 3, min: 1, max: 9 },
        DEBUG_LABEL: 'climb',
        GODMODE: false,
        SPEED: 2,
      },
      {},
    )
    expect(result.problems).toEqual([])
    expect(result.values).toEqual({
      GRAVITY: -275.5,
      LIVES: 3,
      DEBUG_LABEL: 'climb',
      GODMODE: false,
      SPEED: 2,
    })
    expect(result.meta).toEqual({
      DEBUG_LABEL: { type: 'string', value: 'climb' },
      GODMODE: { type: 'boolean', value: false },
      GRAVITY: { type: 'float', value: -275.5, min: -1200, max: -100, step: 0.5 },
      LIVES: { type: 'int', value: 3, min: 1, max: 9 },
      SPEED: { type: 'float', value: 2 },
    })
  })

  it('refuses a value outside its range at the value', () => {
    expect(checkTuning({ GRAVITY: { value: -2000, min: -1200, max: -100 } }, {}).problems).toEqual([
      { path: ['GRAVITY', 'value'], code: 'outOfRange', message: 'expected -1200..-100, received -2000' },
    ])
  })

  it('refuses a malformed range', () => {
    expect(
      checkTuning(
        {
          A: { value: 1, min: 5, max: 0 },
          B: { value: 1, min: 0, max: 5, step: 0 },
          C: { value: 'x', min: 0, max: 5 },
          D: { value: 1, min: 0, max: 5, stride: 1 },
          E: { min: 0, max: 5 },
          bad_name: 1,
          F: [1, 2],
        },
        {},
      ).problems,
    ).toEqual([
      { path: ['A', 'min'], code: 'invalidType', message: 'min 5 is above max 0' },
      { path: ['B', 'step'], code: 'invalidType', message: 'step must be above 0, received 0' },
      { path: ['C', 'value'], code: 'invalidType', message: 'a ranged value must be a number' },
      { path: ['D', 'stride'], code: 'unknownField', message: 'unknown field: stride' },
      { path: ['E', 'value'], code: 'missingField', message: 'required' },
      {
        path: ['F'],
        code: 'invalidType',
        message: 'expected a number, boolean, string or { value, min, max, step }',
      },
      { path: ['bad_name'], code: 'invalidType', message: 'tunable names match ^[A-Z][A-Z0-9_]*$' },
    ])
  })

  it('refuses a number that is not finite', () => {
    expect(checkTuning({ SPEED: Number.POSITIVE_INFINITY }, {}).problems).toEqual([
      { path: ['SPEED'], code: 'invalidType', message: 'SPEED must be finite' },
    ])
  })
})
