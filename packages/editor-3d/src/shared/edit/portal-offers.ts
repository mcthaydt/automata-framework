// Which walls of a new sector lie on a neighbour's wall (ED3D.6a, ED3D spec §5.3 flow 2): drawing a wall over a segment that
// another sector's wall already runs over offers a portal between them, which `setWallKind` then makes on both sides.
// Only the same segment, either way round, is an offer: it is what the portal edit needs, and what is near but not on it
// is the `openings` check's to name.
import type { LevelProfile } from '../level-session/level-profile'
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

/** What the wall that starts at one corner of a sector can be offered. */
export type WallPortal =
  /** Another sector has a wall over the same segment whose side leads nowhere, or here. */
  | { readonly kind: 'offer'; readonly offer: PortalOffer }
  /** Both sides already lead into each other: into `to`. */
  | { readonly kind: 'done'; readonly to: string }
  /** The wall over it leads into a third sector, `to`, and the portal edit would refuse it. */
  | { readonly kind: 'taken'; readonly to: string }
  /** No other sector has a wall over the same segment. */
  | { readonly kind: 'none' }

/**
 * What the wall of sector `id` that starts at `corner` can be offered: the first other sector over the same segment
 * that can take the portal, else why the first one over it cannot. Nothing for a sector or a corner that is not there.
 */
export function wallPortal<D>(profile: LevelProfile<D>, level: D, id: string, corner: number): WallPortal {
  const sectors = profile.sectors.list(level)
  const mine = sectors.find((sector) => sector.id === id)
  const start = mine?.corners[corner]
  if (mine === undefined || start === undefined) return { kind: 'none' }
  const end = cornerAt(mine.corners, corner + 1)
  const ours = profile.sectors.portalOf(level, start[2])
  let reason: WallPortal = { kind: 'none' }
  for (const other of sectors) {
    if (other.id === id) continue
    const over = wallOver(other, start, end)
    if (over === undefined) continue
    const theirs = profile.sectors.portalOf(level, cornerAt(loopOf(other, over.loop), over.corner)[2])
    if (theirs !== undefined && theirs !== id) {
      if (reason.kind === 'none') reason = { kind: 'taken', to: theirs }
    } else if (ours === other.id && theirs === id) {
      if (reason.kind === 'none') reason = { kind: 'done', to: other.id }
    } else {
      const length = wallLength(mine.corners, corner)
      return { kind: 'offer', offer: { sector: id, corner, to: other.id, toCorner: over.corner, length } }
    }
  }
  return reason
}

/**
 * The portals the walls of the outline of sector `id` could have, in the order of its corners. A wall of another sector
 * that already leads into a third is not offered (the portal edit would refuse it), and nor is a wall whose two sides
 * already lead into each other. Nothing for a sector that is not in the level.
 */
export function portalOffers<D>(profile: LevelProfile<D>, level: D, id: string): PortalOffer[] {
  const mine = profile.sectors.list(level).find((sector) => sector.id === id)
  const offers: PortalOffer[] = []
  for (const corner of mine?.corners.keys() ?? []) {
    const wall = wallPortal(profile, level, id, corner)
    if (wall.kind === 'offer') offers.push(wall.offer)
  }
  return offers
}
