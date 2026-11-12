// The checks that join the prologue's files to each other, for a unit test and for a tool: what one file names, the
// file that has it must have. A bad edit (a hotspot deleted in Levels 3D that the puzzle still names) is a sentence naming
// both, not a player standing at nothing.
import type { Hotspot } from '@automata/interact/sim'
import type { PuzzleDef } from '@automata/puzzle/sim'

/** Problems between the puzzle and the level's hotspots, each a sentence naming both. */
export function puzzleAgainstLevel(puzzle: PuzzleDef, hotspots: readonly Hotspot[]): string[] {
  const byId = new Map(hotspots.map((spot) => [spot.id, spot]))
  const problems: string[] = []
  for (const [id, at] of Object.entries(puzzle.hotspots ?? {})) {
    const spot = byId.get(id)
    if (spot === undefined) {
      problems.push(
        `The puzzle names the hotspot "${id}", and the level has no hotspot "${id}". Put it back in the level, or take it out of the puzzle.`,
      )
      continue
    }
    if (Math.abs(spot.x - at.x) > 1e-6 || Math.abs(spot.z - at.z) > 1e-6)
      problems.push(
        `The puzzle puts "${id}" at (${at.x}, ${at.z}) and the level at (${spot.x}, ${spot.z}). They must agree.`,
      )
  }
  const named = new Set(Object.keys(puzzle.hotspots ?? {}))
  for (const action of puzzle.actions)
    if (action.at !== 'combine' && action.at !== 'code' && !named.has(action.at) && !byId.has(action.at))
      problems.push(
        `The puzzle action "${action.id}" is at "${action.at}", which is neither a hotspot of the puzzle nor of the level.`,
      )
  return problems
}

/** A sentence for each hotspot of the level whose name has no English in the interface catalog. */
export function hotspotNamesAgainstCatalog(
  hotspots: readonly Hotspot[],
  catalog: Readonly<Record<string, string>>,
): string[] {
  return hotspots
    .filter((spot) => catalog[spot.name] === undefined)
    .map(
      (spot) =>
        `The hotspot "${spot.id}" is named by the key "${spot.name}", which messages/ui/en.json does not have.`,
    )
}
