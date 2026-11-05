import { describe, expect, it } from 'vitest'
import {
  GESTURE_TUNING,
  type GestureSink,
  type GestureTuning,
  SwipeTracker,
} from '#src/features/input/gestures/swipe-tracker.ts'
import type { GestureName } from '#src/features/input/input-profile.schema.ts'

// Swipe steering and flicks (M4 spec §4.4). FloorFifty's `tests/client/systems/gameplay/swipe-tracker.test.ts` at
// `ac72660`, as behavior: its left/right/fastFall are AF's swipe-left/swipe-right/flick-down, and the times are
// passed in (`PointerEvent.timeStamp`) instead of read from an injected clock.

const rig = (tuning?: Partial<GestureTuning>) => {
  const held = new Set<GestureName>()
  const pulses: GestureName[] = []
  const tracker = new SwipeTracker(
    {
      hold: (gesture) => void held.add(gesture),
      release: (gesture) => void held.delete(gesture),
      pulse: (gesture) => void pulses.push(gesture),
    },
    tuning,
  )
  return { tracker, held, pulses }
}

describe('tuning', () => {
  it("defaults to FloorFifty's values", () => {
    expect(GESTURE_TUNING).toEqual({ deadZonePx: 12, saturationPx: 48, flickPx: 40, flickMs: 180 })
  })

  it('overrides one value and keeps the rest', () => {
    const { tracker, held } = rig({ deadZonePx: 48 })
    expect(tracker.tuning).toEqual({ ...GESTURE_TUNING, deadZonePx: 48 })
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 147, 500, 10)
    expect(held.size).toBe(0)
    tracker.move(1, 148, 500, 20)
    expect([...held]).toEqual(['swipe-right'])
  })
})

describe('floating-anchor steering', () => {
  it('does nothing inside the 12 px dead zone', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 111, 500, 10)
    expect(held.size).toBe(0)
    expect(tracker.indicator?.steering).toBe(false)
  })

  it('steers once the thumb is 12 px from where it landed', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 112, 500, 10)
    expect([...held]).toEqual(['swipe-right'])
    expect(tracker.indicator).toEqual({
      anchor: { x: 100, y: 500 },
      thumb: { x: 112, y: 500 },
      steering: true,
    })
  })

  it('drags the anchor behind the thumb, so reversing always costs the same short move', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 400, 500, 10) // the anchor trails to 352
    tracker.move(1, 341, 500, 20) // 11 px left of the anchor: dead zone
    expect(held.size).toBe(0)
    tracker.move(1, 340, 500, 30) // 12 px left: steering left
    expect([...held]).toEqual(['swipe-left'])
  })

  it('steers up and down on the same rules', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 100, 488, 400)
    expect([...held]).toEqual(['swipe-up'])
    tracker.move(1, 100, 600, 800) // the anchor trails to 552, 48 px above the thumb
    expect([...held]).toEqual(['swipe-down'])
  })

  it('holds a diagonal on both axes', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 130, 470, 400)
    expect([...held].sort()).toEqual(['swipe-right', 'swipe-up'])
  })

  it('releases steering when the finger lifts', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 150, 500, 10)
    tracker.up(1, 150, 500, 20)
    expect(held.size).toBe(0)
    expect(tracker.indicator).toBeUndefined()
  })
})

describe('flick down (I-f)', () => {
  it('pulses for 40 px down within 180 ms', () => {
    const { tracker, pulses, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 100, 540, 180)
    expect(pulses).toEqual(['flick-down'])
    expect(held.has('flick-down')).toBe(false) // a pulse; Input latches it for one sample
  })

  it('does not pulse for 39 px within 180 ms', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 100, 539, 180)
    expect(pulses).toEqual([])
  })

  it('does not pulse for 40 px over 181 ms', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 100, 540, 181)
    expect(pulses).toEqual([])
  })

  it('ignores a slow drag down', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 100, 560, 300)
    expect(pulses).toEqual([])
  })

  it('pulses once per flick: the samples restart after it', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 100, 541, 100)
    tracker.move(1, 100, 560, 120)
    expect(pulses).toEqual(['flick-down'])
  })
})

// FloorFifty (Owner, 2026-10-10): any finger may flick; only a finger the surface lets steer steers.
describe('a finger that may not steer', () => {
  it('still flicks', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 100, 0, { steers: false })
    tracker.move(1, 100, 141, 120)
    expect(pulses).toEqual(['flick-down'])
  })

  it('never steers, and leaves steering to the next finger that may', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 100, 0, { steers: false })
    tracker.move(1, 200, 100, 10)
    expect(held.size).toBe(0)
    tracker.down(2, 300, 600, 20)
    tracker.move(2, 340, 600, 30)
    expect([...held]).toEqual(['swipe-right'])
  })
})

describe('two thumbs', () => {
  it('flicks from a second finger while the first holds its steer', () => {
    const { tracker, held, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 150, 500, 10)
    tracker.down(2, 300, 500, 900)
    tracker.move(2, 300, 545, 1000)
    expect(pulses).toEqual(['flick-down'])
    expect([...held]).toEqual(['swipe-right'])
    tracker.up(2, 300, 545, 1010)
    expect([...held]).toEqual(['swipe-right'])
  })

  it('never steers from the second finger', () => {
    const { tracker, held } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.down(2, 300, 500, 10)
    tracker.move(2, 380, 500, 20)
    expect(held.size).toBe(0)
  })
})

// Not in FloorFifty or The Last Light: AF's rule, for review (plan, "Tap").
describe('tap', () => {
  it('pulses for a finger lifted within 180 ms that never left the dead zone', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 105, 503, 60)
    tracker.up(1, 105, 503, 180)
    expect(pulses).toEqual(['tap'])
  })

  it('does not pulse for a touch held longer than 180 ms', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.up(1, 100, 500, 181)
    expect(pulses).toEqual([])
  })

  it('does not pulse for a finger that left the dead zone, even if it came back', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 120, 500, 40)
    tracker.move(1, 100, 500, 80)
    tracker.up(1, 100, 500, 100)
    expect(pulses).toEqual([])
  })

  it('taps from a finger that may not steer', () => {
    const { tracker, pulses } = rig()
    tracker.down(1, 100, 100, 0, { steers: false })
    tracker.up(1, 100, 100, 50)
    expect(pulses).toEqual(['tap'])
  })
})

describe('cancel', () => {
  it('releases everything and pulses nothing', () => {
    const { tracker, held, pulses } = rig()
    tracker.down(1, 100, 500, 0)
    tracker.move(1, 150, 500, 10)
    tracker.cancel()
    expect(held.size).toBe(0)
    expect(tracker.indicator).toBeUndefined()
    tracker.up(1, 150, 500, 20)
    expect(pulses).toEqual([])
  })
})

// The camera drag is analog (M4.12): no gesture sink holds or pulses it.
describe('GestureSink', () => {
  it('takes only the swipes, the flick and the tap', () => {
    const sink: GestureSink = { hold: () => undefined, release: () => undefined, pulse: () => undefined }
    // @ts-expect-error `camera-drag` is not a held or pulsed gesture.
    sink.hold('camera-drag')
    // @ts-expect-error `camera-drag` is not a held or pulsed gesture.
    sink.pulse('camera-drag')
    sink.hold('swipe-left')
  })
})
