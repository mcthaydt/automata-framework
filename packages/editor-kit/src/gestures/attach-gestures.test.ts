import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { logGestures } from '../testing/fake-pointer'
import { createTestClock } from '../testing/test-clock'
import { attachGestures } from './attach-gestures'

interface PointerInit {
  pointerId?: number
  pointerType?: string
  clientX?: number
  clientY?: number
  button?: number
  buttons?: number
  pressure?: number
  tiltX?: number
  tiltY?: number
  shiftKey?: boolean
  ctrlKey?: boolean
}

let element: HTMLDivElement
let setCapture: ReturnType<typeof vi.fn>
let releaseCapture: ReturnType<typeof vi.fn>
let captured: Set<number>

beforeEach(() => {
  element = document.createElement('div')
  document.body.append(element)
  captured = new Set()
  setCapture = vi.fn((id: number) => captured.add(id))
  releaseCapture = vi.fn((id: number) => captured.delete(id))
  Object.assign(element, {
    setPointerCapture: setCapture,
    releasePointerCapture: releaseCapture,
    hasPointerCapture: (id: number) => captured.has(id),
  })
})

afterEach(() => element.remove())

function fire(type: string, init: PointerInit = {}): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'mouse',
    ...init,
  })
  element.dispatchEvent(event)
  return event
}

function attach(options = {}) {
  const clock = createTestClock()
  const log = logGestures()
  const detach = attachGestures(element, log.handlers, { clock, ...options })
  return { clock, log, detach }
}

describe('attachGestures', () => {
  test('sets touch-action none while attached and restores the style on detach', () => {
    element.style.touchAction = 'pan-y'
    const { detach } = attach()
    expect(element.style.touchAction).toBe('none')
    expect(element.style.userSelect).toBe('none')
    detach()
    expect(element.style.touchAction).toBe('pan-y')
    expect(element.style.userSelect).toBe('')
  })

  test('a pointer down captures its id and the up releases it', () => {
    attach()
    fire('pointerdown', { pointerId: 7, pointerType: 'touch' })
    expect(setCapture).toHaveBeenCalledWith(7)
    fire('pointerup', { pointerId: 7, pointerType: 'touch' })
    expect(releaseCapture).toHaveBeenCalledWith(7)
  })

  test('a failing setPointerCapture does not stop the gesture', () => {
    setCapture.mockImplementation(() => {
      throw new DOMException('no such pointer', 'NotFoundError')
    })
    const { log } = attach()
    fire('pointerdown')
    fire('pointerup')
    expect(log.types()).toEqual(['tap'])
  })

  test('mouse, pen and touch pointers become the same events, with modifiers, pressure and tilt', () => {
    const { log } = attach()
    fire('pointerdown', {
      pointerId: 1,
      pointerType: 'pen',
      clientX: 10,
      clientY: 10,
      pressure: 0.25,
      tiltX: 20,
      tiltY: -10,
      shiftKey: true,
    })
    fire('pointermove', {
      pointerId: 1,
      pointerType: 'pen',
      clientX: 40,
      clientY: 10,
      pressure: 0.75,
      tiltX: 21,
      tiltY: -9,
      shiftKey: true,
    })
    fire('pointerup', { pointerId: 1, pointerType: 'pen', clientX: 40, clientY: 10 })
    expect(log.types()).toEqual(['dragStart', 'dragEnd'])
    expect(log.of('dragStart')[0]).toMatchObject({
      pointerType: 'pen',
      pressure: 0.75,
      tiltX: 21,
      tiltY: -9,
      startX: 10,
      modifiers: { shift: true, ctrl: false },
    })
  })

  test('positions are in the element own coordinates', () => {
    element.getBoundingClientRect = () => ({ left: 100, top: 50, width: 400, height: 300 }) as DOMRect
    const { log } = attach()
    fire('pointerdown', { clientX: 130, clientY: 90 })
    fire('pointerup', { clientX: 130, clientY: 90 })
    expect(log.of('tap')[0]).toMatchObject({ x: 30, y: 40 })
  })

  test('a move with the pointer up is a hover, for a pen and a mouse but never touch', () => {
    const { log } = attach()
    fire('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 5 })
    fire('pointermove', { pointerId: 2, pointerType: 'pen', clientX: 6 })
    fire('pointermove', { pointerId: 3, pointerType: 'touch', clientX: 7 })
    expect(log.of<{ pointerType: string }>('hover').map((h) => h.pointerType)).toEqual(['mouse', 'pen'])
  })

  test('pointercancel cancels the gesture and releases the pointer', () => {
    const { log } = attach()
    fire('pointerdown', { clientX: 0 })
    fire('pointermove', { clientX: 30 })
    fire('pointercancel')
    fire('pointerup', { clientX: 30 })
    expect(log.types()).toEqual(['dragStart', 'dragEnd'])
    expect(log.of('dragEnd')[0]).toMatchObject({ cancelled: true })
    expect(releaseCapture).toHaveBeenCalledWith(1)
  })

  test('losing pointer capture while pressed cancels; the release after an up does not', () => {
    const { log } = attach()
    fire('pointerdown', { clientX: 0 })
    fire('pointermove', { clientX: 30 })
    fire('lostpointercapture')
    expect(log.of('dragEnd')[0]).toMatchObject({ cancelled: true })

    const second = attach()
    fire('pointerdown', { pointerId: 2, clientX: 0 })
    fire('pointermove', { pointerId: 2, clientX: 30 })
    fire('pointerup', { pointerId: 2, clientX: 30 })
    fire('lostpointercapture', { pointerId: 2 })
    expect(second.log.of('dragEnd')).toHaveLength(1)
    expect(second.log.of('dragEnd')[0]).toMatchObject({ cancelled: false })
  })

  test('the wheel in lines and pages becomes pixels, and its default is prevented', () => {
    Object.defineProperty(element, 'clientHeight', { value: 500 })
    const { log } = attach()
    const send = (deltaMode: number, deltaY: number, ctrlKey = false) => {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaMode, deltaY, ctrlKey })
      element.dispatchEvent(event)
      return event
    }
    expect(send(0, 30).defaultPrevented).toBe(true)
    send(1, 3)
    send(2, 1)
    expect(log.of<{ dy: number }>('wheel').map((w) => w.dy)).toEqual([-30, -48, -500])
  })

  test('without a wheel handler the wheel is left to the browser', () => {
    const detach = attachGestures(element, {}, { clock: createTestClock() })
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 10 })
    element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    detach()
  })

  test('the context menu is prevented unless the options keep it', () => {
    const { detach } = attach()
    expect(element.dispatchEvent(new Event('contextmenu', { cancelable: true }))).toBe(false)
    detach()
    attachGestures(element, {}, { clock: createTestClock(), preventContextMenu: false })
    expect(element.dispatchEvent(new Event('contextmenu', { cancelable: true }))).toBe(true)
  })

  test('detaching mid-drag releases the pointer, removes the listeners and fires nothing more (EK-i)', () => {
    const { log, detach } = attach()
    fire('pointerdown', { pointerId: 4, clientX: 0 })
    fire('pointermove', { pointerId: 4, clientX: 30 })
    const before = log.fired.length
    detach()
    expect(releaseCapture).toHaveBeenCalledWith(4)
    fire('pointermove', { pointerId: 4, clientX: 60 })
    fire('pointerup', { pointerId: 4, clientX: 60 })
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 5 }))
    expect(log.fired).toHaveLength(before)
  })

  test('detaching with a long press pending cancels the timer', () => {
    const { clock, log, detach } = attach()
    fire('pointerdown', { pointerType: 'touch' })
    detach()
    clock.advance(1000)
    expect(log.types()).toEqual([])
  })
})
