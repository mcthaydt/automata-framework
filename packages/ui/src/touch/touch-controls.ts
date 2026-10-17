/**
 * The touch buttons' bookkeeping (M4 spec §4.4), from FloorFifty `systems/gameplay/touch-controls.ts` at
 * `ac72660`, over a game's action ids instead of its race's three.
 *
 * Multi-touch is the whole difficulty, and it lives here rather than in the component that draws the buttons. A
 * player holds left with one thumb and taps another button with the other, so each action tracks its own set of
 * fingers and only releases when its last one lifts.
 *
 * The buttons are sticky, as mobile action games' are: a thumb that lands just outside one still presses the
 * nearest within `STICKY_MARGIN_PX`, and a held thumb that slides onto another button moves to it. One that slides
 * off everything keeps what it holds until it lifts.
 */

/** How far outside a button a thumb still counts for it, in CSS pixels. */
export const STICKY_MARGIN_PX = 24

export interface TouchTarget {
  readonly action: string
  readonly rect: {
    readonly left: number
    readonly top: number
    readonly right: number
    readonly bottom: number
  }
}

/**
 * The button a point is on, or else the nearest within the margin, or nothing. Distance is to the button's edge,
 * so any point inside is 0.
 */
export function nearestTarget(
  x: number,
  y: number,
  targets: readonly TouchTarget[],
  margin = STICKY_MARGIN_PX,
): string | undefined {
  let best: string | undefined
  let bestDistance = margin
  for (const { action, rect } of targets) {
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = Math.max(rect.top - y, 0, y - rect.bottom)
    const distance = Math.hypot(dx, dy)
    if (distance <= bestDistance) {
      best = action
      bestDistance = distance
    }
  }
  return best
}

/**
 * Which fingers are down on which action. Reports only real changes: a second finger landing on a button already
 * held produces nothing, and lifting it produces nothing either. The action ends when its last finger lifts.
 */
export class PointerLatch {
  private readonly active = new Map<string, Set<number>>()

  constructor(private readonly onInput: (action: string, active: boolean) => void) {}

  /** True while any finger holds the action; what the pressed style reads. */
  isHeld(action: string): boolean {
    return (this.active.get(action)?.size ?? 0) > 0
  }

  press(action: string, pointerId: number): void {
    const fingers = this.active.get(action) ?? new Set()
    this.active.set(action, fingers)
    const was = fingers.size > 0
    fingers.add(pointerId)
    if (!was) this.onInput(action, true)
  }

  release(action: string, pointerId: number): void {
    const fingers = this.active.get(action)
    if (fingers === undefined || !fingers.delete(pointerId)) return
    if (fingers.size === 0) this.onInput(action, false)
  }

  /** Releases everything still held, reporting each action exactly once. */
  releaseAll(): void {
    for (const [action, fingers] of this.active) {
      if (fingers.size === 0) continue
      fingers.clear()
      this.onInput(action, false)
    }
  }
}

/**
 * Which button each finger is on, over the latch. A finger owns one button at a time: moving onto another releases
 * the first and presses the second; moving onto nothing keeps what it owns.
 */
export class StickyPointers {
  private readonly owned = new Map<number, string>()

  constructor(private readonly latch: PointerLatch) {}

  /** A finger landed on `action` (or on nothing); true when it pressed a button. */
  down(pointerId: number, action: string | undefined): boolean {
    if (action === undefined) return false
    this.owned.set(pointerId, action)
    this.latch.press(action, pointerId)
    return true
  }

  move(pointerId: number, action: string | undefined): void {
    const current = this.owned.get(pointerId)
    if (current === undefined || action === undefined || action === current) return
    this.latch.release(current, pointerId)
    this.owned.set(pointerId, action)
    this.latch.press(action, pointerId)
  }

  up(pointerId: number): void {
    const current = this.owned.get(pointerId)
    if (current === undefined) return
    this.owned.delete(pointerId)
    this.latch.release(current, pointerId)
  }

  releaseAll(): void {
    this.owned.clear()
    this.latch.releaseAll()
  }
}
