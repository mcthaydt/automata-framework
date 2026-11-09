// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  applyThemeChoice,
  readThemeChoice,
  THEME_BOOT,
  THEME_KEY,
  writeThemeChoice,
} from '#src/shared/kit/theme/theme-choice.ts'

const reading = (value: string | null | 'throws') => () => ({
  getItem: (key: string) => {
    if (value === 'throws') throw new Error('storage refused')
    return key === THEME_KEY ? value : null
  },
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('readThemeChoice', () => {
  test('a stored light or dark is that choice', () => {
    expect(readThemeChoice(reading('dark'))).toBe('dark')
    expect(readThemeChoice(reading('light'))).toBe('light')
  })

  test('nothing stored, another value, no storage, or a storage that throws means Match device', () => {
    expect(readThemeChoice(reading(null))).toBe('device')
    expect(readThemeChoice(reading('blue'))).toBe('device')
    expect(readThemeChoice(() => undefined)).toBe('device')
    expect(readThemeChoice(reading('throws'))).toBe('device')
  })
})

describe('writeThemeChoice', () => {
  test('stores light or dark under the key', () => {
    const setItem = vi.fn()
    writeThemeChoice('dark', () => ({ setItem, removeItem: vi.fn() }))
    expect(setItem).toHaveBeenCalledWith(THEME_KEY, 'dark')
  })

  test('Match device removes the key', () => {
    const removeItem = vi.fn()
    writeThemeChoice('device', () => ({ setItem: vi.fn(), removeItem }))
    expect(removeItem).toHaveBeenCalledWith(THEME_KEY)
  })

  test('a store that refuses does not throw', () => {
    const refuse = (): never => {
      throw new Error('quota')
    }
    expect(() => writeThemeChoice('dark', () => ({ setItem: refuse, removeItem: refuse }))).not.toThrow()
    expect(() => writeThemeChoice('dark', () => undefined)).not.toThrow()
  })
})

describe('applyThemeChoice', () => {
  test('sets data-theme to a forced choice and removes it for Match device', () => {
    const root = document.documentElement
    applyThemeChoice('dark', root)
    expect(root.dataset.theme).toBe('dark')
    applyThemeChoice('light', root)
    expect(root.dataset.theme).toBe('light')
    applyThemeChoice('device', root)
    expect(root.hasAttribute('data-theme')).toBe(false)
  })
})

describe('THEME_BOOT, the script that runs before the first paint', () => {
  const run = (): void => void new Function(THEME_BOOT)()

  test('is a classic script: no import, no export', () => {
    expect(THEME_BOOT).not.toMatch(/\b(import|export)\b/)
  })

  test('a stored dark sets the attribute', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    run()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('a stored light sets the attribute', () => {
    localStorage.setItem(THEME_KEY, 'light')
    run()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  test('another stored value, or nothing, sets nothing', () => {
    localStorage.setItem(THEME_KEY, 'blue')
    run()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    localStorage.clear()
    run()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  test('a storage that throws sets nothing and throws nothing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(run).not.toThrow()
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })
})
