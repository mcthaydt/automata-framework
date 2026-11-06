import { describe, expect, test } from 'vitest'
import { logGestures, mouse, pen, touch } from '../../../testing/kit/fake-pointer'
import { createTestClock } from '../../../testing/kit/test-clock'
import { NO_MODIFIERS, type WheelInput } from './pointer-sample'
import { createRecognizer } from './recognizer'

function setup() {
  const clock = createTestClock()
  const log = logGestures()
  const recognizer = createRecognizer(log.handlers, {}, clock)
  return { clock, log, recognizer }
}

const wheelInput = (over: Partial<WheelInput> = {}): WheelInput => ({
  x: 40,
  y: 60,
  deltaX: 0,
  deltaY: 0,
  modifiers: NO_MODIFIERS,
  ...over,
})
const CTRL = { ...NO_MODIFIERS, ctrl: true }

describe('hover', () => {
  test('a pen above the surface and a mouse with no button fire hover; touch never does', () => {
    const { log, recognizer } = setup()
    recognizer.hover(pen(1, 10, 20, { pressure: 0, tiltX: 30 }))
    recognizer.hover(mouse(11, 21))
    recognizer.hover(touch(2, 12, 22))
    expect(log.of('hover')).toEqual([
      { x: 10, y: 20, pointerType: 'pen', pressure: 0, tiltX: 30, tiltY: 0, modifiers: NO_MODIFIERS },
      { x: 11, y: 21, pointerType: 'mouse', pressure: 0, tiltX: 0, tiltY: 0, modifiers: NO_MODIFIERS },
    ])
  })
})

describe('wheel', () => {
  test('Ctrl zooms about the pointer: scrolling up zooms in, down zooms out', () => {
    const { log, recognizer } = setup()
    recognizer.wheel(wheelInput({ deltaY: -100, modifiers: CTRL }))
    recognizer.wheel(wheelInput({ deltaY: 100, modifiers: CTRL }))
    const [zoomIn, zoomOut] = log.of<{ mode: string; scale: number; x: number; y: number }>('wheel')
    expect(zoomIn).toMatchObject({ mode: 'zoom', x: 40, y: 60 })
    expect(zoomIn?.scale).toBeCloseTo(2 ** 0.5)
    expect(zoomOut?.scale).toBeCloseTo(2 ** -0.5)
  })

  test('Meta zooms too, and one step is clamped to 100 px', () => {
    const { log, recognizer } = setup()
    recognizer.wheel(wheelInput({ deltaY: -5000, modifiers: { ...NO_MODIFIERS, meta: true } }))
    expect(log.of<{ mode: string; scale: number }>('wheel')[0]?.mode).toBe('zoom')
    expect(log.of<{ scale: number }>('wheel')[0]?.scale).toBeCloseTo(2 ** 0.5)
  })

  test('without Ctrl or Meta the wheel pans: the content moves by the negated delta', () => {
    const { log, recognizer } = setup()
    recognizer.wheel(wheelInput({ deltaX: 12, deltaY: -30 }))
    expect(log.of('wheel')[0]).toMatchObject({ mode: 'pan', dx: -12, dy: 30, scale: 1 })
  })
})

describe('teardown', () => {
  test('dispose in the middle of a press fires nothing afterwards, even the timer that was due', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 0, 0))
    recognizer.dispose()
    clock.advance(1000)
    recognizer.up(touch(1, 0, 0))
    expect(log.types()).toEqual([])
  })

  test('dispose in the middle of a drag or a transform fires nothing, not even a cancelled end', () => {
    const drag = setup()
    drag.recognizer.down(mouse(0, 0))
    drag.recognizer.move(mouse(30, 0))
    drag.recognizer.dispose()
    drag.recognizer.move(mouse(60, 0))
    drag.recognizer.up(mouse(60, 0))
    expect(drag.log.types()).toEqual(['dragStart'])

    const pinch = setup()
    pinch.recognizer.down(touch(1, 100, 100))
    pinch.recognizer.down(touch(2, 200, 100))
    pinch.recognizer.move(touch(2, 260, 100))
    pinch.recognizer.dispose()
    pinch.recognizer.cancel(1)
    pinch.recognizer.up(touch(2, 260, 100))
    expect(pinch.log.types()).toEqual(['pan', 'pinch'])
  })

  test('every call after dispose does nothing', () => {
    const { clock, log, recognizer } = setup()
    recognizer.dispose()
    recognizer.down(mouse(0, 0))
    recognizer.move(mouse(30, 0))
    recognizer.up(mouse(30, 0))
    recognizer.hover(mouse(1, 1))
    recognizer.wheel(wheelInput({ deltaY: 5 }))
    recognizer.cancel(1)
    clock.advance(1000)
    expect(log.types()).toEqual([])
  })
})
