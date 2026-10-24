// Pointing the other side of a portal at a new sector (ED3D.6e). A cut makes a new sector of half a room, and a merge takes
// a room into its neighbour: either way, walls change hands, and the sector on the far side of each portal among them
// holds a wall over the same segment that still names the old owner. That wall must follow, or the pair stops matching
// (the `openings` check).
import type { LevelProfile } from '../profile/level-profile'
import type { EditSector } from '../profile/sector-access'
import { sectorOf } from './sector-edit-support'
import type { Changes } from './vertex-edits'
import { withWall } from './wall-edits'
import { cornerAt, loopOf, loopsOf, membersOf, wallOver } from './wall-geometry'

/** A stretch of wall that has changed hands: between two points, a portal into the sector `into`. */
export interface PortalSpan {
  readonly start: readonly [number, number]
  readonly end: readonly [number, number]
  readonly into: string
}

export interface PortalMove {
  /** The sector the spans belonged to. */
  readonly from: string
  /** The sector they belong to now. */
  readonly to: string
  readonly spans: readonly PortalSpan[]
}

/**
 * `changes` with, for each span, the wall of the sector `into` that runs back over it and leads into `from` now written
 * to lead into `to`: only `next` changes, whichever way round either wall is written. A span with no such wall is left
 * (the checks report an unpaired portal). A wall that reaches `from` through a wall preset gets a `next` of its own, which
 * wins over the preset's, so the preset and the other walls that use it are as they were. `changes` itself when there was
 * nothing to change.
 */
export function retargetPortals<D>(
  profile: LevelProfile<D>,
  level: D,
  changes: Changes,
  move: PortalMove,
): Changes {
  let made: Map<string, EditSector> | undefined
  const lookup = (id: string): EditSector | undefined =>
    (made ?? changes).get(id) ?? sectorOf(profile, level, id)
  for (const span of move.spans) {
    if (span.into === move.from || span.into === move.to) continue
    const far = lookup(span.into)
    if (far === undefined) continue
    const over = wallOver(
      far,
      span.start,
      span.end,
      (start) => profile.sectors.portalOf(level, start[2]) === move.from,
    )
    if (over === undefined) continue
    const members = membersOf(cornerAt(loopOf(far, over.loop), over.corner)[2])
    made ??= new Map(changes)
    made.set(far.id, withWall(far, over.loop, over.corner, { ...members, next: move.to }))
  }
  return made ?? changes
}

export interface PortalRedirect {
  /** The sector that goes (a merge takes it into `to`). */
  readonly from: string
  readonly to: string
}

/**
 * `changes` with every wall of every sector other than `from` and `to` that leads into `from` written to lead into `to`:
 * only `next` changes (a wall that reaches `from` through a wall preset gets a `next` of its own, which wins over the
 * preset's). `changes` itself when nothing leads into `from`.
 */
export function redirectPortals<D>(
  profile: LevelProfile<D>,
  level: D,
  changes: Changes,
  { from, to }: PortalRedirect,
): Changes {
  let made: Map<string, EditSector> | undefined
  for (const listed of profile.sectors.list(level)) {
    if (listed.id === from || listed.id === to) continue
    const before = changes.get(listed.id) ?? listed
    let sector = before
    for (const [loop, corners] of loopsOf(before).entries())
      for (const [corner, start] of corners.entries()) {
        if (profile.sectors.portalOf(level, start[2]) !== from) continue
        const members = membersOf(start[2])
        sector = withWall(sector, loop, corner, { ...members, next: to })
      }
    if (sector === before) continue
    made ??= new Map(changes)
    made.set(sector.id, sector)
  }
  return made ?? changes
}
