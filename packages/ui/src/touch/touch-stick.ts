// The floating move stick (M4 spec §16.3.3), from The Last Light `src/input.ts` at `92e6704` (`STICK_RADIUS`,
// `stickVector`). Its dead zone (`STICK_DEAD` 0.25) is not here: runtime's `Input.touchStick` applies the pad's
// radial dead zone, 0.25 too, so the pad and the thumb share one (M4-D13).

/** The stick's reach in CSS px: a thumb this far from where it landed is a full push. */
export const TOUCH_STICK_RADIUS_PX = 48

/** A drag from the stick's origin as a vector clamped to length 1; `y` is positive down, as a pad's axes. */
export function stickVector(
  dx: number,
  dy: number,
  radius: number = TOUCH_STICK_RADIUS_PX,
): { x: number; y: number } {
  const length = Math.hypot(dx, dy) / radius
  if (length === 0) return { x: 0, y: 0 }
  const scale = Math.min(1, length) / length / radius
  return { x: dx * scale, y: dy * scale }
}
