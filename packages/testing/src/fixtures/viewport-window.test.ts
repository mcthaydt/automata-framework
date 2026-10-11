import { describe, expect, test, vi } from 'vitest'
import { fakeViewportWindow, hostDisplay } from './viewport-window'

describe('fakeViewportWindow', () => {
  test('starts at its size with a visual viewport that matches the layout', () => {
    const win = fakeViewportWindow({ width: 780, height: 270 })
    expect(win.innerWidth).toBe(780)
    expect(win.innerHeight).toBe(270)
    expect(win.visualViewport.height).toBe(270)
    expect(win.visualViewport.offsetTop).toBe(0)
  })

  test('resize changes both viewports and fires resize on the window and the visual viewport', () => {
    const win = fakeViewportWindow({ width: 390, height: 844 })
    const onWindow = vi.fn()
    const onVisual = vi.fn()
    win.addEventListener('resize', onWindow)
    win.visualViewport.addEventListener('resize', onVisual)
    win.resize(844, 390)
    expect([win.innerWidth, win.innerHeight, win.visualViewport.height]).toEqual([844, 390, 390])
    expect(onWindow).toHaveBeenCalledOnce()
    expect(onVisual).toHaveBeenCalledOnce()
  })

  test('a keyboard shrinks only the visual viewport and fires only its resize', () => {
    const win = fakeViewportWindow({ width: 390, height: 844 })
    const onWindow = vi.fn()
    const onVisual = vi.fn()
    win.addEventListener('resize', onWindow)
    win.visualViewport.addEventListener('resize', onVisual)
    win.openKeyboard(300)
    expect([win.innerWidth, win.innerHeight, win.visualViewport.height]).toEqual([390, 844, 544])
    win.closeKeyboard()
    expect(win.visualViewport.height).toBe(844)
    expect(onWindow).not.toHaveBeenCalled()
    expect(onVisual).toHaveBeenCalledTimes(2)
  })

  test('removed listeners are not called, and the count of live listeners is visible', () => {
    const win = fakeViewportWindow({ width: 390, height: 844 })
    const listener = vi.fn()
    win.addEventListener('resize', listener)
    expect(win.listenerCount()).toBe(1)
    win.removeEventListener('resize', listener)
    expect(win.listenerCount()).toBe(0)
    win.resize(400, 800)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('hostDisplay', () => {
  test("defaults to Ruken's fixture: a 48 px strip on the right, no safe area, scale 1", () => {
    expect(hostDisplay()).toEqual({
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
      hostReserved: { edge: 'right', rect: { x: 1232, y: 332, w: 48, h: 56 } },
      orientation: 'landscape',
      fullscreen: false,
      scale: 1,
    })
  })

  test('takes an edge, a width and the TV scale', () => {
    const tv = hostDisplay({ edge: 'left', width: 60, scale: 1.333 })
    expect(tv.hostReserved.edge).toBe('left')
    expect(tv.hostReserved.rect.w).toBe(60)
    expect(tv.scale).toBe(1.333)
  })
})
