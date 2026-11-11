// The lens. `fovOf` follows the film convention: a
// 24 mm tall film gate (the frame is still 24 mm tall; only the lens is 50 mm), so the vertical field of view is `2 * atan(12 / mm)`. Presentation only: it uses `Math`.

/**
 * The gameplay lens, in every view: 50 mm, as in the reference game (Owner, 2026-11-10: the default 3D gameplay camera
 * matches it). It replaces the 24 mm of 2026-10-23. Automatic framing dollies the camera and never changes the lens.
 */
export const LENS_MM = 50

/** The vertical field of view, in degrees, of a `lensMm` lens on a 24 mm gate: 26.99° at 50 mm, 53.13° at 24 mm. */
export const fovOf = (lensMm: number): number => (2 * Math.atan(12 / lensMm) * 180) / Math.PI
