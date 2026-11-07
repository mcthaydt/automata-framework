// A hit-stop (M6 spec §4.1; from the arcade source's `hit-stop.ts`): a view's pose, its squash and the camera follow freeze for a
// beat. Its position never does: interpolation carries on underneath, so a view is never drawn somewhere the sim disagrees with.
export class HitStop {
  private fromMs = Number.POSITIVE_INFINITY
  private untilMs = Number.NEGATIVE_INFINITY

  /** Freezes from `nowMs` until `nowMs + ms`, never shortening a freeze already running. */
  start(nowMs: number, ms: number): void {
    if (!this.frozen(nowMs)) this.fromMs = nowMs
    this.untilMs = Math.max(this.untilMs, nowMs + ms)
  }

  frozen(nowMs: number): boolean {
    return nowMs >= this.fromMs && nowMs < this.untilMs
  }

  /** Ends any freeze at once: reduced motion switched on, or the scene leaving. */
  settle(): void {
    this.fromMs = Number.POSITIVE_INFINITY
    this.untilMs = Number.NEGATIVE_INFINITY
  }
}
