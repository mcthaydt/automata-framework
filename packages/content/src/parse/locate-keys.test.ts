import { describe, expect, it } from 'vitest'
import { locateKeys, positionOf } from './locate-keys'

const text = [
  '# Screen flow', // 1
  'entry = "Splash"', // 2
  '', // 3
  '[[transitions]]', // 4
  'from = "Splash"', // 5
  'to = "MainMenu"', // 6
  '', // 7
  '[[transitions]]', // 8
  '  from = "Lobby"', // 9
  '  to = "Gameplay"', // 10
  '', // 11
  '[theme.presentation]', // 12
  'profile = "aquarian"', // 13
  'a.b = 1', // 14
  '"quoted key" = 2', // 15
  'notes = """', // 16
  'fake = "not a key"', // 17
  '"""', // 18
  'layers = [', // 19
  '  "x = 1",', // 20
  '  { alias = "y" },', // 21
  ']', // 22
  'after = true', // 23
].join('\n')

describe('locateKeys', () => {
  const index = locateKeys(text)
  const at = (...path: (string | number)[]) => positionOf(index, path)

  it('finds a top-level key at its column', () => {
    expect(at('entry')).toEqual({ line: 2, column: 1 })
  })

  it('numbers array-of-tables elements and indexes their keys', () => {
    expect(at('transitions', 0, 'to')).toEqual({ line: 6, column: 1 })
    expect(at('transitions', 1, 'to')).toEqual({ line: 10, column: 3 })
    expect(at('transitions', 1)).toEqual({ line: 8, column: 1 })
  })

  it('indexes keys under a table header, dotted and quoted keys included', () => {
    expect(at('theme', 'presentation', 'profile')).toEqual({ line: 13, column: 1 })
    expect(at('theme', 'presentation', 'a', 'b')).toEqual({ line: 14, column: 1 })
    expect(at('theme', 'presentation', 'quoted key')).toEqual({ line: 15, column: 1 })
  })

  it('does not read keys inside a multi-line string or a multi-line array', () => {
    expect(index.has('theme.presentation.fake')).toBe(false)
    expect(index.has('theme.presentation.alias')).toBe(false)
    expect(at('theme', 'presentation', 'after')).toEqual({ line: 23, column: 1 })
  })

  it('falls back to the deepest indexed prefix, then to the top of the file', () => {
    expect(at('theme', 'presentation', 'layers', 1, 'alias')).toEqual({ line: 19, column: 1 })
    expect(at('nothing', 'here')).toEqual({ line: 1, column: 1 })
  })

  it('nests an array of tables inside the current element of its parent', () => {
    const nested = locateKeys(['[[a]]', 'x = 1', '[[a]]', '[[a.b]]', 'y = 2', '[[a.b]]', 'y = 3'].join('\n'))
    expect(positionOf(nested, ['a', 1, 'b', 1, 'y'])).toEqual({ line: 7, column: 1 })
    expect(positionOf(nested, ['a', 0, 'x'])).toEqual({ line: 2, column: 1 })
  })

  it('handles CRLF line endings', () => {
    expect(positionOf(locateKeys('a = 1\r\nb = 2\r\n'), ['b'])).toEqual({ line: 2, column: 1 })
  })
})
