import { fakeViewportWindow, hostDisplay } from '@mcthaydt/automata-testing'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Geometry } from './geometry'
import { createGeometryOwner, SETTLE_DELAYS_MS } from './geometry-owner.svelte'

const NO_ENV = () => ({ top: 0, right: 0, bottom: 0, left: 0 })

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function setup(size = { width: 390, height: 844 }) {
  const win = fakeViewportWindow(size)
  const root = document.createElement('div')
  const env = vi.fn(NO_ENV)
  const owner = createGeometryOwner({ window: win, root, readEnvSafeArea: env })
  return { win, root, env, owner }
}

describe('createGeometryOwner (M1.6 spec §3.1, §4)', () => {
  test('measures and applies at once, so the first screen already has its geometry', () => {
    const { root, owner } = setup({ width: 780, height: 270 })
    expect(root.dataset.formFactor).toBe('phone-landscape')
    expect(root.dataset.height).toBe('compact')
    expect(owner.geometry.current.formFactor).toBe('phone-landscape')
  })

  test('follows a rotation and tells subscribers', () => {
    const { win, root, owner } = setup()
    const seen: Geometry[] = []
    const stop = owner.onChange((g) => seen.push(g))
    win.resize(844, 390)
    expect(root.dataset.formFactor).toBe('phone-landscape')
    expect(seen.at(-1)?.formFactor).toBe('phone-landscape')
    expect(owner.geometry.current.formFactor).toBe('phone-landscape')
    stop()
    const heard = seen.length
    win.resize(390, 844)
    expect(seen).toHaveLength(heard)
  })

  test('measures again as the settle delays pass, restarted by a newer event', () => {
    const { win, env } = setup()
    expect(SETTLE_DELAYS_MS).toEqual([100, 400, 1000])
    env.mockClear()
    // A keyboard fires one event (the visual viewport's resize); a rotation fires two.
    win.openKeyboard(300)
    expect(env).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(env).toHaveBeenCalledTimes(2)
    win.closeKeyboard() // restarts: the 400 and 1000 ms re-measures of the first event never run
    expect(env).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(1000)
    expect(env).toHaveBeenCalledTimes(6)
    vi.advanceTimersByTime(5000)
    expect(env).toHaveBeenCalledTimes(6)
  })

  test('a keyboard sets the visual inset and never reclassifies the screen', () => {
    const { win, root } = setup()
    const before = root.dataset.formFactor
    win.openKeyboard(340)
    expect(root.dataset.formFactor).toBe(before)
    expect(root.hasAttribute('data-height')).toBe(false)
    expect(root.style.getPropertyValue('--af-visual-inset-bottom')).toBe('340px')
    expect(root.hasAttribute('data-visual-inset')).toBe(true)
    win.closeKeyboard()
    expect(root.hasAttribute('data-visual-inset')).toBe(false)
  })

  test("takes the host's display, and returns to standalone values without it", () => {
    const { root, owner } = setup({ width: 844, height: 390 })
    owner.setHostDisplay(hostDisplay({ scale: 1.333 }))
    expect(root.style.getPropertyValue('--af-host-reserved-right')).toBe('48px')
    expect(root.style.getPropertyValue('--af-inset-right')).toBe('48px')
    expect(root.style.getPropertyValue('--af-scale')).toBe('1.333')
    owner.setHostDisplay(undefined)
    expect(root.style.getPropertyValue('--af-host-reserved-right')).toBe('0px')
    expect(root.style.getPropertyValue('--af-scale')).toBe('1')
  })

  test('a host display passed at creation applies from the first measure', () => {
    const win = fakeViewportWindow({ width: 844, height: 390 })
    const root = document.createElement('div')
    createGeometryOwner({ window: win, root, host: hostDisplay({ edge: 'left' }), readEnvSafeArea: NO_ENV })
    expect(root.style.getPropertyValue('--af-host-reserved-left')).toBe('48px')
  })

  test('remeasure reads the sizes again now and as the settle delays pass', () => {
    const { env, owner } = setup()
    env.mockClear()
    owner.remeasure()
    vi.advanceTimersByTime(1000)
    expect(env).toHaveBeenCalledTimes(4)
  })

  test('dispose removes every listener and pending re-measure; twice is a no-op', () => {
    const { win, env, owner, root } = setup()
    win.resize(844, 390)
    env.mockClear()
    owner.dispose()
    owner.dispose()
    expect(win.listenerCount()).toBe(0)
    vi.advanceTimersByTime(5000)
    win.resize(390, 844)
    expect(env).not.toHaveBeenCalled()
    // The last values stay on the root.
    expect(root.dataset.formFactor).toBe('phone-landscape')
  })

  test('works without a visual viewport', () => {
    const root = document.createElement('div')
    const win = { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} }
    const owner = createGeometryOwner({ window: win, root, readEnvSafeArea: NO_ENV })
    expect(owner.geometry.current.visualInsetBottom).toBe(0)
  })

  test('the default env probe reads 0 where env() is not computed (jsdom)', () => {
    const win = fakeViewportWindow({ width: 390, height: 844 })
    const root = document.createElement('div')
    document.body.append(root)
    const owner = createGeometryOwner({ window: win, root })
    expect(owner.geometry.current.insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    owner.dispose()
    root.remove()
  })

  describe("DuckDuckGo's forgotten bottom bar (§3.9, FloorFifty viewport-tracking)", () => {
    /** The emulator's DuckDuckGo: a 915 px screen, 802 px of page while the bar is counted. */
    const DUCKDUCKGO = { userAgentData: { brands: [{ brand: 'Chromium' }, { brand: 'DuckDuckGo' }] } }
    const SCREEN = { width: 412, height: 915 }

    function duckDuckGo(height: number, navigator: object = DUCKDUCKGO) {
      const win = fakeViewportWindow({ width: 411, height, screen: SCREEN, navigator })
      const root = document.createElement('div')
      const owner = createGeometryOwner({ window: win, root, readEnvSafeArea: NO_ENV })
      return { win, root, owner }
    }

    test('keeps the page above a bar the browser grew the page under', () => {
      const { win, root, owner } = duckDuckGo(802)
      vi.advanceTimersByTime(1000)
      expect(root.style.getPropertyValue('--af-hidden-bar-bottom')).toBe('0px')
      win.resize(411, 866)
      vi.advanceTimersByTime(1000)
      expect(root.style.getPropertyValue('--af-hidden-bar-bottom')).toBe('64px')
      expect(root.style.getPropertyValue('--af-visual-inset-bottom')).toBe('64px')
      expect(owner.geometry.current.visible.height).toBe(866 - 64)
      expect(root.dataset.formFactor).toBe('phone-portrait')
    })

    test('catches a page that loads already grown', () => {
      const { root } = duckDuckGo(866)
      expect(root.style.getPropertyValue('--af-hidden-bar-bottom')).toBe('64px')
    })

    test('leaves every other browser alone, however little room the page is given', () => {
      const { root } = duckDuckGo(866, {})
      expect(root.style.getPropertyValue('--af-hidden-bar-bottom')).toBe('0px')
      expect(root.style.getPropertyValue('--af-visual-inset-bottom')).toBe('0px')
    })
  })
})
