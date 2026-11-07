// The lens. `fovOf` is The Last Light's convention, `src/direction/shots.ts` line 29 at `92e6704`: a
// 24 mm tall film gate, so the vertical field of view is `2 * atan(12 / mm)`. Presentation only: it uses `Math`.

/** The Owner's lens (2026-10-23), in every view; `pipeline.toml` `[locked]` holds it. */
export const LENS_MM = 24

/** The vertical field of view, in degrees, of a `lensMm` lens on a 24 mm gate: 53.13° at 24 mm. */
export const fovOf = (lensMm: number): number => (2 * Math.atan(12 / lensMm) * 180) / Math.PI
