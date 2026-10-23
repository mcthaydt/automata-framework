// Where an expanded wall is in the blockout file. `expand` splits a wall where an opening cuts it, adds a connector
// sector for the gap between two rooms, and a pilaster adds walls of its own, so an expanded edge is not always a corner
// of the file. A wall that came from one of a room's own corners lies on that corner's segment: the locator names that
// corner. A wall that came from none (a connector's, a hole's, the walls round a pilaster) is the sector's: the locator
// names the sector rather than a corner it might not belong to.
import type { Blockout, BlockoutCorner } from '../../format/blockout.schema'
import type { Point } from '../../format/sector.schema'
import type { Edge } from '../../geometry/sectors'
import { type Locator, place, sectorSelection, wallSelection } from '../check'

/** A wall is on a segment when its middle is within this of it. */
const ON_SEGMENT = 1e-6

function distanceToSegment(p: Point, from: BlockoutCorner, to: BlockoutCorner): number {
  const [x0, z0] = from
  const [dx, dz] = [to[0] - x0, to[1] - z0]
  const length = dx * dx + dz * dz
  const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - x0) * dx + (p.z - z0) * dz) / length))
  return Math.hypot(p.x - x0 - dx * along, p.z - z0 - dz * along)
}

export function wallLocator(blockout: Blockout): (edge: Edge) => Locator | undefined {
  // The first room of an id: a duplicate is `ids`' to report, and its walls are found on the first.
  const rooms = new Map<string, Blockout['rooms'][number]>()
  for (const room of blockout.rooms) if (!rooms.has(room.id)) rooms.set(room.id, room)
  return (edge) => {
    const middle = { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 }
    const room = rooms.get(edge.sector.id)
    if (room && edge.loop === 0 && !edge.notch) {
      const { corners } = room
      const corner = corners.findIndex(
        (from, i) =>
          distanceToSegment(middle, from, corners[(i + 1) % corners.length] as BlockoutCorner) < ON_SEGMENT,
      )
      if (corner >= 0) return place(() => wallSelection(room.id, corner), edge.a)
    }
    return place(() => sectorSelection(edge.sector.id), middle)
  }
}
