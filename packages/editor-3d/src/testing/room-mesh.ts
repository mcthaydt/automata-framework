// A one-room mesh for the tests of the 3D views: the room's walls are 0 north, 1 east, 2 south and 3 west, and its floor is
// at 0 and its ceiling at 4 m. Every wall can say what a view does to it (`occlude`) or hold a door or a portal.
import type { AfSector, AfSectorEntry, AfWall } from '../format/af-sector.schema'
import { afSectorProfile } from '../profile/af-sector-profile'
import { buildSectorMesh, type SectorMesh } from '../view/mesh/sector-mesh'
import { selectionOf } from '../view/selection-of'
import { toyAfSector } from './toy-af-sector'

/** A rectangular sector from corner (x0, z0) to (x1, z1), 4 m high, lit; walls are numbered from the north, clockwise. */
export const entry = (
  id: string,
  [x0, z0, x1, z1]: readonly [number, number, number, number],
  walls: Readonly<Record<number, AfWall>> = {},
): AfSectorEntry => ({
  id,
  floor: 0,
  ceiling: 4,
  light: 1,
  corners: [
    [x0, z0, walls[0]],
    [x1, z0, walls[1]],
    [x1, z1, walls[2]],
    [x0, z1, walls[3]],
  ],
})

export const meshOf = (data: AfSector): SectorMesh =>
  buildSectorMesh(afSectorProfile.geometry(data).layers, selectionOf(afSectorProfile, data))

/** One room, 'room', from the origin to (8, 6). */
export const room = (walls: Readonly<Record<number, AfWall>> = {}): SectorMesh =>
  meshOf(toyAfSector({ sectors: [entry('room', [0, 0, 8, 6], walls)] }))
