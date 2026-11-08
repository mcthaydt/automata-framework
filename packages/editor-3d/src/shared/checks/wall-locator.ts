// Where a resolved wall is in the document. In Last Light `expand` splits a wall where an opening cuts it, adds a
// connector sector for the gap between two rooms, and a pilaster adds walls of its own, so a resolved edge is not
// always a corner of the file. A wall that came from one of a sector's own corners lies on that corner's segment: the
// locator names that corner. A wall that came from none (a connector's, a hole's, the walls round a pilaster) is the
// sector's: the locator names the sector rather than a corner it might not belong to. The locator reads only each
// sector's id and corner loop, so it serves every profile whose sectors are written as loops of corners.
import type { Point } from '@automata/3d/level'
import type { Edge } from '../geometry/sectors'
import { type Locator, place, sectorSelection, wallSelection } from './check'

/** A corner as the locator reads it: where it is. A third member, the wall that starts there, is the profile's own. */
export type LocatorCorner = readonly [number, number, ...unknown[]]

/** A sector as the locator reads it: Last Light's rooms and AF's sectors both fit. */
export interface LocatorSector {
  readonly id: string
  readonly corners: readonly LocatorCorner[]
}

/** A wall is on a segment when its middle is within this of it. */
const ON_SEGMENT = 1e-6

function distanceToSegment(p: Point, from: LocatorCorner, to: LocatorCorner): number {
  const [x0, z0] = from
  const [dx, dz] = [to[0] - x0, to[1] - z0]
  const length = dx * dx + dz * dz
  const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - x0) * dx + (p.z - z0) * dz) / length))
  return Math.hypot(p.x - x0 - dx * along, p.z - z0 - dz * along)
}

export function wallLocator(sectors: readonly LocatorSector[]): (edge: Edge) => Locator | undefined {
  // The first sector of an id: a duplicate is `ids`' to report, and its walls are found on the first.
  const rooms = new Map<string, LocatorSector>()
  for (const room of sectors) if (!rooms.has(room.id)) rooms.set(room.id, room)
  return (edge) => {
    const middle = { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 }
    const room = rooms.get(edge.sector.id)
    if (room && edge.loop === 0 && !edge.notch) {
      const { corners } = room
      const corner = corners.findIndex(
        (from, i) =>
          distanceToSegment(middle, from, corners[(i + 1) % corners.length] as LocatorCorner) < ON_SEGMENT,
      )
      if (corner >= 0) return place(() => wallSelection(room.id, corner), edge.a)
    }
    return place(() => sectorSelection(edge.sector.id), middle)
  }
}
