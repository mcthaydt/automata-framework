// The station: the one level of the set, read as the editor writes it. Every example plays this file, and the zones a
// scene can start in are the zones it names, so a zone added in Levels 3D is a zone an example may use with no code.
import { type AfSector2, readLevel } from '@automata/3d/level'
import file from '../../content/levels/station.af-sector.json'

const read = readLevel(file)
// A level that does not read draws as an empty room, so a fault in the file is stopped here, with where it is.
if (read.problems.length > 0)
  throw new Error(
    `content/levels/station.af-sector.json did not read: ${read.problems.map((problem) => problem.message).join('; ')}`,
  )

/** The station, as `/2`. */
export const STATION: AfSector2 = read.level

/** The zones the station's sectors name, once each, in the order they come. */
export const SCENE_ZONES: readonly string[] = [
  ...new Set(STATION.sectors.flatMap((sector) => (sector.zone === undefined ? [] : [sector.zone]))),
]
