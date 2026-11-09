// The texels a metre a view shows a tile at: the field is `short` pixels on its short side and shows
// `2 · distance · tan(fov / 2)` metres of the scene at the view's focus, so that is P pixels a metre. A floor is seen
// foreshortened by the camera's tilt (its depth runs P · sin tilt pixels a metre) and a wall by its cosine, and a tile is
// made at the scale it is seen at, snapped to the pipeline's √2 steps so a view makes a few tiles and not one a distance.

import { cos, sin, tan } from '@automata/sim/math'
import { texelScale } from './texture-spec.ts'

/** A view as the tiles see it: the camera's distance to its focus and its tilt below the horizon. */
export interface TileView {
  readonly distance: number
  readonly tiltDeg: number
}

/** The texel scales (texels a metre along u, then v) a floor-like face and a wall-like face are made at. */
export interface TileScales {
  readonly floor: readonly [number, number]
  readonly wall: readonly [number, number]
}

/** `fovShort` is the lens's field of view along the short side (radians). */
export function tileScales(view: TileView, short: number, fovShort: number): TileScales {
  const pixelsPerMetre = short / (2 * Math.max(view.distance, 1e-3) * tan(fovShort / 2))
  const tilt = (view.tiltDeg * Math.PI) / 180
  return {
    floor: [texelScale(pixelsPerMetre), texelScale(pixelsPerMetre * sin(tilt))],
    wall: [texelScale(pixelsPerMetre), texelScale(pixelsPerMetre * cos(tilt))],
  }
}
