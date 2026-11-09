import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FINE_POINTER,
  onReduceChange,
  REDUCE,
  smoothScrollAllowed,
  wantsMotion,
  wantsSmoothScroll,
} from '#src/shared/motion/motion-preference.ts'

function windowWith(matches: readonly string[], saveData?: boolean): Window {
  return {
    matchMedia: (query: string) => ({ matches: matches.includes(query) }),
    navigator: saveData === undefined ? {} : { connection: { saveData } },
  } as unknown as Window
}

describe('wantsMotion', () => {
  it('is false when the visitor asks for less motion', () => {
    expect(wantsMotion(windowWith([REDUCE]))).toBe(false)
  })
  it('is false when the connection saves data', () => {
    expect(wantsMotion(windowWith([], true))).toBe(false)
  })
  it('is true otherwise, also when the browser has no connection API', () => {
    expect(wantsMotion(windowWith([], false))).toBe(true)
    expect(wantsMotion(windowWith([]))).toBe(true)
  })
})

describe('smoothScrollAllowed', () => {
  it('is false on the playground, with or without a trailing slash', () => {
    expect(smoothScrollAllowed('/examples/core-basic-window')).toBe(false)
    expect(smoothScrollAllowed('/examples/core-basic-window/')).toBe(false)
  })
  it('is true everywhere else', () => {
    for (const path of ['/examples', '/', '/docs/start']) expect(smoothScrollAllowed(path), path).toBe(true)
  })
})

describe('wantsSmoothScroll', () => {
  it('needs a fine pointer', () => {
    expect(wantsSmoothScroll(windowWith([]), '/')).toBe(false)
    expect(wantsSmoothScroll(windowWith([FINE_POINTER]), '/')).toBe(true)
  })
  it('needs motion and a page that allows it', () => {
    expect(wantsSmoothScroll(windowWith([FINE_POINTER, REDUCE]), '/')).toBe(false)
    expect(wantsSmoothScroll(windowWith([FINE_POINTER]), '/examples/x')).toBe(false)
  })
})

describe('onReduceChange', () => {
  afterEach(() => vi.restoreAllMocks())
  it('calls the listener on a change and stops after the returned function runs', () => {
    let handler: ((event: { matches: boolean }) => void) | undefined
    const list = {
      matches: false,
      addEventListener: vi.fn((_: string, fn: typeof handler) => {
        handler = fn
      }),
      removeEventListener: vi.fn(),
    }
    const win = { matchMedia: () => list } as unknown as Window
    const listener = vi.fn()
    const stop = onReduceChange(win, listener)
    handler?.({ matches: true })
    expect(listener).toHaveBeenCalledWith(true)
    stop()
    expect(list.removeEventListener).toHaveBeenCalledWith('change', handler)
  })
})
