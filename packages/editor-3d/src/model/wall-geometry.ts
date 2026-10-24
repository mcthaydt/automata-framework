// Where the walls of a sector are, for the edits that follow a wall to its other side (ED3D.3): the loops of a sector,
// the corner that starts a wall, and the wall of another sector that runs over the same segment.
import type { Planar } from '../geometry/loops'
import type { EditCorner, EditSector, EditWall } from '../profile/sector-access'
import { placed, round4 } from './sector-edit-support'

/** The members of a wall that mean something only while it is a portal: a wall that is not one has none. */
export const PORTAL_MEMBERS = ['next', 'frame', 'mask', 'block', 'maskTop', 'hatch'] as const

/** Two points this close are one point: the distance the `openings` check forgives. */
const NEAR = 1e-6

export const near = (p: Planar, q: Planar): boolean =>
  Math.abs(p[0] - q[0]) < NEAR && Math.abs(p[1] - q[1]) < NEAR

export const samePoint = (p: Planar, q: Planar): boolean => p[0] === q[0] && p[1] === q[1]

/** The members of a wall as written: nothing, a cutaway name (Last Light's spelling of `cut`), or an object. */
export const membersOf = (wall: string | EditWall | undefined): EditWall =>
  wall === undefined ? {} : typeof wall === 'string' ? { cut: wall } : wall

/** The outline of a sector and then its holes. */
export const loopsOf = (sector: EditSector): readonly (readonly EditCorner[])[] => [
  sector.corners,
  ...(sector.holes ?? []),
]

export const loopOf = (sector: EditSector, index: number): readonly EditCorner[] =>
  loopsOf(sector)[index] as readonly EditCorner[]

/** The corner at an index of a loop, counting round the loop (the wall of the last corner ends at the first). */
export const cornerAt = (corners: readonly EditCorner[], index: number): EditCorner =>
  corners[index % corners.length] as EditCorner

/** How long the wall is that starts at a corner of the loop, in metres. */
export function wallLength(corners: readonly EditCorner[], index: number): number {
  const [from, to] = [cornerAt(corners, index), cornerAt(corners, index + 1)]
  return Math.hypot(to[0] - from[0], to[1] - from[1])
}

/** A wall found by its segment: the loop it is in, the corner that starts it, and whether that corner is at `a`. */
export interface WallOver {
  readonly loop: number
  readonly corner: number
  readonly startsAtA: boolean
}

/**
 * The wall of `sector` that runs between the points `a` and `z`, written either way round (a loop may be written
 * either way), among the walls whose starting corner `accept` takes; nothing when there is none.
 */
export function wallOver(
  sector: EditSector,
  a: Planar,
  z: Planar,
  accept: (start: EditCorner) => boolean = () => true,
): WallOver | undefined {
  for (const [loop, corners] of loopsOf(sector).entries())
    for (const [corner, start] of corners.entries()) {
      if (!accept(start)) continue
      const end = cornerAt(corners, corner + 1)
      if (near(start, a) && near(end, z)) return { loop, corner, startsAtA: true }
      if (near(start, z) && near(end, a)) return { loop, corner, startsAtA: false }
    }
  return undefined
}

/**
 * A wall written from its other end: everything it says is the same, and what has a place along it is measured from the
 * new start: a door's and a window's centre, a hatch's two ends, and a pilaster's start and end change places. A name
 * (Last Light's cutaway group) and a wall with nothing placed on it are returned as they are. A texture's pan is left as it
 * is written, so the pattern of a wall that is turned round may run the other way.
 */
export function reversedWall(
  wall: string | EditWall | undefined,
  length: number,
): string | EditWall | undefined {
  if (wall === undefined || typeof wall === 'string') return wall
  const { door, window: pane, hatch, pilaster } = wall
  if (door === undefined && pane === undefined && hatch === undefined && pilaster === undefined) return wall
  return {
    ...wall,
    ...(door === undefined ? {} : { door: { ...door, at: round4(length - door.at) } }),
    ...(pane === undefined ? {} : { window: { ...pane, at: round4(length - pane.at) } }),
    ...(hatch === undefined
      ? {}
      : { hatch: [round4(length - hatch[1]), round4(length - hatch[0])] as const }),
    ...(pilaster === undefined
      ? {}
      : {
          pilaster: {
            ...(pilaster.end === undefined ? {} : { start: pilaster.end }),
            ...(pilaster.start === undefined ? {} : { end: pilaster.start }),
          },
        }),
  }
}

/**
 * The corners of a loop written the other way round, starting at the same first corner: each wall now starts at the corner
 * that used to end it, turned round (`reversedWall`).
 */
export function reversedLoop(corners: readonly EditCorner[]): EditCorner[] {
  const count = corners.length
  return corners.map((_, at) => {
    const corner = cornerAt(corners, count - at)
    const wall = (count - 1 - at + count) % count
    return placed(corner[0], corner[1], reversedWall(cornerAt(corners, wall)[2], wallLength(corners, wall)))
  })
}
