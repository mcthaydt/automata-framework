// The door a game's level file comes in by: `readLevel` reads either format as `af-sector/2`, and `checkLevel` adds
// what the sim cannot resolve. Nothing throws; the problems say where, and the level is empty when the file was not
// a level, so the caller can go on and report.
import { type AfSector2, type LevelProblem, readLevel } from '@automata/3d/level'
import { checkLevel } from './check-level'

export interface SectorMapRead {
  /** The whole level; the sim keeps its sectors and masses (`loadSectorMap`). Ready to load when `problems` is empty. */
  readonly level: AfSector2
  readonly problems: LevelProblem[]
}

/** `json` (a parsed `*.af-sector.json`) as a level, with every problem in it. */
export function readSectorMap(json: unknown): SectorMapRead {
  const read = readLevel(json)
  return { level: read.level, problems: [...read.problems, ...checkLevel(read.level)] }
}
