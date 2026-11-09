// A level's swatches against what they declare. A textured swatch can declare `reads` (the limits its tile must keep at the
// scale it is seen at); `checkReads` builds the level, takes each textured swatch it draws once, measures its tile at both
// wears, and reports a swatch whose tile fails as a `LevelProblem` that names the room that uses it first. Nothing throws on
// a level it cannot build: it hands back the problems.
//
// Node only: the tiles come from the photo library on disk.

import type { LevelProblem } from '@automata/3d/level'
import { buildWorld, type WorldLibrary } from '@automata/3d/props-kit'
import { type PhotoLibrary, readPhotoLibrary } from './photos.ts'
import { swatchIssues } from './swatch-issues.ts'
import type { TexturedSwatch } from './swatch-tiles.ts'

const tileOfSurface = (surface: string | { readonly tile: string }): string =>
  typeof surface === 'string' ? surface : surface.tile

export function checkReads(
  level: Parameters<typeof buildWorld>[0],
  library: WorldLibrary,
  photos: PhotoLibrary = readPhotoLibrary(),
): LevelProblem[] {
  const firstRoom = new Map<string, string>()
  for (const piece of buildWorld(level, library).pieces) {
    const name = tileOfSurface(piece.surface)
    if (!firstRoom.has(name)) firstRoom.set(name, piece.sector)
  }
  const problems: LevelProblem[] = []
  for (const [name, room] of firstRoom) {
    const swatch = library.swatches[name] as TexturedSwatch | undefined
    if (swatch === undefined) continue
    const issues = swatchIssues(swatch, photos)
    if (issues.length > 0)
      problems.push({
        path: ['sectors', level.sectors.findIndex((s) => s.id === room)],
        code: 'swatch-reads',
        message: `The swatch "${name}" does not read as a ${photoName(swatch)} at its scale: ${issues.join('; ')}. Change the swatch's texture knobs.`,
        where: room,
        name,
      })
  }
  return problems
}

const photoName = (swatch: TexturedSwatch): string => String(swatch.texture?.photo ?? 'surface')
