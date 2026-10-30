import { describe, expect, it } from 'vitest'
import { sameJson, withoutUndefined } from './json-values'

describe('sameJson', () => {
  it('compares values deeply, whatever the order of members', () => {
    expect(sameJson({ a: 1, b: [1, { c: 'x' }] }, { b: [1, { c: 'x' }], a: 1 })).toBe(true)
    expect(sameJson({ a: 1 }, { a: 2 })).toBe(false)
    expect(sameJson([1, 2], [2, 1])).toBe(false)
    expect(sameJson([1], { 0: 1 })).toBe(false)
    expect(sameJson({ a: undefined }, { b: undefined })).toBe(false)
    expect(sameJson(null, {})).toBe(false)
    expect(sameJson('a', 'a')).toBe(true)
  })
})

describe('withoutUndefined', () => {
  it('drops the members set to undefined and keeps the order of the rest', () => {
    expect(Object.entries(withoutUndefined({ b: 1, a: undefined, c: null }))).toEqual([
      ['b', 1],
      ['c', null],
    ])
  })
})
