import type { Project } from '../../model/project-types'

// The images a level may draw: every tileset's image (a project holds a few sets, and any layer or entity of
// the level may name one) and the level's background image. The canvas loads these before it builds the draw list, so
// the list knows which tiles have art and which are placeholders.

/** Workspace paths, sorted and each once. Throws `RangeError` for a level that is not in the project. */
export function levelImages(project: Project, levelId: string): readonly string[] {
  const level = project.levels.find((candidate) => candidate.id === levelId)
  if (level === undefined) throw new RangeError(`no level "${levelId}"`)
  const paths = new Set<string>()
  for (const tileset of project.defs.tilesets) if (tileset.image !== undefined) paths.add(tileset.image)
  if (level.background.image !== undefined) paths.add(level.background.image)
  return [...paths].sort()
}
