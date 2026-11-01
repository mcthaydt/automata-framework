import { describe, expect, it } from 'vitest'
import type { Tunable } from './tuner-content'
import { checkValue, valueEdit } from './tuner-edits'

const tunable = (over: { [K in keyof Tunable]?: Tunable[K] | undefined }): Tunable =>
  ({
    name: 'MAX_RUN',
    kind: 'int',
    value: 384,
    min: 128,
    max: 768,
    step: 1,
    authored: true,
    editable: true,
    ...over,
  }) as Tunable

describe('checkValue', () => {
  it('accepts a value inside the bounds, and the bounds themselves', () => {
    for (const value of [128, 384, 768]) expect(checkValue(tunable({}), value)).toEqual({ ok: true })
  })

  it('refuses a value past a bound, naming the tunable, the value and the bound (EDS-c)', () => {
    expect(checkValue(tunable({}), 769)).toEqual({
      message: 'MAX_RUN: 769 is past the largest it may be, 768',
    })
    expect(checkValue(tunable({}), 127)).toEqual({
      message: 'MAX_RUN: 127 is under the smallest it may be, 128',
    })
  })

  it('refuses a fraction for an int and anything that is not a finite number', () => {
    expect(checkValue(tunable({}), 12.5)).toEqual({ message: 'MAX_RUN: 12.5 is not a whole number' })
    expect(checkValue(tunable({}), Number.NaN)).toEqual({ message: 'MAX_RUN: that is not a number' })
    expect(checkValue(tunable({}), Number.POSITIVE_INFINITY)).toEqual({
      message: 'MAX_RUN: that is not a number',
    })
    expect(checkValue(tunable({}), 'fast' as never)).toEqual({ message: 'MAX_RUN: that is not a number' })
  })

  it('lets a float be a fraction, and has no bounds to hold without them', () => {
    expect(checkValue(tunable({ kind: 'float', min: undefined, max: undefined }), 0.25)).toEqual({ ok: true })
    expect(checkValue(tunable({ min: undefined, max: undefined }), 1_000_000)).toEqual({ ok: true })
  })

  it('takes a boolean for a toggle and a string for a text field', () => {
    expect(checkValue(tunable({ kind: 'boolean', value: false }), true)).toEqual({ ok: true })
    expect(checkValue(tunable({ kind: 'boolean', value: false }), 1 as never)).toEqual({
      message: 'MAX_RUN: that is not on or off',
    })
    expect(checkValue(tunable({ kind: 'string', value: 'a' }), 'b')).toEqual({ ok: true })
    expect(checkValue(tunable({ kind: 'string', value: 'a' }), 3 as never)).toEqual({
      message: 'MAX_RUN: that is not text',
    })
  })

  it('refuses a row it does not edit, sending it to Ask', () => {
    expect(checkValue(tunable({ kind: 'other', editable: false, value: undefined }), 1)).toEqual({
      message: 'MAX_RUN is a table or a list: change it with Ask',
    })
  })
})

describe('valueEdit', () => {
  it('sets a bare row at its own key', () => {
    expect(valueEdit(tunable({ authored: false }), 400)).toEqual({
      keyPath: ['MAX_RUN'],
      expected: 384,
      set: 400,
    })
  })

  it('sets an inline table’s value and leaves its bounds', () => {
    expect(valueEdit(tunable({}), 400)).toEqual({ keyPath: ['MAX_RUN', 'value'], expected: 384, set: 400 })
  })
})
