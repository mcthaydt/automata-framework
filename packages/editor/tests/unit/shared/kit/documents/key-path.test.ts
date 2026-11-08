// @vitest-environment node
import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import { cloneValue, keyPathText, valueAt } from '#src/shared/kit/documents/key-path.ts'

describe('cloneValue', () => {
  it('copies tables and arrays deeply, so changing the copy leaves the original', () => {
    const original = { a: { b: [1, { c: 2 }] } }
    const copy = cloneValue(original)
    copy.a.b.push(3)
    ;(copy.a.b[1] as { c: number }).c = 9
    expect(original).toEqual({ a: { b: [1, { c: 2 }] } })
  })

  it("keeps a TOML parser's dates as they are, class included", () => {
    const value = parse('day = 1979-05-27\nat = 1979-05-27T07:32:00Z\n') as { day: Date; at: Date }
    const copy = cloneValue(value)
    expect(copy.day).toBe(value.day)
    expect(copy.day.constructor).toBe(value.day.constructor)
    expect(copy.at).toBe(value.at)
    // structuredClone would have turned the parser's LocalDate into a plain Date.
    expect(structuredClone(value).day.constructor).not.toBe(value.day.constructor)
  })

  it('drops a member set to undefined, as a written file would', () => {
    expect(cloneValue({ a: 1, b: undefined })).toEqual({ a: 1 })
    expect(Object.keys(cloneValue({ a: 1, b: undefined }))).toEqual(['a'])
  })
})

describe('valueAt', () => {
  const value = { springs: { squash: { f: 4 } }, rooms: [{ id: 'a' }, { id: 'b' }], zero: 0, off: false }

  it('finds a value by keys and indices, falsy values included', () => {
    expect(valueAt(value, ['springs', 'squash', 'f'])).toEqual({ found: true, value: 4 })
    expect(valueAt(value, ['rooms', 1, 'id'])).toEqual({ found: true, value: 'b' })
    expect(valueAt(value, ['zero'])).toEqual({ found: true, value: 0 })
    expect(valueAt(value, ['off'])).toEqual({ found: true, value: false })
    expect(valueAt(value, [])).toEqual({ found: true, value })
  })

  it('finds nothing past the end, at a missing key, or where a key meets an array or an index meets a table', () => {
    for (const keyPath of [
      ['rooms', 2],
      ['rooms', -1],
      ['springs', 'lean'],
      ['rooms', 'id'],
      ['springs', 0],
      ['zero', 'x'],
    ])
      expect(valueAt(value, keyPath), keyPathText(keyPath)).toEqual({ found: false, value: undefined })
  })
})
