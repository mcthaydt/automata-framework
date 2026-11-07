// The free game's room (the rescope spec §2): the level file the 3D level editor writes (levels/room.af-sector.json), with
// its camera views in the file's `views`, read by the converter (levels/sector-area.ts). A third-person room under the
// angled free-turn camera; the rooms turn freely.
import file from './levels/room.af-sector.json'
import { areaFromSector } from './levels/sector-area.ts'

/** The room: three platforms and the two channels between them that only the roll crosses. */
export const ROOM = areaFromSector(file, { file: 'room.af-sector.json' })
