import { describe, expect, test } from 'vitest'
import { logGestures, pen, touch } from '../testing/fake-pointer'
import { createTestClock } from '../testing/test-clock'
import type { GestureOptions } from './recognizer'
import { createRecognizer } from './recognizer'

function setup(options?: GestureOptions) {
  const clock = createTestClock()
  const log = logGestures()
  const recognizer = createRecognizer(log.handlers, options, clock)
  return { clock, log, recognizer }
}

/** Two fingers down 100 px apart on a horizontal line at y = 100. */
function twoFingers(options?: GestureOptions) {
  const rig = setup(options)
  rig.recognizer.down(touch(1, 100, 100))
  rig.recognizer.down(touch(2, 200, 100))
  return rig
}

type Transform = { phase: string; x: number; y: number; dx: number; dy: number; cancelled: boolean }
type Pinch = {
  phase: string
  x: number
  y: number
  scale: number
  totalScale: number
  rotation: number
  totalRotation: number
  cancelled: boolean
}

describe('two touches: pan and pinch', () => {
  test('a second touch during a drag ends the drag cancelled and starts a pair', () => {
    const { log, recognizer } = setup()
    recognizer.down(touch(1, 100, 100))
    recognizer.move(touch(1, 140, 100))
    recognizer.down(touch(2, 300, 100))
    expect(log.types()).toEqual(['dragStart', 'dragEnd'])
    expect(log.of('dragEnd')[0]).toMatchObject({ cancelled: true, pointerType: 'touch' })
    recognizer.move(touch(1, 150, 100))
    expect(log.of('drag')).toEqual([])
  })

  test('a pair is silent until its centre or spread has travelled past the touch slop', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 200, 105))
    expect(log.types()).toEqual([])
    recognizer.move(touch(2, 200, 100))
    recognizer.move(touch(2, 209, 100))
    expect(log.types()).toEqual(['pan', 'pinch'])
    expect(log.of<Transform>('pan')[0]).toMatchObject({ phase: 'start' })
    expect(log.of<Pinch>('pinch')[0]).toMatchObject({ phase: 'start' })
  })

  test('moving the fingers apart scales above 1 and totalScale is the product of the steps', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 230, 100))
    recognizer.move(touch(2, 256, 100))
    const pinches = log.of<Pinch>('pinch')
    expect(pinches.map((p) => p.phase)).toEqual(['start', 'change'])
    expect(pinches[0]?.scale).toBeCloseTo(1.3)
    expect(pinches[1]?.scale).toBeCloseTo(156 / 130)
    expect(pinches[1]?.totalScale).toBeCloseTo(1.56)
    expect(pinches[1]).toMatchObject({ x: 178, y: 100 })
  })

  test('moving the fingers together scales below 1', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 150, 100))
    expect(log.of<Pinch>('pinch')[0]?.scale).toBeCloseTo(0.5)
  })

  test('the pan carries how far the centre moved', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(1, 120, 110))
    recognizer.move(touch(2, 220, 110))
    const pans = log.of<Transform>('pan')
    expect(pans[0]).toMatchObject({ phase: 'start', x: 160, y: 105, dx: 10, dy: 5 })
    expect(pans[1]).toMatchObject({ phase: 'change', x: 170, y: 110, dx: 10, dy: 5 })
  })

  test('rotation is 0 unless the options ask for it, and then it is exact', () => {
    const quarterTurn = (options?: GestureOptions) => {
      const { log, recognizer } = twoFingers(options)
      recognizer.move(touch(2, 100, 200))
      return log.of<Pinch>('pinch')[0]
    }
    expect(quarterTurn()?.rotation).toBe(0)
    expect(quarterTurn()?.totalRotation).toBe(0)
    expect(quarterTurn({ rotate: true })?.rotation).toBeCloseTo(Math.PI / 2)
    expect(quarterTurn({ rotate: true })?.totalRotation).toBeCloseTo(Math.PI / 2)
  })

  test('lifting one finger ends the transform; the other finger is inert until it lifts', () => {
    const { clock, log, recognizer } = twoFingers()
    recognizer.move(touch(2, 260, 100))
    recognizer.up(touch(2, 260, 100))
    expect(log.of<Transform>('pan').map((p) => [p.phase, p.cancelled])).toEqual([
      ['start', false],
      ['end', false],
    ])
    expect(log.of<Pinch>('pinch').map((p) => p.phase)).toEqual(['start', 'end'])
    const before = log.fired.length
    recognizer.move(touch(1, 300, 300))
    clock.advance(1000)
    recognizer.up(touch(1, 300, 300))
    expect(log.fired).toHaveLength(before)
  })

  test('cancelling either pointer ends the transform cancelled', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 260, 100))
    recognizer.cancel(1)
    expect(log.of<Transform>('pan').at(-1)).toMatchObject({ phase: 'end', cancelled: true })
    expect(log.of<Pinch>('pinch').at(-1)).toMatchObject({ phase: 'end', cancelled: true })
  })

  test('a third finger ends a transform, without a multiTap', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 260, 100))
    recognizer.down(touch(3, 150, 300))
    expect(log.of<Transform>('pan').at(-1)).toMatchObject({ phase: 'end', cancelled: false })
    recognizer.up(touch(1, 100, 100))
    recognizer.up(touch(2, 260, 100))
    recognizer.up(touch(3, 150, 300))
    expect(log.of('multiTap')).toEqual([])
  })

  test('a single touch works again once the cluster has lifted', () => {
    const { clock, log, recognizer } = twoFingers()
    recognizer.move(touch(2, 260, 100))
    recognizer.up(touch(1, 100, 100))
    recognizer.up(touch(2, 260, 100))
    clock.advance(50)
    recognizer.down(touch(3, 10, 10))
    recognizer.up(touch(3, 10, 10))
    expect(log.of('tap')).toHaveLength(1)
  })
})

describe('two touches: multiTap', () => {
  test('a quick, still tap by two fingers is a multiTap of 2 where they landed, and no tap', () => {
    const { clock, log, recognizer } = twoFingers()
    clock.advance(100)
    recognizer.up(touch(1, 100, 100))
    clock.advance(20)
    recognizer.up(touch(2, 200, 100))
    expect(log.types()).toEqual(['multiTap'])
    expect(log.of('multiTap')[0]).toEqual({ x: 150, y: 100, fingers: 2 })
  })

  test('three fingers are a multiTap of 3', () => {
    const { clock, log, recognizer } = twoFingers()
    recognizer.down(touch(3, 150, 200))
    clock.advance(80)
    for (const id of [1, 2, 3]) recognizer.up(touch(id, 0, 0))
    expect(log.of('multiTap')[0]).toMatchObject({ fingers: 3 })
  })

  test('slower than 300 ms is not a multiTap', () => {
    const { clock, log, recognizer } = twoFingers()
    clock.advance(301)
    recognizer.up(touch(1, 100, 100))
    recognizer.up(touch(2, 200, 100))
    expect(log.types()).toEqual([])
  })

  test('a finger that moved past the slop, even sideways, is not a multiTap', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 200, 112))
    expect(log.types()).toEqual([])
    recognizer.up(touch(1, 100, 100))
    recognizer.up(touch(2, 200, 112))
    expect(log.types()).toEqual([])
  })

  test('a pinch that began is not a multiTap when the fingers lift', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 260, 100))
    recognizer.up(touch(1, 100, 100))
    recognizer.up(touch(2, 260, 100))
    expect(log.of('multiTap')).toEqual([])
  })

  test('the first finger of a pair makes no tap, and a long first press cannot become a multiTap', () => {
    const { clock, log, recognizer } = setup()
    recognizer.down(touch(1, 100, 100))
    clock.advance(460)
    recognizer.down(touch(2, 200, 100))
    recognizer.up(touch(1, 100, 100))
    recognizer.up(touch(2, 200, 100))
    expect(log.types()).toEqual(['longPress'])
  })
})

describe('two touches with the pen about', () => {
  test('two palms still pan and pinch while the pen only hovers', () => {
    const { log, recognizer } = setup()
    recognizer.hover(pen(9, 500, 500))
    recognizer.down(touch(1, 100, 100))
    recognizer.down(touch(2, 200, 100))
    recognizer.move(touch(2, 260, 100))
    expect(log.types()).toEqual(['hover', 'pan', 'pinch'])
  })

  test('with the pen in contact touches are ignored entirely', () => {
    const { log, recognizer } = setup()
    recognizer.down(pen(9, 500, 500))
    recognizer.down(touch(1, 100, 100))
    recognizer.down(touch(2, 200, 100))
    recognizer.move(touch(2, 260, 100))
    recognizer.up(touch(1, 100, 100))
    recognizer.up(touch(2, 260, 100))
    expect(log.types()).toEqual([])
  })

  test('the pen going down ends a transform cancelled', () => {
    const { log, recognizer } = twoFingers()
    recognizer.move(touch(2, 260, 100))
    recognizer.down(pen(9, 500, 500))
    expect(log.of<Transform>('pan').at(-1)).toMatchObject({ phase: 'end', cancelled: true })
    recognizer.move(touch(2, 300, 100))
    expect(log.of('pan')).toHaveLength(2)
  })
})
