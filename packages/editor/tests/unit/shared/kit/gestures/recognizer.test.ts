import { describe, expect, test } from 'vitest'
import type { GestureOptions } from '#src/shared/kit/gestures/recognizer.ts'
import { createRecognizer } from '#src/shared/kit/gestures/recognizer.ts'
import { logGestures, mouse, pen, touch } from '#src/testing/kit/fake-pointer.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'

const SHIFT = { shift: true, ctrl: false, alt: false, meta: false }

function setup(options?: GestureOptions) {
  const clock = createTestClock()
  const log = logGestures()
  const recognizer = createRecognizer(log.handlers, options, clock)
  return { clock, log, recognizer }
}

describe('tap', () => {
  test('a release within 300 ms and the slop is a tap with the pointer kind and count 1', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 100, 80))
    clock.advance(120)
    recognizer.up(touch(1, 102, 81))
    expect(log.types()).toEqual(['tap'])
    expect(log.of('tap')[0]).toMatchObject({ x: 102, y: 81, count: 1, pointerType: 'touch' })
  })

  test('a release after 300 ms is not a tap', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(mouse(10, 10))
    clock.advance(301)
    recognizer.up(mouse(10, 10))
    expect(log.of('tap')).toEqual([])
  })

  test('taps in a row count 1, 2, 3 and doubleTap fires once, at 2', () => {
    const { clock, log, recognizer } = setup()
    for (let i = 0; i < 3; i++) {
      recognizer.down(mouse(10, 10))
      clock.advance(50)
      recognizer.up(mouse(10, 10))
      clock.advance(100)
    }
    expect(log.of<{ count: number }>('tap').map((tap) => tap.count)).toEqual([1, 2, 3])
    expect(log.of<{ count: number }>('doubleTap').map((tap) => tap.count)).toEqual([2])
    expect(log.types()).toEqual(['tap', 'tap', 'doubleTap', 'tap'])
  })

  test('a second tap more than 300 ms after the first release starts again at 1', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(mouse(10, 10))
    recognizer.up(mouse(10, 10))
    clock.advance(301)
    recognizer.down(mouse(10, 10))
    recognizer.up(mouse(10, 10))
    expect(log.of<{ count: number }>('tap').map((tap) => tap.count)).toEqual([1, 1])
  })

  test('a second tap far from the first, or by another pointer kind, starts again at 1', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 10, 10))
    recognizer.up(touch(1, 10, 10))
    clock.advance(100)
    recognizer.down(touch(2, 200, 10))
    recognizer.up(touch(2, 200, 10))
    clock.advance(100)
    recognizer.down(pen(3, 200, 10))
    recognizer.up(pen(3, 200, 10))
    expect(log.of<{ count: number }>('tap').map((tap) => tap.count)).toEqual([1, 1, 1])
  })

  test('the slop is 8 for touch, 4 for pen and 3 for mouse: exactly the slop is a tap, one more is a drag', () => {
    const cases = [
      { make: touch, slop: 8 },
      { make: pen, slop: 4 },
      { make: (_id: number, x: number, y: number) => mouse(x, y), slop: 3 },
    ]
    for (const { make, slop } of cases) {
      const within = setup()
      within.recognizer.down(make(1, 50, 50))
      within.recognizer.move(make(1, 50 + slop, 50))
      within.recognizer.up(make(1, 50 + slop, 50))
      expect(within.log.types()).toEqual(['tap'])

      const beyond = setup()
      beyond.recognizer.down(make(1, 50, 50))
      beyond.recognizer.move(make(1, 50 + slop + 1, 50))
      beyond.recognizer.up(make(1, 50 + slop + 1, 50))
      expect(beyond.log.types()).toEqual(['dragStart', 'dragEnd'])
    }
  })

  test('slop is the distance, not each axis: a 6 by 6 move is 8.5 px and a drag for touch', () => {
    const { log, recognizer } = setup()
    recognizer.down(touch(1, 0, 0))
    recognizer.move(touch(1, 6, 6))
    expect(log.types()).toEqual(['dragStart'])
  })

  test('slop options replace the defaults', () => {
    const { log, recognizer } = setup({ slop: { touch: 20 } })
    recognizer.down(touch(1, 0, 0))
    recognizer.move(touch(1, 15, 0))
    recognizer.up(touch(1, 15, 0))
    expect(log.types()).toEqual(['tap'])
  })
})

describe('long press', () => {
  test('a hold of 450 ms inside the slop fires longPress once and the release is not a tap', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 30, 40))
    clock.advance(449)
    expect(log.types()).toEqual([])
    clock.advance(1)
    expect(log.types()).toEqual(['longPress'])
    expect(log.of('longPress')[0]).toMatchObject({ x: 30, y: 40, pointerType: 'touch' })
    clock.advance(2000)
    recognizer.up(touch(1, 30, 40))
    expect(log.types()).toEqual(['longPress'])
  })

  test('a release before 450 ms cancels the timer', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 30, 40))
    clock.advance(200)
    recognizer.up(touch(1, 30, 40))
    clock.advance(1000)
    expect(log.types()).toEqual(['tap'])
  })
})

describe('drag', () => {
  test('travel past the slop fires dragStart once, drag per move, then dragEnd on release', () => {
    const { log, recognizer } = setup()
    recognizer.down(mouse(10, 10))
    recognizer.move(mouse(12, 10))
    expect(log.types()).toEqual([])
    recognizer.move(mouse(20, 14))
    recognizer.move(mouse(30, 14, { modifiers: SHIFT }))
    recognizer.up(mouse(35, 20))
    expect(log.types()).toEqual(['dragStart', 'drag', 'dragEnd'])
    expect(log.of('dragStart')[0]).toMatchObject({
      x: 20,
      y: 14,
      startX: 10,
      startY: 10,
      dx: 10,
      dy: 4,
      afterLongPress: false,
      pointerType: 'mouse',
      button: 0,
    })
    expect(log.of('drag')[0]).toMatchObject({ x: 30, y: 14, startX: 10, startY: 10, dx: 10, dy: 0 })
    expect(log.of('dragEnd')[0]).toMatchObject({ x: 35, y: 20, dx: 5, dy: 6, cancelled: false })
    expect(log.of<{ modifiers: { shift: boolean } }>('drag')[0]?.modifiers.shift).toBe(true)
  })

  test('drag events carry pressure, tilt and the button of the press', () => {
    const { log, recognizer } = setup()
    recognizer.down(pen(7, 0, 0, { pressure: 0.2, tiltX: 10, tiltY: -5 }))
    recognizer.move(pen(7, 10, 0, { pressure: 0.6, tiltX: 12, tiltY: -4 }))
    expect(log.of('dragStart')[0]).toMatchObject({ pressure: 0.6, tiltX: 12, tiltY: -4, pointerType: 'pen' })
    recognizer.down(mouse(0, 0, { button: 2 }))
    expect(log.of('dragStart')).toHaveLength(1)
  })

  test('the long-press timer is cancelled by the drag', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 0, 0))
    clock.advance(100)
    recognizer.move(touch(1, 30, 0))
    clock.advance(1000)
    expect(log.types()).toEqual(['dragStart'])
  })

  test('a drag that begins after the long press fired says afterLongPress', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 0, 0))
    clock.advance(500)
    recognizer.move(touch(1, 40, 0))
    expect(log.types()).toEqual(['longPress', 'dragStart'])
    expect(log.of('dragStart')[0]).toMatchObject({ afterLongPress: true })
  })

  test('cancel mid-drag fires dragEnd with cancelled and nothing after', () => {
    const { log, recognizer } = setup()
    recognizer.down(mouse(0, 0))
    recognizer.move(mouse(20, 0))
    recognizer.cancel(1)
    recognizer.move(mouse(50, 0))
    recognizer.up(mouse(50, 0))
    expect(log.types()).toEqual(['dragStart', 'dragEnd'])
    expect(log.of('dragEnd')[0]).toMatchObject({ cancelled: true, x: 20, y: 0, dx: 0, dy: 0 })
  })

  test('cancelling a press that never dragged fires nothing, not even a tap', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 5, 5))
    recognizer.cancel(1)
    clock.advance(1000)
    recognizer.up(touch(1, 5, 5))
    expect(log.types()).toEqual([])
  })

  test('moves before the press, after the release and for unknown pointers are ignored', () => {
    const { log, recognizer } = setup()
    recognizer.move(mouse(100, 100))
    recognizer.down(mouse(0, 0))
    recognizer.up(mouse(0, 0))
    recognizer.move(mouse(100, 100))
    recognizer.move(touch(9, 100, 100))
    expect(log.types()).toEqual(['tap'])
  })

  test('a press while another pointer of the same kind is the primary press is ignored', () => {
    const { log, recognizer } = setup()
    recognizer.down(mouse(0, 0))
    recognizer.down({ ...mouse(50, 50), id: 2 })
    recognizer.move(mouse(30, 0))
    recognizer.up(mouse(30, 0))
    expect(log.types()).toEqual(['dragStart', 'dragEnd'])
  })
})

describe('palm rejection', () => {
  test('with the pen down, a touch tap, long press and drag produce nothing and the pen stroke is unaffected', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(pen(1, 100, 100))
    recognizer.down(touch(2, 300, 300))
    recognizer.move(pen(1, 120, 100))
    recognizer.move(touch(2, 340, 300))
    clock.advance(600)
    recognizer.move(pen(1, 140, 100))
    recognizer.up(touch(2, 340, 300))
    recognizer.up(pen(1, 140, 100))
    expect(log.fired.map((f) => `${f.type}:${(f.event as { pointerType?: string }).pointerType}`)).toEqual([
      'dragStart:pen',
      'drag:pen',
      'dragEnd:pen',
    ])
  })

  test('a touch within 300 ms of a pen hover is a palm; one after 300 ms is not', () => {
    const { clock, log, recognizer } = setup()
    recognizer.hover(pen(1, 50, 50))
    clock.advance(300)
    recognizer.down(touch(2, 200, 200))
    recognizer.up(touch(2, 200, 200))
    expect(log.of('tap')).toEqual([])
    clock.advance(301)
    recognizer.down(touch(3, 200, 200))
    recognizer.up(touch(3, 200, 200))
    expect(log.of('tap')).toHaveLength(1)
  })

  test('a touch right after the pen lifts is a palm too', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(pen(1, 10, 10))
    recognizer.up(pen(1, 10, 10))
    clock.advance(100)
    recognizer.down(touch(2, 200, 200))
    recognizer.up(touch(2, 200, 200))
    expect(log.of<{ pointerType: string }>('tap').map((tap) => tap.pointerType)).toEqual(['pen'])
  })

  test('a pen going down cancels a touch drag in flight', () => {
    const { log, recognizer } = setup()
    recognizer.down(touch(1, 0, 0))
    recognizer.move(touch(1, 30, 0))
    recognizer.down(pen(2, 100, 100))
    recognizer.move(touch(1, 60, 0))
    recognizer.up(touch(1, 60, 0))
    expect(log.types()).toEqual(['dragStart', 'dragEnd'])
    expect(log.of('dragEnd')[0]).toMatchObject({ cancelled: true, pointerType: 'touch' })
  })

  test('a palm stays a palm after the pen lifts, until it lifts itself', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(pen(1, 10, 10))
    recognizer.down(touch(2, 200, 200))
    recognizer.up(pen(1, 10, 10))
    clock.advance(2000)
    recognizer.move(touch(2, 260, 200))
    recognizer.up(touch(2, 260, 200))
    expect(log.of('dragStart')).toEqual([])
    expect(log.of<{ pointerType: string }>('tap').map((tap) => tap.pointerType)).toEqual(['pen'])
  })
})
