// Walls as cutaway groups. A wall's `cut` names the group it hides with; one with no `cut` is a group of its own. A group
// is hidden when the camera's zone is in a member's `hideFrom`. A group's rooms follow the span of wall that is
// actually nearest a point, not the group's name, because one cut id can span unrelated rooms.

import type { PlanPoint, RoomLevel } from './room-level.ts'

export interface WallEdge {
  readonly sector: { readonly id: string }
  /** The sector on the other side of a portal. */
  readonly next?: { readonly id: string } | undefined
  readonly a: PlanPoint
  readonly b: PlanPoint
}

export interface WallGroup {
  readonly id: string
  readonly edges: readonly WallEdge[]
  /** Camera zones every member hides from, together. */
  readonly hideFrom: readonly string[]
}

/** Every wall of the level in its cutaway group, in level order. */
export function wallGroups(level: RoomLevel): WallGroup[] {
  const groups = new Map<string, { id: string; edges: WallEdge[]; hideFrom: string[] }>()
  for (const sector of level.sectors) {
    const loops = [sector.corners, ...(sector.holes ?? [])]
    loops.forEach((corners, loopIndex) => {
      corners.forEach(([x, z, wall], index) => {
        const [bx, bz] = corners[(index + 1) % corners.length] as readonly [number, number]
        const id = wall?.cut ?? `${sector.id}:${loopIndex}:${index}`
        const group = groups.get(id) ?? { id, edges: [], hideFrom: [] }
        groups.set(id, group)
        group.edges.push({
          sector: { id: sector.id },
          ...(wall?.next === undefined ? {} : { next: { id: wall.next } }),
          a: { x, z },
          b: { x: bx, z: bz },
        })
        for (const zone of wall?.hideFrom ?? []) if (!group.hideFrom.includes(zone)) group.hideFrom.push(zone)
      })
    })
  }
  return [...groups.values()]
}

/** The ids of the groups a camera zone hides. A cutscene hides none. */
export function hiddenWallGroups(
  groups: readonly WallGroup[],
  zone: string,
  cutscene: boolean,
): ReadonlySet<string> {
  return new Set(cutscene ? [] : groups.filter((g) => g.hideFrom.includes(zone)).map((g) => g.id))
}

const distanceTo = (edge: WallEdge, at: PlanPoint): number => {
  const dx = edge.b.x - edge.a.x
  const dz = edge.b.z - edge.a.z
  const length2 = dx * dx + dz * dz
  const t = length2
    ? Math.max(0, Math.min(1, ((at.x - edge.a.x) * dx + (at.z - edge.a.z) * dz) / length2))
    : 0
  return Math.hypot(at.x - edge.a.x - dx * t, at.z - edge.a.z - dz * t)
}

/** The rooms of the wall spans nearest `at`: both sides of a portal. `rooms` maps a sector id to its room. */
export function wallRoomOwners(
  edges: readonly WallEdge[],
  rooms: ReadonlyMap<string, string>,
  at: PlanPoint,
): string[] {
  const distances = edges.map((edge) => ({ edge, distance: distanceTo(edge, at) }))
  const nearest = Math.min(...distances.map((d) => d.distance))
  const owners = distances
    .filter((d) => d.distance <= nearest + 1e-5)
    .flatMap(({ edge }) => [rooms.get(edge.sector.id), edge.next && rooms.get(edge.next.id)])
  return [...new Set(owners.filter((id): id is string => !!id))]
}

const midpoint = (a: PlanPoint, b: PlanPoint): PlanPoint => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })

/**
 * The group of the wall a drawn segment lies on: the group whose span passes within `tolerance` of the segment's ends and
 * middle. A renderer's wall pieces know their line on the plan but not their `cut`, so this ties a piece to its group.
 */
export function wallGroupAt(
  groups: readonly WallGroup[],
  a: PlanPoint,
  b: PlanPoint,
  tolerance = 1e-3,
): WallGroup | undefined {
  const points = [a, midpoint(a, b), b]
  return groups.find((group) =>
    group.edges.some((edge) => points.every((at) => distanceTo(edge, at) <= tolerance)),
  )
}

/** A renderer's wall piece: its line on the plan, `a` to `b` as `[x, z]` (a world piece from `@automata/3d`'s builder is one). */
export interface WallPiece {
  readonly part: string
  readonly line?: { readonly a: readonly [number, number]; readonly b: readonly [number, number] } | undefined
}

/** The cutaway group of a drawn piece: a wall piece's group by its line, and none for a floor, a ceiling or a prop. */
export function wallGroupOfPiece(groups: readonly WallGroup[], piece: WallPiece): WallGroup | undefined {
  if (piece.part !== 'wall' || piece.line === undefined) return undefined
  const { a, b } = piece.line
  return wallGroupAt(groups, { x: a[0], z: a[1] }, { x: b[0], z: b[1] })
}
