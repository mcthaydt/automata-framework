// Which walls of a new sector lie on a neighbour's wall (ED3D.6a, ED3D spec §5.3 flow 2): drawing a wall over a segment that
// another sector's wall already runs over offers a portal between them, which `setWallKind` then makes on both sides.
// Only the same segment, either way round, is an offer: it is what the portal edit needs, and what is near but not on it
// is the `openings` check's to name.
import type { LevelProfile } from '../profile/level-profile'
import { cornerAt, loopOf, wallLength, wallOver } from './wall-geometry'

export interface PortalOffer {
  /** The sector the wall is of. */
  readonly sector: string
  /** The corner that starts the wall. */
  readonly corner: number
  /** The sector the portal would lead into. */
  readonly to: string
  /** The corner that starts the wall over the same segment there. */
  readonly toCorner: number
  /** The wall's length in metres. */
  readonly length: number
}

/**
 * The portals the walls of the outline of sector `id` could have, in the order of its corners. A wall of another sector
 * that already leads into a third is not offered (the portal edit would refuse it), and nor is a wall whose two sides
 * already lead into each other. Nothing for a sector that is not in the level.
 */
export function portalOffers<D>(profile: LevelProfile<D>, level: D, id: string): PortalOffer[] {
  const sectors = profile.sectors.list(level)
  const mine = sectors.find((sector) => sector.id === id)
  if (mine === undefined) return []
  const offers: PortalOffer[] = []
  for (const [corner, start] of mine.corners.entries()) {
    const end = cornerAt(mine.corners, corner + 1)
    const ours = profile.sectors.portalOf(level, start[2])
    for (const other of sectors) {
      if (other.id === id) continue
      const over = wallOver(other, start, end)
      if (over === undefined) continue
      const theirs = profile.sectors.portalOf(level, cornerAt(loopOf(other, over.loop), over.corner)[2])
      const taken = theirs !== undefined && theirs !== id
      const done = ours === other.id && theirs === id
      if (taken || done) continue
      offers.push({
        sector: id,
        corner,
        to: other.id,
        toCorner: over.corner,
        length: wallLength(mine.corners, corner),
      })
      break
    }
  }
  return offers
}
