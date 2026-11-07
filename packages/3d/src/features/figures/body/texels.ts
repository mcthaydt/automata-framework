// The fixed texel density small features are held to (`texels()` snapping uses a
// fixed ppm instead of a sprite cell's). FigureBuilder rounds a tie, an ear's rim or a cap's seam to whole texels of the
// cell it is drawn into; a 3D figure has no cell, so it rounds them to one density, the one the source judges its
// figures at.

/** Texels a metre: FigureBuilder's PPM, twice the brand kit's 36.9 (its density 2). */
export const FIGURE_PPM = 73.8

/** A feature `want` metres across, held to whole texels at FIGURE_PPM (at least `least` of them). */
export const texels = (want: number, least = 1): number =>
  Math.max(least, Math.round(want * FIGURE_PPM)) / FIGURE_PPM
