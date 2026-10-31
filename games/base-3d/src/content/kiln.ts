// The Cold Kiln's area (DESIGN.md §0.2, GAME-3D.1i): three rooms and the niche, read from the level file the 3D level
// editor writes (levels/kiln.af-sector.json) by the converter (levels/sector-area.ts). The camera views are written
// here, in metres: no editor writes `camera-view` files yet (EDITOR-GAPS.md, gap 1). The kiln stands far from the
// first slice in the same 3D space, so one scene draws both and an area change needs no rebuild.

import file from './levels/kiln.af-sector.json'
import { areaFromSector } from './levels/sector-area.ts'

/** Where the kiln's coordinates start: the kiln's plan is authored from the origin and offset in the file. */
const [OX, OZ] = [100, 100]
/** A room's focus bounds: the room, from the floor to 2 m. */
const bounds = (x0: number, z0: number, x1: number, z1: number) => ({
  min: [x0 + OX, 0, z0 + OZ] as [number, number, number],
  max: [x1 + OX, 2, z1 + OZ] as [number, number, number],
})

/** R1 and R2 turn freely; the niche is its own small view; the arena is framed one way and stays so (`rotate`). */
export const KILN_VIEWS = [
  { id: 'furnace-mouth', yawDeg: 0, bounds: bounds(-5, 1, 5, 9) },
  { id: 'bellows-gallery', yawDeg: 0, bounds: bounds(-11, 11, 5, 21) },
  { id: 'niche', yawDeg: 90, bounds: bounds(6.5, 14.5, 7.5, 16.5) },
  { id: 'hearth-chamber', yawDeg: 0, rotate: false, bounds: bounds(-3, 24, 3, 32) },
]

/** The Cold Kiln: R1 Furnace Mouth, R2 Bellows Gallery (with its slag channel, ledge and niche), R3 Hearth Chamber. */
export const KILN = areaFromSector(file, { file: 'kiln.af-sector.json', views: KILN_VIEWS })
