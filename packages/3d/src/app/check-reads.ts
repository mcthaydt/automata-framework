// A level's swatches against what they declare. A textured swatch can declare `reads` (the limits its tile must keep at the
// scale it is seen at); `checkReads` builds the level, takes each textured swatch it draws once, measures its tile at both
// wears, and reports a swatch whose tile fails as a `LevelProblem` that names the room that uses it first. Nothing throws on
// a level it cannot build: it hands back the problems.

import type { PhotoSourceLoader } from '../features/photo/photo-library.ts'
import { swatchIssues } from '../features/photo/swatch-issues.ts'
import type { TexturedSwatch } from '../features/photo/swatch-tile.ts'
import { buildWorld } from '../features/world/build.ts'
import type { WorldLibrary } from '../features/world/swatches.ts'
import type { LevelProblem } from '../shared/level/problem.ts'

const tileOfSurface = (surface: string | { readonly tile: string }): string =>
  typeof surface === 'string' ? surface : surface.tile

const photoName = (swatch: TexturedSwatch): string => String(swatch.texture?.photo ?? 'surface')

export async function checkReads(
  level: Parameters<typeof buildWorld>[0],
  library: WorldLibrary,
  load: PhotoSourceLoader,
): Promise<LevelProblem[]> {
  const firstRoom = new Map<string, string>()
  for (const piece of buildWorld(level, library).pieces) {
    const name = tileOfSurface(piece.surface)
    if (!firstRoom.has(name)) firstRoom.set(name, piece.sector)
  }
  const problems: LevelProblem[] = []
  for (const [name, room] of firstRoom) {
    const swatch = library.swatches[name] as TexturedSwatch | undefined
    if (swatch === undefined) continue
    const issues = await swatchIssues(swatch, load)
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
