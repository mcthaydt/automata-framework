import type { PainterMaterial } from '../figure/materials.ts'
import type { FaceStamp } from './face-stamp.ts'
import type { Bends, HandStamp } from './hand-stamp.ts'
import { outlines, washAndHolo } from './paint-lines.ts'
import { output } from './paint-output.ts'
import type { Cloth, PaintInput } from './paint-state.ts'
import { PAINT, type PaintStyle } from './paint-style.ts'
import { faceLight, keyLight, surfaces } from './paint-surfaces.ts'
import { cleanTones, quilting, toneTexels } from './paint-tones.ts'
import type { GBuffer } from './raster.ts'

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
  materials: PainterMaterial[],
  albedo: Uint8ClampedArray,
  normals: Uint8ClampedArray,
  face: FaceStamp | null,
  style: PaintStyle = PAINT,
  skin: number = face?.skin ?? -1,
  hands: HandStamp[] = [],
  bends: Bends = {},
  cloth?: Cloth,
): {
  albedo: Uint8ClampedArray
  normals: Uint8ClampedArray
} {
  const input: PaintInput = { g, materials, albedo, normals, face, style, skin, hands, bends, cloth }
  const s1 = { ...input, ...surfaces(input) }
  const s2 = { ...s1, ...faceLight(s1) }
  const s3 = { ...s2, ...keyLight(s2) }
  const s4 = { ...s3, ...quilting(s3) }
  const s5 = { ...s4, ...toneTexels(s4) }
  const s6 = { ...s5, ...cleanTones(s5) }
  const s7 = { ...s6, ...outlines(s6) }
  const s8 = { ...s7, ...washAndHolo(s7) }
  const s9 = { ...s8, ...output(s8) }
  void s9
  return { albedo, normals }
}
