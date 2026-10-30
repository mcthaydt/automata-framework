import { describe, expect, it } from 'vitest'
import { stickVector, TOUCH_STICK_RADIUS_PX } from './touch-stick'

// The floating move stick's vector (M4 spec §16.3.3), from The Last Light `src/input.ts` at `92e6704` and its test
// "stick vectors have a dead zone and clamp to length 1". The dead zone moved to runtime (`Input.touchStick`, M4-D13),
// so this only clamps; its second axis is `y`, positive down, as a pad's.
describe('stickVector', () => {
  it('is the drag over the radius, clamped to length 1', () => {
    expect(TOUCH_STICK_RADIUS_PX).toBe(48)
    expect(stickVector(TOUCH_STICK_RADIUS_PX / 2, 0)).toEqual({ x: 0.5, y: 0 })
    expect(stickVector(0, -TOUCH_STICK_RADIUS_PX)).toEqual({ x: 0, y: -1 })
    const far = stickVector(TOUCH_STICK_RADIUS_PX * 3, TOUCH_STICK_RADIUS_PX * 3)
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(1)
    expect(far.x).toBeCloseTo(Math.SQRT1_2)
  })

  it('keeps a small push for runtime’s dead zone to judge, and centres at the origin', () => {
    expect(stickVector(TOUCH_STICK_RADIUS_PX * 0.1, 0)).toEqual({ x: 0.1, y: 0 })
    expect(stickVector(0, 0)).toEqual({ x: 0, y: 0 })
  })

  it('keeps the direction off the octants: an analog direction', () => {
    const analog = stickVector(30, -10)
    expect(Math.atan2(analog.y, analog.x)).toBeCloseTo(Math.atan2(-10, 30))
  })

  it('takes another radius', () => {
    expect(stickVector(30, 0, 60)).toEqual({ x: 0.5, y: 0 })
  })
})
