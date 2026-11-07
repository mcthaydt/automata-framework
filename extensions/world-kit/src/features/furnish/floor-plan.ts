// The dresser's geometry on the floor plan: footprints turned to face a direction, how far they reach, whether two
// overlap, a polygon's centre. Plan space is the level's: x east, z south; a place's angle is degrees clockwise from
// east, the way its front (+z in its own space) faces.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/dress.ts at 6d82a52.
import { signedArea, type V2 } from '@automata/3d/props-kit'

/** A rectangle on the floor: x0, z0, x1, z1. */
export type Rect = readonly [number, number, number, number]

/** A piece's place before it is placed: where its centre stands, and the way its front faces (degrees). */
export interface Spot {
  readonly at: V2
  readonly angle: number
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180

/** The angle (degrees, to 1e-6) of a direction. */
export const angleOf = (x: number, z: number): number =>
  Math.round(((Math.atan2(z, x) * 180) / Math.PI) * 1e6) / 1e6

/** The directions a piece facing `angle` takes: its front, and its own right. */
function axes(angle: number): { front: V2; right: V2 } {
  const a = radians(angle)
  return { front: [Math.cos(a), Math.sin(a)], right: [Math.sin(a), -Math.cos(a)] }
}

/**
 * A piece of `w` × `d` (its width along its own x, its depth along its front) centred at `at`, its front toward
 * `angle`: its four corners and their bounding rectangle.
 */
export function turned(at: V2, w: number, d: number, angle: number): { corners: V2[]; rect: Rect } {
  const { front, right } = axes(angle)
  const corners = (
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
  ).map(
    ([sx, sz]): V2 => [
      at[0] + (right[0] * sx * w) / 2 + (front[0] * sz * d) / 2,
      at[1] + (right[1] * sx * w) / 2 + (front[1] * sz * d) / 2,
    ],
  )
  const xs = corners.map((c) => c[0])
  const zs = corners.map((c) => c[1])
  return { corners, rect: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] }
}

/** How far a piece of `w` × `d` facing `angle` reaches along the unit direction `u`: half its extent there. */
export function reachAlong(u: V2, w: number, d: number, angle: number): number {
  const { front, right } = axes(angle)
  return (
    (Math.abs(right[0] * u[0] + right[1] * u[1]) * w + Math.abs(front[0] * u[0] + front[1] * u[1]) * d) / 2
  )
}

export const overlaps = (a: Rect, b: Rect, slack = 0.02): boolean =>
  a[0] < b[2] - slack && a[2] > b[0] + slack && a[1] < b[3] - slack && a[3] > b[1] + slack

/** The rectangle round some points. */
export const boxOf = (...points: V2[]): Rect => [
  Math.min(...points.map((p) => p[0])),
  Math.min(...points.map((p) => p[1])),
  Math.max(...points.map((p) => p[0])),
  Math.max(...points.map((p) => p[1])),
]

/** A polygon's centroid. */
export function centroidOf(polygon: readonly V2[]): V2 {
  const area6 = signedArea(polygon) * 6
  if (Math.abs(area6) < 1e-9)
    return [
      polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length,
      polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length,
    ]
  let [cx, cz] = [0, 0]
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length] as V2
    const k = p[0] * q[1] - q[0] * p[1]
    cx += (p[0] + q[0]) * k
    cz += (p[1] + q[1]) * k
  })
  return [cx / area6, cz / area6]
}

/** A list shuffled in place (Fisher–Yates) by `next`. */
export function shuffle<T>(list: T[], next: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[list[i], list[j]] = [list[j] as T, list[i] as T]
  }
  return list
}

/** A number rounded to a millimetre, so a placed position reads cleanly in a file. */
export const mm = (value: number): number => Math.round(value * 1e3) / 1e3

/** A place at the spot, rounded for a file. */
export const atSpot = (spot: Spot): [number, number] => [mm(spot.at[0]), mm(spot.at[1])]
