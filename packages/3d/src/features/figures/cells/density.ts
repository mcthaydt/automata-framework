// How many texels a metre a figure's cell gets: the field is `short` pixels tall and shows `2 · distance · tan(fov / 2)`
// metres at the figure's distance, so a figure farther away needs fewer texels. A cell is painted at that density in
// quarter steps, no lower than `min` (the sheets' own density) and no higher than `max` (the painter's cost grows with the
// square), so a figure is one of a short list of cells and not one per camera distance.

import { tan } from '@automata/sim/math'
import { CELL_METRES } from '../paint/soup.ts'

/** The cell density's bounds (`look.figures`). */
export interface DensityLimits {
  readonly min: number
  readonly max: number
}

/** A cell of density 1 is 96 texels for `CELL_METRES`. */
const SHEET_PPM = 96 / CELL_METRES

/**
 * The density for a figure `distance` metres from a camera whose field of view along the short side is `fovShort`
 * (rad), drawn into a field `short` pixels on that side.
 */
export function viewDensity(
  short: number,
  distance: number,
  fovShort: number,
  limits: DensityLimits,
): number {
  const pixelsPerMetre = short / (2 * distance * tan(fovShort / 2))
  const wanted = Math.max(limits.min, Math.min(limits.max, pixelsPerMetre / SHEET_PPM))
  return Math.round(wanted * 4) / 4
}
