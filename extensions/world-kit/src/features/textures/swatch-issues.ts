// A textured swatch against the `reads` it declares, with nothing from the core packages in it so the texture command can
// run under bare Node.

import type { PhotoLibrary } from './photos.ts'
import { type Reads, structureIssues, tileStructure } from './structure.ts'
import { swatchTile, type TexturedSwatch, textureOf } from './swatch-tiles.ts'

/** What a swatch's tile fails, at both wears, as `npm run textures` printed it: the as-written measure's issues, then the
 * bare (wear 0) measure's with `wear 0:` before each. Empty when it passes or the swatch declares none. */
export function swatchIssues(swatch: TexturedSwatch, photos: PhotoLibrary): string[] {
  if (textureOf(swatch) === undefined || swatch.reads === undefined) return []
  const declared: Partial<Reads> = swatch.reads
  const written = structureIssues(tileStructure(swatchTile(swatch, photos)), declared, true)
  const bare = structureIssues(tileStructure(swatchTile(swatch, photos, { unworn: true })), declared)
  return [...written, ...bare.map((issue) => `wear 0: ${issue}`)]
}
