/** What a SwipeSurface draws: the thumb, the anchor it trails and whether it is past the dead zone. */
export interface SwipeIndicatorView {
  readonly anchor: { readonly x: number; readonly y: number }
  readonly thumb: { readonly x: number; readonly y: number }
  readonly steering: boolean
}

/**
 * What a SwipeSurface drives: runtime's `SwipeTracker` satisfies it, so ui need not import runtime. Times are
 * `PointerEvent.timeStamp`.
 */
export interface PointerTracker {
  readonly tuning: { readonly saturationPx: number }
  readonly indicator: SwipeIndicatorView | undefined
  down(id: number, x: number, y: number, t: number, options?: { readonly steers?: boolean }): void
  move(id: number, x: number, y: number, t: number): void
  up(id: number, x: number, y: number, t: number): void
  cancel(): void
}

/** SwipeSurface's props. */
export interface SwipeSurfaceProps {
  tracker: PointerTracker
  /** Whether a finger landing at (x, y) may steer; any finger may flick or tap. Default: every finger. */
  steers?: ((x: number, y: number) => boolean) | undefined
  testId?: string | undefined
}
