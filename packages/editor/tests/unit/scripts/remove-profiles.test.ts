import { describe, expect, test, vi } from 'vitest'
import { removeProfiles } from '../../../scripts/remove-profiles.ts'

const notEmpty = (): Error =>
  Object.assign(new Error('ENOTEMPTY, Directory not empty'), { code: 'ENOTEMPTY' })

describe('removeProfiles', () => {
  test('removes the directory recursively, retrying while a browser still writes to it', () => {
    const remove = vi.fn()
    expect(removeProfiles('/tmp/profiles', { remove, warn: vi.fn() })).toBe(true)
    expect(remove).toHaveBeenCalledWith('/tmp/profiles', {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    })
  })

  test('a removal that still fails (ENOTEMPTY on the Mac) warns and does not throw', () => {
    const warn = vi.fn()
    const remove = vi.fn(() => {
      throw notEmpty()
    })
    expect(removeProfiles('/tmp/profiles', { remove, warn })).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('/tmp/profiles')
  })

  test('no directory, nothing to do', () => {
    const remove = vi.fn()
    expect(removeProfiles(undefined, { remove, warn: vi.fn() })).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })
})
