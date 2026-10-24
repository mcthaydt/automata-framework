import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TALLEST_FLOOR,
  elementPath,
  inRange,
  note,
  problem,
  rangeText,
  resolveContext,
  sortBySeverity,
  warning,
} from './check-types'
import { TUNABLES } from './tunables'

describe('findings', () => {
  it('writes a finding with its severity, and a fix only when there is one', () => {
    expect(problem('c', 'p', 'm')).toEqual({ severity: 'error', code: 'c', path: 'p', message: 'm' })
    expect(problem('c', 'p', 'm', 'repair')).toEqual({
      severity: 'error',
      code: 'c',
      path: 'p',
      message: 'm',
      fix: 'repair',
    })
    expect(warning('c', 'p', 'm').severity).toBe('warning')
    expect(note('c', 'p', 'm').severity).toBe('info')
    expect(Object.keys(problem('c', 'p', 'm'))).not.toContain('fix')
  })
})

describe('elementPath', () => {
  const ids = { extension: ['x0'], layers: ['b0', 'n3', 'b1'], setPieces: ['b0'] }

  it('names an element of a list by its id', () => {
    expect(elementPath(ids, 'layers', 1)).toBe('theme.layers[n3]')
    expect(elementPath(ids, 'setPieces', 0)).toBe('theme.setPieces[b0]')
    expect(elementPath(ids, 'extension', 0)).toBe('course.extension[x0]')
  })

  it('falls back to the index for a list with fewer ids than elements', () => {
    expect(elementPath(ids, 'setPieces', 4)).toBe('theme.setPieces[4]')
  })
})

describe('rangeText and inRange', () => {
  it('says what is allowed', () => {
    expect(rangeText('Lift', 'Lift is', 49, 0, 48)).toBe('Lift is 49; it goes from 0 to 48.')
    expect(rangeText('Lift', 'Lift is', 49, 0, 48, true)).toBe(
      'Lift is 49; it is a whole number from 0 to 48.',
    )
    expect(rangeText('The lift', 'Lift is', Number.NaN, 0, 48)).toBe('The lift is not a number.')
  })

  it('takes both bounds and refuses NaN', () => {
    expect(inRange(0, 0, 1)).toBe(true)
    expect(inRange(1, 0, 1)).toBe(true)
    expect(inRange(-0.1, 0, 1)).toBe(false)
    expect(inRange(1.1, 0, 1)).toBe(false)
    expect(inRange(Number.NaN, 0, 1)).toBe(false)
    expect(inRange(Number.POSITIVE_INFINITY, 0, 1)).toBe(false)
  })
})

describe('resolveContext', () => {
  it('uses the bundled declarations, the declared defaults and the tallest finite course of 49', () => {
    expect(resolveContext({})).toEqual({
      aliases: undefined,
      tunables: TUNABLES,
      baseTuning: {},
      tallestFloor: 49,
    })
    expect(DEFAULT_TALLEST_FLOOR).toBe(49)
  })

  it('keeps what the caller gives', () => {
    const aliases = new Set(['a'])
    const tunables = { X: { type: 'int', min: 0, max: 1, default: 0 } } as const
    expect(resolveContext({ aliases, tunables, baseTuning: { X: 1 }, tallestFloor: 30 })).toEqual({
      aliases,
      tunables,
      baseTuning: { X: 1 },
      tallestFloor: 30,
    })
  })
})

describe('sortBySeverity', () => {
  it('puts errors first, then warnings, then info, and keeps the order within a severity', () => {
    const found = [
      note('i1', 'p', 'm'),
      warning('w1', 'p', 'm'),
      problem('e1', 'p', 'm'),
      note('i2', 'p', 'm'),
      problem('e2', 'p', 'm'),
      warning('w2', 'p', 'm'),
    ]
    expect(sortBySeverity(found).map((f) => f.code)).toEqual(['e1', 'e2', 'w1', 'w2', 'i1', 'i2'])
  })

  it('does not change the list it is given', () => {
    const found = [note('i', 'p', 'm'), problem('e', 'p', 'm')]
    sortBySeverity(found)
    expect(found.map((f) => f.code)).toEqual(['i', 'e'])
  })
})
