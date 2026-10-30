// Swipe steering, flicks and taps over pointer samples, with no DOM in it (M4 spec §4.4). From FloorFifty
// `apps/client/src/systems/gameplay/swipe-tracker.ts` at `ac72660`, generalised from its race's left/right/fast-fall
// to the profile's gesture names and given a vertical axis and a tap.
//
// Steering is held: the anchor starts where the thumb lands and trails it at the saturation distance, so reversing
// after a long drag costs the same short move as reversing from rest. The dead zone is the only threshold that
// steers; saturation is otherwise only what the indicator draws. Only the first finger that may steer steers, but
// any finger may flick, so one thumb holds a direction while the other flicks (FloorFifty, Owner 2026-10-10).
//
// Flicks and taps are pulses: the sink's owner (`Input.gesture`) latches each for one sample. Times are the
// caller's (`PointerEvent.timeStamp`); the tracker reads no clock.
import type { GestureName } from '../input-profile.schema.js'

/** Content tuning, in CSS px and ms; FloorFifty's values are the defaults. */
export interface GestureTuning {
  /** How far the thumb must be from the anchor, on an axis, to steer on it. Also how still a tap must be. */
  readonly deadZonePx: number
  /** How far the anchor lets the thumb get ahead of it. */
  readonly saturationPx: number
  /** How far down, within `flickMs`, makes a flick. */
  readonly flickPx: number
  /** A flick's window; also the longest tap. */
  readonly flickMs: number
}

/** FloorFifty's gesture tuning, the defaults. */
export const GESTURE_TUNING: GestureTuning = { deadZonePx: 12, saturationPx: 48, flickPx: 40, flickMs: 180 }

/** Where gestures go: held while a finger steers, pulsed for a flick or a tap. */
export interface GestureSink {
  hold(gesture: GestureName): void
  release(gesture: GestureName): void
  pulse(gesture: GestureName): void
}

/** What a swipe indicator draws: the anchor, the thumb, and whether the thumb is steering. */
export interface SwipeIndicator {
  readonly anchor: { readonly x: number; readonly y: number }
  readonly thumb: { readonly x: number; readonly y: number }
  /** Outside the dead zone on either axis. */
  readonly steering: boolean
}

type Direction = -1 | 0 | 1

interface Finger {
  readonly landed: { readonly x: number; readonly y: number; readonly t: number }
  /** Recent heights, for the flick window. */
  samples: { y: number; t: number }[]
  /** Ever left the dead zone of where it landed: no longer a tap. */
  wandered: boolean
}

const STEER = {
  x: { [-1]: 'swipe-left', 1: 'swipe-right' },
  y: { [-1]: 'swipe-up', 1: 'swipe-down' },
} as const satisfies Record<'x' | 'y', Record<-1 | 1, GestureName>>

/**
 * Turns pointer samples into held swipes, flicks and taps for a `GestureSink` (M4 spec §4.4); it reads no
 * clock and touches no DOM.
 */
export class SwipeTracker {
  readonly tuning: GestureTuning
  private readonly fingers = new Map<number, Finger>()
  private steerer: number | undefined
  private readonly anchor = { x: 0, y: 0 }
  private readonly thumb = { x: 0, y: 0 }
  private readonly direction: { x: Direction; y: Direction } = { x: 0, y: 0 }

  constructor(
    private readonly sink: GestureSink,
    tuning: Partial<GestureTuning> = {},
  ) {
    this.tuning = { ...GESTURE_TUNING, ...tuning }
  }

  /** Where the thumb indicator draws, or undefined while no finger steers. */
  get indicator(): SwipeIndicator | undefined {
    if (this.steerer === undefined) return undefined
    return {
      anchor: { ...this.anchor },
      thumb: { ...this.thumb },
      steering: this.direction.x !== 0 || this.direction.y !== 0,
    }
  }

  /** A finger landed. The first one that may steer steers; every one may flick or tap. */
  down(id: number, x: number, y: number, t: number, options: { readonly steers?: boolean } = {}): void {
    this.fingers.set(id, { landed: { x, y, t }, samples: [{ y, t }], wandered: false })
    if (this.steerer === undefined && options.steers !== false) {
      this.steerer = id
      this.anchor.x = this.thumb.x = x
      this.anchor.y = this.thumb.y = y
    }
  }

  /** A finger moved: look for a downward flick, and steer if it is the steerer. */
  move(id: number, x: number, y: number, t: number): void {
    const finger = this.fingers.get(id)
    if (finger === undefined) return
    const { deadZonePx, saturationPx, flickPx, flickMs } = this.tuning

    if (Math.abs(x - finger.landed.x) >= deadZonePx || Math.abs(y - finger.landed.y) >= deadZonePx)
      finger.wandered = true

    finger.samples.push({ y, t })
    finger.samples = finger.samples.filter((sample) => t - sample.t <= flickMs)
    const highest = Math.min(...finger.samples.map((sample) => sample.y))
    if (y - highest >= flickPx) {
      this.sink.pulse('flick-down')
      finger.samples = [{ y, t }]
    }

    if (id !== this.steerer) return
    this.thumb.x = x
    this.thumb.y = y
    this.steer('x', x, deadZonePx, saturationPx)
    this.steer('y', y, deadZonePx, saturationPx)
  }

  /** A finger lifted: a tap if it was quick and still; stop steering if it steered. */
  up(id: number, _x: number, _y: number, t: number): void {
    const finger = this.fingers.get(id)
    if (finger === undefined) return
    this.fingers.delete(id)
    if (!finger.wandered && t - finger.landed.t <= this.tuning.flickMs) this.sink.pulse('tap')
    if (id === this.steerer) this.stopSteering()
  }

  /** The browser took the pointers (pointercancel, lost capture of every finger): release everything. */
  cancel(): void {
    this.fingers.clear()
    this.stopSteering()
  }

  private steer(axis: 'x' | 'y', at: number, deadZonePx: number, saturationPx: number): void {
    if (at - this.anchor[axis] > saturationPx) this.anchor[axis] = at - saturationPx
    else if (this.anchor[axis] - at > saturationPx) this.anchor[axis] = at + saturationPx
    const delta = at - this.anchor[axis]
    this.setDirection(axis, delta >= deadZonePx ? 1 : delta <= -deadZonePx ? -1 : 0)
  }

  private stopSteering(): void {
    this.steerer = undefined
    this.setDirection('x', 0)
    this.setDirection('y', 0)
  }

  private setDirection(axis: 'x' | 'y', next: Direction): void {
    const previous = this.direction[axis]
    if (next === previous) return
    if (previous !== 0) this.sink.release(STEER[axis][previous])
    this.direction[axis] = next
    if (next !== 0) this.sink.hold(STEER[axis][next])
  }
}
