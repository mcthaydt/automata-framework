// Which of the painter's 8 directions a figure is drawn at, held against flicker. The painter snaps a figure's bearing from
// the camera (its facing less the camera's azimuth) to the nearest eighth of a turn, with no memory. Under a camera the
// player turns freely, or one that eases after the figure, a bearing near a boundary (22.5° off a direction) crosses it
// back and forth frame to frame and the drawing flips. The hold keeps the direction drawn until the bearing is past the
// boundary by `FACING_HOLD_DEG`, then takes the nearest. Pure: angles in, the held eighth and the facing to paint out.

/** How far past a boundary (22.5° off the held direction) the bearing must go before the drawn direction changes. */
export const FACING_HOLD_DEG = 7.5

const EIGHTH = Math.PI / 4
const LIMIT = EIGHTH / 2 + (FACING_HOLD_DEG * Math.PI) / 180

/** `angle` in (−π, π]. */
const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle))

/**
 * The eighth (0..7, of the bearing `facing − azimuth`) to draw, given the one drawn last frame (`held`, none at first), and a
 * facing that makes the painter draw exactly it: the azimuth turned by that eighth, so its own snap lands on it.
 */
export function holdFacing(
  facing: number,
  azimuth: number,
  held: number | undefined,
): { readonly eighth: number; readonly facing: number } {
  const bearing = wrap(facing - azimuth)
  const nearest = (((Math.round(bearing / EIGHTH) % 8) + 8) % 8) as number
  const eighth = held !== undefined && Math.abs(wrap(bearing - held * EIGHTH)) <= LIMIT ? held : nearest
  return { eighth, facing: azimuth + eighth * EIGHTH }
}
