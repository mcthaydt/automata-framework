// The door a game's level file comes in by: `readLevel` reads either format as `af-sector/2`, and `checkLevel` adds
// what the sim cannot resolve. Nothing throws; the problems say where, and the level is empty when the file was not
// a level, so the caller can go on and report.
import { type LevelProblem, readLevel } from '@automata/3d/level'
import { checkLevel, type SectorMap } from './check-level'

export interface SectorMapRead {
  /** The sectors and masses, ready for `loadSectorMap` when `problems` is empty. */
  readonly map: SectorMap
  readonly problems: LevelProblem[]
}

/** `json` (a parsed `*.af-sector.json`) as the sim's map, with every problem in it. */
export function readSectorMap(json: unknown): SectorMapRead {
  const read = readLevel(json)
  return { map: read.level, problems: [...read.problems, ...checkLevel(read.level)] }
}
