// The free game's room (the rescope spec §2): the level file the 3D level editor writes (levels/room.af-sector.json), read
// by the converter (levels/sector-area.ts), and its camera views, written here in metres: no editor writes `camera-view`
// files yet (EDITOR-GAPS.md, gap EG-3). A third-person room under the angled free-turn camera; the rooms turn freely.
import file from './levels/room.af-sector.json'
import { areaFromSector } from './levels/sector-area.ts'

/** A room's focus bounds: the room, from the floor to 2 m. */
const bounds = (x0: number, z0: number, x1: number, z1: number) => ({
  min: [x0, 0, z0] as [number, number, number],
  max: [x1, 2, z1] as [number, number, number],
})

export const ROOM_VIEWS = [
  { id: 'start', yawDeg: 0, bounds: bounds(-4, 1, 4, 7) },
  { id: 'middle', yawDeg: 0, bounds: bounds(-4, 11, 4, 17) },
  { id: 'goal', yawDeg: 0, bounds: bounds(-4, 21, 4, 27) },
]

/** The room: three platforms and the two channels between them that only the roll crosses. */
export const ROOM = areaFromSector(file, { file: 'room.af-sector.json', views: ROOM_VIEWS })
