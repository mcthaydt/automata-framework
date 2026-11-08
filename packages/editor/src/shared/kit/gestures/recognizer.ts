import { type GestureClock, realClock } from './gesture-clock'
import type { DragEndGesture, DragGesture, GestureHandlers } from './gesture-events'
import type { PointerKind, PointerSample, WheelInput } from './pointer-sample'
import { createCluster, type TouchCluster, type TouchPoint } from './touch-cluster'

// The pointer pipeline's rules over plain samples, with no DOM: slop, timings, tap counting
// and drag. The adapter (`attach-gestures.ts`) turns Pointer Events into samples; tests feed samples by hand with a
// fake clock.

export interface GestureOptions {
  /** Travel in pixels before a press becomes a drag. Defaults: touch 8, pen 4, mouse 3. */
  readonly slop?: Partial<Record<PointerKind, number>>
  /** A release this soon after the press is a tap. Default 300. */
  readonly tapMs?: number
  /** A press held this long inside the slop is a long press. Default 450. */
  readonly longPressMs?: number
  /** Taps this close together (release to release) count as a row. Default 300. */
  readonly doubleTapMs?: number
  /** A touch that lands this soon after the pen was last seen is a palm. Default 300. */
  readonly penHoldMs?: number
  /** Report the rotation of a pinch (radians). Default false: a 2D editor cannot rotate by accident. */
  readonly rotate?: boolean
}

const DEFAULT_SLOP: Readonly<Record<PointerKind, number>> = { touch: 8, pen: 4, mouse: 3 }
/** Taps in a row may land this many slops apart. */
const REPEAT_SLOPS = 3
/** A zoom step never counts for more than this many wheel pixels, so a notched mouse wheel is not a lurch. */
const WHEEL_STEP_LIMIT = 100
/** Wheel pixels that double the zoom. */
const WHEEL_PIXELS_PER_DOUBLING = 200

export interface Recognizer {
  down(sample: PointerSample): void
  move(sample: PointerSample): void
  up(sample: PointerSample): void
  /** A pen above the surface, or a mouse with no button down. A pen hover keeps the pen "seen" for palm rejection. */
  hover(sample: PointerSample): void
  wheel(input: WheelInput): void
  /** The system took the pointer away (`pointercancel`, lost capture): the gesture ends cancelled and never commits. */
  cancel(id: number): void
  dispose(): void
}

interface Press {
  readonly id: number
  readonly kind: PointerKind
  readonly startX: number
  readonly startY: number
  readonly downAt: number
  readonly button: number
  /** The latest sample of this pointer. */
  last: PointerSample
  dragging: boolean
  longPressed: boolean
  timer: unknown
}

interface Touch extends TouchPoint {
  /** Landed while the pen was active: makes no tap, long press or drag, only a pair's pan and pinch. */
  readonly palm: boolean
  /** The pen is (or was, when this landed) in contact: this touch does nothing until it lifts. */
  ignored: boolean
}

interface LastTap {
  readonly x: number
  readonly y: number
  readonly at: number
  readonly kind: PointerKind
  readonly count: number
}

export function createRecognizer(
  handlers: GestureHandlers,
  options: GestureOptions = {},
  clock: GestureClock = realClock,
): Recognizer {
  const slopOf = (kind: PointerKind): number => options.slop?.[kind] ?? DEFAULT_SLOP[kind]
  const tapMs = options.tapMs ?? 300
  const longPressMs = options.longPressMs ?? 450
  const doubleTapMs = options.doubleTapMs ?? 300
  const penHoldMs = options.penHoldMs ?? 300
  const clusterEnv = {
    handlers,
    slop: slopOf('touch'),
    tapMs,
    rotate: options.rotate ?? false,
    now: () => clock.now(),
  }

  let press: Press | undefined
  let lastTap: LastTap | undefined
  /** Pen pointers in contact. While any is, touches are ignored entirely. */
  const penDown = new Set<number>()
  let penSeenAt: number | undefined
  /** Every touch pointer that is down. */
  const touches = new Map<number, Touch>()
  let cluster: TouchCluster | undefined
  let disposed = false

  const dragEvent = (sample: PointerSample, p: Press, dx: number, dy: number): DragGesture => ({
    x: sample.x,
    y: sample.y,
    startX: p.startX,
    startY: p.startY,
    dx,
    dy,
    pressure: sample.pressure,
    tiltX: sample.tiltX,
    tiltY: sample.tiltY,
    pointerType: p.kind,
    button: p.button,
    modifiers: sample.modifiers,
  })

  function endPress(): void {
    if (press?.timer !== undefined) clock.clearTimer(press.timer)
    press = undefined
  }

  function penActive(): boolean {
    return penDown.size > 0 || (penSeenAt !== undefined && clock.now() - penSeenAt <= penHoldMs)
  }

  /** Ends the press without a tap or a long press; a drag in flight ends cancelled. */
  function abandonPress(): void {
    const p = press
    if (p === undefined) return
    endPress()
    if (p.dragging) finishDrag(p.last, p, true)
  }

  function finishDrag(sample: PointerSample, p: Press, cancelled: boolean): void {
    const dx = cancelled ? 0 : sample.x - p.last.x
    const dy = cancelled ? 0 : sample.y - p.last.y
    const event: DragEndGesture = { ...dragEvent(sample, p, dx, dy), cancelled }
    handlers.dragEnd?.(event)
  }

  function releaseAsTap(sample: PointerSample, p: Press): void {
    const now = clock.now()
    if (now - p.downAt > tapMs) return
    const repeat =
      lastTap !== undefined &&
      lastTap.kind === p.kind &&
      now - lastTap.at <= doubleTapMs &&
      Math.hypot(sample.x - lastTap.x, sample.y - lastTap.y) <= slopOf(p.kind) * REPEAT_SLOPS
    const count = repeat && lastTap ? lastTap.count + 1 : 1
    lastTap = { x: sample.x, y: sample.y, at: now, kind: p.kind, count }
    const event = { x: sample.x, y: sample.y, count, pointerType: p.kind, modifiers: sample.modifiers }
    handlers.tap?.(event)
    if (count === 2) handlers.doubleTap?.(event)
  }

  function startPress(sample: PointerSample): void {
    if (press !== undefined) return
    const started: Press = {
      id: sample.id,
      kind: sample.kind,
      startX: sample.x,
      startY: sample.y,
      downAt: clock.now(),
      button: sample.button,
      last: sample,
      dragging: false,
      longPressed: false,
      timer: undefined,
    }
    started.timer = clock.setTimer(longPressMs, () => {
      started.timer = undefined
      if (disposed || press !== started || started.dragging) return
      started.longPressed = true
      handlers.longPress?.({
        x: started.startX,
        y: started.startY,
        pointerType: started.kind,
        modifiers: sample.modifiers,
      })
    })
    press = started
  }

  /** The pen wins: every finger becomes a palm and a gesture in flight ends cancelled. */
  function penTakesOver(): void {
    if (press?.kind === 'touch') abandonPress()
    cluster?.abort()
    cluster = undefined
    for (const point of touches.values()) point.ignored = true
  }

  function touchDown(sample: PointerSample): void {
    const point: Touch = {
      id: sample.id,
      startX: sample.x,
      startY: sample.y,
      x: sample.x,
      y: sample.y,
      downAt: clock.now(),
      palm: penActive(),
      ignored: penDown.size > 0,
    }
    touches.set(point.id, point)
    if (point.ignored) return
    if (cluster) {
      cluster.join(point)
      return
    }
    const others = [...touches.values()].filter((other) => other !== point && !other.ignored)
    if (others.length > 0) {
      if (press?.kind === 'touch') abandonPress()
      cluster = createCluster(clusterEnv, [...others, point])
      return
    }
    if (!point.palm) startPress(sample)
  }

  function touchEnded(id: number, cancelled: boolean): boolean {
    const point = touches.get(id)
    if (point === undefined) return false
    touches.delete(id)
    if (cluster?.has(id)) {
      cluster.lift(id, cancelled)
      if (cluster.empty) cluster = undefined
      return true
    }
    return false
  }

  return {
    down(sample) {
      if (disposed) return
      if (sample.kind === 'pen') {
        penDown.add(sample.id)
        penSeenAt = clock.now()
        penTakesOver()
      } else if (sample.kind === 'touch') {
        touchDown(sample)
        return
      }
      startPress(sample)
    },

    move(sample) {
      if (disposed) return
      if (sample.kind === 'pen') penSeenAt = clock.now()
      const point = touches.get(sample.id)
      if (point) {
        point.x = sample.x
        point.y = sample.y
        if (cluster?.has(point.id)) {
          cluster.move(point)
          return
        }
      }
      const p = press
      if (p === undefined || p.id !== sample.id) return
      if (!p.dragging) {
        if (Math.hypot(sample.x - p.startX, sample.y - p.startY) <= slopOf(p.kind)) return
        p.dragging = true
        if (p.timer !== undefined) clock.clearTimer(p.timer)
        p.timer = undefined
        handlers.dragStart?.({
          ...dragEvent(sample, p, sample.x - p.startX, sample.y - p.startY),
          afterLongPress: p.longPressed,
        })
      } else {
        handlers.drag?.(dragEvent(sample, p, sample.x - p.last.x, sample.y - p.last.y))
      }
      p.last = sample
    },

    up(sample) {
      if (disposed) return
      if (sample.kind === 'pen') {
        penDown.delete(sample.id)
        penSeenAt = clock.now()
      }
      if (touchEnded(sample.id, false)) return
      const p = press
      if (p === undefined || p.id !== sample.id) return
      endPress()
      if (p.dragging) finishDrag(sample, p, false)
      else if (!p.longPressed) releaseAsTap(sample, p)
    },

    hover(sample) {
      if (disposed || sample.kind === 'touch') return
      if (sample.kind === 'pen') penSeenAt = clock.now()
      handlers.hover?.({
        x: sample.x,
        y: sample.y,
        pointerType: sample.kind,
        pressure: sample.pressure,
        tiltX: sample.tiltX,
        tiltY: sample.tiltY,
        modifiers: sample.modifiers,
      })
    },

    wheel(input) {
      if (disposed) return
      const zoom = input.modifiers.ctrl || input.modifiers.meta
      const step = Math.max(-WHEEL_STEP_LIMIT, Math.min(WHEEL_STEP_LIMIT, input.deltaY))
      handlers.wheel?.({
        mode: zoom ? 'zoom' : 'pan',
        x: input.x,
        y: input.y,
        dx: zoom ? 0 : -input.deltaX,
        dy: zoom ? 0 : -input.deltaY,
        scale: zoom ? 2 ** (-step / WHEEL_PIXELS_PER_DOUBLING) : 1,
        modifiers: input.modifiers,
      })
    },

    cancel(id) {
      if (disposed) return
      if (penDown.delete(id)) penSeenAt = clock.now()
      if (touchEnded(id, true)) return
      if (press?.id === id) abandonPress()
    },

    dispose() {
      disposed = true
      endPress()
      cluster = undefined
      touches.clear()
    },
  }
}
