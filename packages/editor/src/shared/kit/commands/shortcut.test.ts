import { describe, expect, test } from 'vitest'
import { normalizeShortcut, parseShortcut } from './shortcut'

describe('parseShortcut', () => {
  test('reads modifiers and one key', () => {
    expect(parseShortcut('Mod+Shift+Z')).toEqual({
      key: 'z',
      mod: true,
      ctrl: false,
      meta: false,
      shift: true,
      alt: false,
    })
    expect(parseShortcut('Ctrl+Alt+Delete')).toEqual({
      key: 'delete',
      mod: false,
      ctrl: true,
      meta: false,
      shift: false,
      alt: true,
    })
    expect(parseShortcut('Meta+S')).toMatchObject({ key: 's', meta: true, mod: false })
  })

  test('a bare key is a shortcut with no modifiers', () => {
    expect(parseShortcut('Delete')).toMatchObject({ key: 'delete', mod: false, shift: false })
    expect(parseShortcut('Escape')).toMatchObject({ key: 'escape' })
  })

  test('Space is the space character', () => {
    expect(parseShortcut('Space').key).toBe(' ')
    expect(parseShortcut('Mod+Space').key).toBe(' ')
  })

  test('ignores case and spaces around the plus signs', () => {
    expect(parseShortcut(' mod + shift + z ')).toEqual(parseShortcut('Mod+Shift+Z'))
  })

  test('a plus key is written Plus, so it cannot be mistaken for the separator', () => {
    expect(parseShortcut('Mod+Plus').key).toBe('+')
  })

  test.each([
    ['', 'empty'],
    ['Mod+', 'no key'],
    ['Mod+Shift', 'only modifiers'],
    ['Z+X', 'two keys'],
    ['Hyper+Z', 'unknown modifier'],
    ['Mod+Mod+Z', 'a repeated modifier'],
  ])('rejects %j (%s)', (text) => {
    expect(() => parseShortcut(text)).toThrow(/shortcut/i)
  })
})

describe('normalizeShortcut', () => {
  test('writes modifiers in a fixed order with capitalised names, so equal shortcuts compare equal', () => {
    expect(normalizeShortcut('shift+mod+z')).toBe('Mod+Shift+Z')
    expect(normalizeShortcut('alt+ctrl+meta+shift+mod+x')).toBe('Mod+Ctrl+Meta+Alt+Shift+X')
    expect(normalizeShortcut('delete')).toBe('Delete')
    expect(normalizeShortcut('space')).toBe('Space')
    expect(normalizeShortcut('mod+plus')).toBe('Mod+Plus')
  })
})
