import { describe, expect, test } from 'vitest'
import { parseHexColor, sameColor } from './color'

describe('parseHexColor', () => {
  test('accepts #rrggbb in either case and returns it lower-cased', () => {
    expect(parseHexColor('#E0A54A')).toEqual({ ok: true, value: '#e0a54a' })
    expect(parseHexColor(' #00ff7f ')).toEqual({ ok: true, value: '#00ff7f' })
  })

  test('refuses everything else with one message', () => {
    for (const text of ['', 'e0a54a', '#fff', '#12345', '#1234567', '#gg0000', 'red', '#e0a54a;']) {
      expect(parseHexColor(text)).toEqual({ ok: false, message: 'Use #rrggbb, for example #e0a54a' })
    }
  })
})

describe('sameColor', () => {
  test('compares colours without regard to case', () => {
    expect(sameColor('#E0A54A', '#e0a54a')).toBe(true)
    expect(sameColor('#e0a54a', '#e0a54b')).toBe(false)
  })
})
