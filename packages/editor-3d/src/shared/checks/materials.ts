// The `materials` check (ED3D spec §7, gap #28): every material a level names is in the profile's list. The resolved map
// is read after styles are applied, so a sector says what its floor, ceiling and walls are made of whichever way the
// file wrote it, and each problem is at the sector or the wall that uses the material (a style nobody uses is not a
// place). The list is the profile's own: a texture table in the file, or the game's renderer.
import { TRIM_PIECES } from '@automata/3d/level'
import { type GeometryContext, type Problem, place, sectorSelection } from './check'

const SECTOR_FIELDS = ['floorTexture', 'ceilingTexture', 'wallTexture'] as const

/**
 * In this order: for each sector in map order its floor, ceiling and wall textures, then for each wall in map order its
 * texture and its trim pieces' textures. A sentence that comes up twice at one place is said once (an opening splits a
 * wall in two, and both halves are one wall of the file), and the walls round a pilaster are not a place of their own.
 */
export function materialProblems(
  context: GeometryContext,
  known: { has(name: string): boolean },
  /** The sentence for a name that is not known, at a sector (`where` is its id); by default the engine's own. */
  sentence: (where: string, field: string, name: string) => string = (where, field, name) =>
    `${where}: ${field} ${name} is not a material`,
): Problem[] {
  const problems: Problem[] = []
  const said = new Set<string>()
  const say = (problem: Problem): void => {
    const key = `${problem.locator?.selection ?? ''}|${problem.message}`
    if (said.has(key)) return
    said.add(key)
    problems.push(problem)
  }
  for (const sector of context.map.sectors)
    for (const field of SECTOR_FIELDS) {
      const id = sector[field]
      if (id !== undefined && !known.has(id))
        say({
          message: sentence(sector.id, field, id),
          locator: place(() => sectorSelection(sector.id)),
        })
    }
  for (const edge of context.map.edges) {
    if (edge.notch) continue
    const uses: [name: string, id: string | undefined][] = [
      ['texture', edge.wall.texture],
      ...TRIM_PIECES.map((piece): [string, string | undefined] => [
        `trimTexture ${piece}`,
        edge.wall.trimTexture?.[piece],
      ]),
    ]
    for (const [name, id] of uses)
      if (id !== undefined && !known.has(id))
        say({
          message: sentence(edge.sector.id, `wall ${name}`, id),
          locator: context.wall(edge),
        })
  }
  return problems
}
