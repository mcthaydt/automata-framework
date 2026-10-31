import { describe, expect, it } from 'vitest'
import { storedLastOpened } from './stored-last-opened'

// Where the last open project is kept (ED2D.8): a key in the browser's storage, which may be absent or may throw (a
// private window, blocked site data), in which case Home simply selects the newest as before.

const memory = () => {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  }
}

describe('storedLastOpened', () => {
  it('reads back what it wrote', () => {
    const store = memory()
    const last = storedLastOpened(() => store)
    expect(last.read()).toBeUndefined()
    last.write('mossgate.af2d.json')
    expect(last.read()).toBe('mossgate.af2d.json')
  })

  it('survives storage that is missing or throws', () => {
    for (const storage of [
      () => undefined,
      () => {
        throw new Error('blocked')
      },
    ]) {
      const last = storedLastOpened(storage)
      expect(() => last.write('a.af2d.json')).not.toThrow()
      expect(last.read()).toBeUndefined()
    }
  })
})
