// The floating move stick, from The Last Light `src/input.ts` at `92e6704` (`STICK_RADIUS`,
// `stickVector`). Its dead zone (`STICK_DEAD` 0.25) is not here: runtime's `Input.touchStick` applies the pad's
// radial dead zone, 0.25 too, so the pad and the thumb share one.

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

/**
 * Where to draw a ring of half-size `half` whose centre would be `centre`, so that all of it lies inside `area`:
 * moved the least distance on each axis, and centred on an axis the area is too small for. Only the drawing
 * moves; the stick's origin stays where the thumb landed.
 */
export function clampRingCentre(
  centre: { readonly x: number; readonly y: number },
  half: number,
  area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): { x: number; y: number } {
  const axis = (value: number, start: number, length: number): number =>
    length < 2 * half ? start + length / 2 : Math.min(Math.max(value, start + half), start + length - half)
  return { x: axis(centre.x, area.x, area.width), y: axis(centre.y, area.y, area.height) }
}
