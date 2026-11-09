// Fixture rooms for the occluder rule's sweeps (D3-h) and the framing check (D3-g): `games/base-3d`'s own rooms are
// Every wall runs with the room on its left; walls are 2.5 m high and 0.2 m thick outward.
import type { Vec3 } from '../../features/camera/camera-pose.ts'
import {
  type Box3,
  type PlanPoint,
  segmentHitsBox,
  type WallSpan,
  wallLocal,
} from '../../features/camera/occluders/occluder-rule.ts'

export const WALL_HEIGHT = 2.5
export const WALL_THICKNESS = 0.2
export const TRIM_HEIGHT = 0.12

const wall = (a: PlanPoint, b: PlanPoint): WallSpan => ({
  a,
  b,
  height: WALL_HEIGHT,
  thickness: WALL_THICKNESS,
})

export interface Room {
  readonly outline: readonly PlanPoint[]
  readonly walls: readonly WallSpan[]
}

/** One room, 6 m by 6 m, from the origin toward +x and +z. */
export const ONE_ROOM: Room = {
  outline: [
    { x: 0, z: 0 },
    { x: 6, z: 0 },
    { x: 6, z: 6 },
    { x: 0, z: 6 },
  ],
  walls: [
    wall({ x: 0, z: 0 }, { x: 6, z: 0 }),
    wall({ x: 6, z: 0 }, { x: 6, z: 6 }),
    wall({ x: 6, z: 6 }, { x: 0, z: 6 }),
    wall({ x: 0, z: 6 }, { x: 0, z: 0 }),
  ],
}

/** A pillar 2.4 m tall in ONE_ROOM, off the corners and the centre. */
export const PILLAR: Box3 = { min: [1.4, 0, 4.0], max: [1.8, 2.4, 4.4] }

const DOOR = { from: 2.5, to: 3.5 }
/** Where room B's floor starts: the partition is A's wall and B's back to back, each 0.2 m thick, so 0.4 m. */
const B = 6 + 2 * WALL_THICKNESS

/**
 * Two 6 m rooms, A (z 0..6) and B (z 6.4..12.4), joined by a 1 m doorway through the partition, which is two walls
 * back to back: A's copy (its inside toward A) and B's (toward B).
 */
export const TWO_ROOMS: { readonly a: Room; readonly b: Room; readonly walls: readonly WallSpan[] } = (() => {
  const a: Room = {
    outline: ONE_ROOM.outline,
    walls: [
      wall({ x: 0, z: 0 }, { x: 6, z: 0 }),
      wall({ x: 6, z: 0 }, { x: 6, z: 6 }),
      wall({ x: 6, z: 6 }, { x: DOOR.to, z: 6 }),
      wall({ x: DOOR.from, z: 6 }, { x: 0, z: 6 }),
      wall({ x: 0, z: 6 }, { x: 0, z: 0 }),
    ],
  }
  const b: Room = {
    outline: [
      { x: 0, z: B },
      { x: 6, z: B },
      { x: 6, z: B + 6 },
      { x: 0, z: B + 6 },
    ],
    walls: [
      wall({ x: 0, z: B }, { x: DOOR.from, z: B }),
      wall({ x: DOOR.to, z: B }, { x: 6, z: B }),
      wall({ x: 6, z: B }, { x: 6, z: B + 6 }),
      wall({ x: 6, z: B + 6 }, { x: 0, z: B + 6 }),
      wall({ x: 0, z: B + 6 }, { x: 0, z: B }),
    ],
  }
  return { a, b, walls: [...a.walls, ...b.walls] }
})()

/** Where the D3-h sweep stands the player: 0.3 m (a body's half-width) in from each corner, and the centre. */
export function standingPoints(room: Room): Vec3[] {
  const xs = room.outline.map((p) => p.x)
  const zs = room.outline.map((p) => p.z)
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  const inset = 0.3
  return [
    { x: x0 + inset, y: 0, z: z0 + inset },
    { x: x1 - inset, y: 0, z: z0 + inset },
    { x: x1 - inset, y: 0, z: z1 - inset },
    { x: x0 + inset, y: 0, z: z1 - inset },
    { x: (x0 + x1) / 2, y: 0, z: (z0 + z1) / 2 },
  ]
}

/** Whether the segment passes through the wall's solid (`height` tall) or its trim (`TRIM_HEIGHT`). */
export function segmentHitsWall(span: WallSpan, from: Vec3, to: Vec3, height: number): boolean {
  const length = Math.hypot(span.b.x - span.a.x, span.b.z - span.a.z)
  return segmentHitsBox(wallLocal(span, from), wallLocal(span, to), {
    min: [0, 0, 0],
    max: [length, height, WALL_THICKNESS],
  })
}
