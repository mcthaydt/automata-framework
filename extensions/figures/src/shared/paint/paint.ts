import type { Material } from '../body/parts'
import type { Weave } from './fabric'
import { colourTexels, stampAndBudget } from './paint-colour'
import { detailFloor, outlines, stainsAndHolo } from './paint-detail'
import type { FaceStamp } from './paint-face'
import type { Bends, HandStamp } from './paint-hands'
import type { Cloth } from './paint-prepare'
import { type PaintInputs, prepare } from './paint-prepare'
import { PAINT, type PaintStyle } from './paint-style'
import { faceForm, keyLight, quiltedBands, smoothSurfaces } from './paint-surface'
import { clusterTones, polishTones, ruleLines, toneTexels } from './paint-tones'
import type { GBuffer } from './raster'

export {
  densityOf,
  familyTones,
  GLOSS_SHEEN,
  paintedTones,
  SHEEN_MAX,
  SHEEN_MIN,
  sheenScale,
} from './paint-budget'
export type { FaceStamp } from './paint-face'
export { eyeWhite } from './paint-face'
export type { Bends, HandStamp } from './paint-hands'
export type { PaintStyle } from './paint-style'
export { duel, FACE_SEAM, oklab, PAINT, rampOf, tonesOf } from './paint-style'

/**
 * Paints the cell: `albedo` (RGBA) and `normals` (RGBA, red right, green down, blue toward the camera). `skin` is the
 * skin's material (it takes no cloth folds), −1 for none.
 *
 * - The outline sits just outside each shape (an empty texel beside the figure, or a far surface's texel beside a nearer
 *   part of another group), one texel and 8-connected, so a form keeps its width and a thin wrist keeps its colour. On
 *   the silhouette it is selective: toward the key, the shape's own line tone; away from it and underneath, ink. Inside
 *   the figure it is the far surface's own fold, and it runs whole or not at all.
 * - The key light on normals smoothed over each surface (a wider brush at higher density), cut into clusters: a tone
 *   island smaller than `cluster` joins its neighbours. Cloth's terminator wanders with its folds.
 * - Form: a crevice tone where a nearer part sits beside, a cast shadow where one stands between the surface and the key,
 *   reflected light on the shadow side's edge, and a glossy material's shine where it mirrors the key.
 */
export function paint(
  g: GBuffer,
  materials: Material[],
  albedo: Uint8ClampedArray,
  normals: Uint8ClampedArray,
  face: FaceStamp | null,
  style: PaintStyle = PAINT,
  skin = face?.skin ?? -1,
  hands: HandStamp[] = [],
  bends: Bends = {},
  light?: Float32Array,
  cloth?: Cloth,
  weaveOut?: Weave,
): { albedo: Uint8ClampedArray; normals: Uint8ClampedArray; weave: Weave | null } {
  const c0: PaintInputs = {
    g,
    materials,
    albedo,
    normals,
    face,
    style,
    skin,
    hands,
    bends,
    light,
    cloth,
    weaveOut,
  }
  // The phases, in the order the one pass always ran. A phase reads the names it needs from the context and returns the
  // ones it declares for a later phase (a phase that returns nothing only changes the buffers it was handed), so no
  // phase sees a value a later one made, and the order of the texel loops, and with it the grain, is the pass's own.
  const c1 = { ...c0, ...prepare(c0) }
  const c2 = { ...c1, ...smoothSurfaces(c1) }
  const c3 = { ...c2, ...faceForm(c2) }
  const c4 = { ...c3, ...keyLight(c3) }
  const c5 = { ...c4, ...quiltedBands(c4) }
  const c6 = { ...c5, ...toneTexels(c5) }
  polishTones(c6)
  const c7 = { ...c6, ...ruleLines(c6) }
  const c8 = { ...c7, ...clusterTones(c7) }
  detailFloor(c8)
  outlines(c8)
  const c9 = { ...c8, ...stainsAndHolo(c8) }
  colourTexels(c9)
  stampAndBudget(c9)
  const { weave } = c9
  return { albedo, normals, weave }
}
