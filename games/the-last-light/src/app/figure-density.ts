import { fovOf, LENS_MM } from '@automata/3d/camera-view'
import type { CameraView } from '@automata/3d/sim'
import { type Density, densityNeeded } from '@automata/character-kit'
import { PLAY_FIGURE } from '../features/figures/cast.ts'

// The density the figures are painted at in play, from the play camera and the field. The camera stands back as the old game's did,
// where a density-2 texel is one field pixel of a 384-line field; a phone held sideways draws a 195-line field, where the same camera
// gives a density-2 texel half a field pixel and a crisp texel (never under one pixel) would draw her twice her size in the room. So the
// painter's own rule (`densityNeeded`: the largest density the zoom reaches) picks the density for the field, at most the cast's, and the
// run holds it: the field is fixed when the game starts, and a density that followed each frame's zoom would flip her paint as she
// walks nearer to and farther from the camera.

/** The painter's density-1 texels to a metre: a 96-row cell is 2.6 m. */
const D1_TEXELS = 96 / 2.6

/**
 * The zoom at the feet of a figure standing on a view's look point, on a field `lines` tall: field pixels a metre there over a density-1
 * texel's. The feet are the look's height down the camera's line, so they stand that much farther than the view's distance.
 */
export function zoomAtFeet(
  view: Pick<CameraView, 'distance' | 'lensMm' | 'tiltDeg' | 'look'>,
  lines: number,
): number {
  const tilt = (view.tiltDeg * Math.PI) / 180
  const depth = view.distance + (view.look?.[1] ?? 0) * Math.sin(tilt)
  const half = Math.tan((fovOf(view.lensMm ?? LENS_MM) * Math.PI) / 360)
  return lines / (2 * depth * half) / D1_TEXELS
}

/** The density the figures are painted at on a field `lines` tall: the painter's rule at the views' farthest zoom, at most the cast's. */
export function playDensity(views: readonly CameraView[], lines: number): Density {
  const zoom = Math.min(...views.map((view) => zoomAtFeet(view, lines)))
  return densityNeeded(zoom, PLAY_FIGURE.density)
}

/**
 * The density a figure is painted at each frame: the field's (`playDensity`) in play, and the cast's while a cutscene draws its own
 * shot. A shot's lens was set for the cast's density (`cutscene-scale.test.ts`), and on a phone its close-up keeps the face it framed.
 */
export function figureDensity(drawing: () => boolean, field: Density): () => Density {
  return () => (drawing() ? PLAY_FIGURE.density : field)
}
