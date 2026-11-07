// The free game's room (the rescope spec §2): the level file the 3D level editor writes (levels/room.af-sector.json), with
// its camera views in the file's `views`, read by the converter (levels/sector-area.ts) for the sim and built by the world
// builder (`ROOM_WORLD`) for the eye. A third-person room under the
// angled free-turn camera; the rooms turn freely.
import { buildWorld, type WorldLibrary } from '@automata/3d'
import { readLevel } from '@automata/3d/level'
import file from './levels/room.af-sector.json'
import { areaFromSector } from './levels/sector-area.ts'

/** The room: three platforms and the two channels between them that only the roll crosses. */
export const ROOM = areaFromSector(file, { file: 'room.af-sector.json' })

/** The surfaces the room's file names (`floorTexture`, `wallTexture`, …); the views give each its colour. */
export const ROOM_LIBRARY: WorldLibrary = { swatches: { floor: {}, wall: {}, ceiling: {}, lava: {} } }

/** The room the player sees: the same file, built into floors, ceilings and walls by the world builder. */
export const ROOM_WORLD = buildWorld(readLevel(file).level, ROOM_LIBRARY)
