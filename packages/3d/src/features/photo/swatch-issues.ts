// A textured swatch against the `reads` it declares.

import type { PhotoSourceLoader } from './photo-library.ts'
import { type Reads, structureIssues, tileStructure } from './structure.ts'
import { swatchTile, type TexturedSwatch, textureOf } from './swatch-tile.ts'

/** What a swatch's tile fails, at both wears: the as-written measure's issues, then the bare (wear 0) measure's with
 * `wear 0:` before each. Empty when it passes or the swatch declares none. */
export async function swatchIssues(swatch: TexturedSwatch, load: PhotoSourceLoader): Promise<string[]> {
  if (textureOf(swatch) === undefined || swatch.reads === undefined) return []
  const declared: Partial<Reads> = swatch.reads
  const written = structureIssues(tileStructure(await swatchTile(swatch, load)), declared, true)
  const bare = structureIssues(tileStructure(await swatchTile(swatch, load, { unworn: true })), declared)
  return [...written, ...bare.map((issue) => `wear 0: ${issue}`)]
}
