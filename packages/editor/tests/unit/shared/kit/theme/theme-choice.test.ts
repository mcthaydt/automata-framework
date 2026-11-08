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
  test('a stored light, dark or device is that choice', () => {
    expect(readThemeChoice(reading('dark'))).toBe('dark')
    expect(readThemeChoice(reading('light'))).toBe('light')
    expect(readThemeChoice(reading('device'))).toBe('device')
  })

  test('nothing stored, another value, no storage, or a storage that throws means Dark', () => {
    expect(readThemeChoice(reading(null))).toBe('dark')
    expect(readThemeChoice(reading('blue'))).toBe('dark')
    expect(readThemeChoice(() => undefined)).toBe('dark')
    expect(readThemeChoice(reading('throws'))).toBe('dark')
  })
})

describe('writeThemeChoice', () => {
  test('stores light, dark or device under the key', () => {
    const setItem = vi.fn()
    writeThemeChoice('dark', () => ({ setItem }))
    expect(setItem).toHaveBeenCalledWith(THEME_KEY, 'dark')
  })

  test('Match device is written as "device", because a missing key now means Dark', () => {
    const setItem = vi.fn()
    writeThemeChoice('device', () => ({ setItem }))
    expect(setItem).toHaveBeenCalledWith(THEME_KEY, 'device')
  })

  test('a store that refuses does not throw', () => {
    const refuse = (): never => {
      throw new Error('quota')
    }
    expect(() => writeThemeChoice('dark', () => ({ setItem: refuse }))).not.toThrow()
    expect(() => writeThemeChoice('dark', () => undefined)).not.toThrow()
  })
})

describe('applyThemeChoice', () => {
  test('always sets data-theme to the choice, Match device included', () => {
    const root = document.documentElement
    applyThemeChoice('dark', root)
    expect(root.dataset.theme).toBe('dark')
    applyThemeChoice('light', root)
    expect(root.dataset.theme).toBe('light')
    applyThemeChoice('device', root)
    expect(root.dataset.theme).toBe('device')
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

  test('a stored device sets the attribute', () => {
    localStorage.setItem(THEME_KEY, 'device')
    run()
    expect(document.documentElement.dataset.theme).toBe('device')
  })

  test('another stored value, or nothing, opens Dark', () => {
    localStorage.setItem(THEME_KEY, 'blue')
    run()
    expect(document.documentElement.dataset.theme).toBe('dark')
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
    run()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  test('a storage that throws opens Dark and throws nothing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(run).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
