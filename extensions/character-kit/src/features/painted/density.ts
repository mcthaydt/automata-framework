// The density a painted figure needs for the zoom it is drawn at. The painter's `densityFor` picks it up to 4; a close shot of a game
// that asks for more can have 8 (a cell of 512 × 768), so the choice is made here with a cap the game sets. A moving camera needs one
// thing more than the painter's rule gives: a zoom that sits on a boundary must not flip the figure between two paints each frame.

/** Texels per texel of the base cell: 64 × 96 is 1. The painter takes any number; the kit offers the levels a camera can use. */
export type Density = 1 | 2 | 4 | 8

/** The levels above 1, largest first. */
const LEVELS: readonly Density[] = [8, 4, 2]

/** How far the zoom must move from the one a level was chosen at before it is chosen again, as a share of that zoom. */
const BAND = 0.05

/**
 * The density a zoom needs, the painter's rule with the cap a game sets: at a whole zoom (to 1e-9: a host's `pixelsPerMetre` need not
 * round-trip) the largest level that divides it, so a texel is a whole number of pixels; between whole zooms the largest level the
 * zoom reaches. Never under 1, so a texel is never minified; a zoom that is not a number is 1.
 */
export function densityNeeded(zoom: number, max: Density = 4): Density {
  if (!(zoom >= 1)) return 1
  const whole = Math.round(zoom)
  const isWhole = Math.abs(zoom - whole) < 1e-9
  for (const level of LEVELS)
    if (level <= max && (isWhole ? whole % level === 0 : level <= zoom)) return level
  return 1
}

export interface DensityChooser {
  /** The density for this frame's zoom. */
  pick(zoom: number): Density
}

/**
 * Chooses a figure's density frame by frame. The first zoom it sees is decided exactly, so a cut to a close shot is sharp on its
 * first frame. After that the choice is held while the zoom stays within 5% of the one it was made at, and made afresh when the zoom
 * has moved further: a camera that shivers across a boundary keeps one level, and one that dollies through it changes level once.
 */
export function densityChooser(max: Density = 4): DensityChooser {
  let anchor: number | undefined
  let level: Density = 1
  return {
    pick(zoom) {
      if (!(zoom >= 1)) return level
      if (anchor === undefined || Math.abs(zoom - anchor) > anchor * BAND) {
        anchor = zoom
        level = densityNeeded(zoom, max)
      }
      return level
    },
  }
}
