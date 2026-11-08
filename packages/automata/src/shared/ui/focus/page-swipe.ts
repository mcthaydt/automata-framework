/**
 * Swipe is the pagination on a paged region, on every form factor: a finger, a mouse drag, a trackpad's two-finger
 * sideways swipe.
 * A press that moves less than 8 px is a tap, so swiping never picks by accident; a quick flick turns one page
 * whatever the distance; a slow drag snaps to the nearest page.
 */

export const PAGE_SWIPE = { tapSlopPx: 8, flickPxPerMs: 0.4, wheelStepPx: 40 } as const

/** Whether a press that moved `dx`, `dy` px is a tap rather than a swipe. */
export function isTap(dx: number, dy: number): boolean {
  return Math.abs(dx) < PAGE_SWIPE.tapSlopPx && Math.abs(dy) < PAGE_SWIPE.tapSlopPx
}

/** Pages to turn when a drag of `dx` px over `dtMs` is released: a swipe left is +1 (next). */
export function releaseStep(dx: number, dtMs: number, pageWidth: number): -1 | 0 | 1 {
  if (Math.abs(dx) < PAGE_SWIPE.tapSlopPx) return 0
  const flick = Math.abs(dx) / Math.max(1, dtMs) >= PAGE_SWIPE.flickPxPerMs
  if (flick || Math.abs(dx) > pageWidth / 2) return dx < 0 ? 1 : -1
  return 0
}

/** A trackpad's horizontal wheel deltas, one page per gesture; `reset` when the gesture goes quiet. */
export class WheelPager {
  private travel = 0
  private spent = false

  push(deltaX: number, deltaY: number): -1 | 0 | 1 {
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return 0
    if (this.spent) return 0
    this.travel += deltaX
    if (Math.abs(this.travel) < PAGE_SWIPE.wheelStepPx) return 0
    this.spent = true
    return this.travel > 0 ? 1 : -1
  }

  reset(): void {
    this.travel = 0
    this.spent = false
  }
}
