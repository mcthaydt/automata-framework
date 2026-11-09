// A hash of every textured swatch's tile labels at the scales the look reads them at, made the same way in Node and in a
// page, so the engines can be held to one recording. Tests only.

import type { PhotoSourceLoader } from '../features/photo/photo-library.ts'
import { swatchTile, type TexturedSwatch, textureOf } from '../features/photo/swatch-tile.ts'
import { TEXTURE_DEFAULTS } from '../features/photo/texture-spec.ts'
import { tileFromLab } from '../features/photo/tile.ts'
import { hashBytes } from './wire.ts'

/** The texels a metre of a 360-pixel field shows at 5 m: the scale the look makes its tiles at. */
export const FIELD_TEXELS = 72

/** `name@reads` and `name@field`: the hash of each textured swatch's tile at its own reading scale and at the field's. */
export async function tileHashes(
  swatches: Readonly<Record<string, TexturedSwatch>>,
  load: PhotoSourceLoader,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [name, swatch] of Object.entries(swatches)) {
    const spec = textureOf(swatch)
    if (spec === undefined) continue
    out[`${name}@reads`] = await hashBytes([(await swatchTile(swatch, load)).labels])
    const source = await load(
      spec.photo,
      spec.facet ?? TEXTURE_DEFAULTS.facet,
      spec.flatten ?? TEXTURE_DEFAULTS.flatten,
    )
    const tile = tileFromLab(source, spec, { texels: [FIELD_TEXELS, FIELD_TEXELS] })
    out[`${name}@field`] = await hashBytes([tile.labels])
  }
  return out
}
