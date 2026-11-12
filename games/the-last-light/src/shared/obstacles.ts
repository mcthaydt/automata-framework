import type { Blocked } from '@automata/nav/sim'
import { blockedBy, resolvedMap } from '@automata/sectors/sim'
import type { SimContext } from '@automata/sim'
import { playIn } from './play-content.ts'

// The furniture's footprints, as the sim reads them. A prop's blockout owns its place and its footprint, so the footprint is a box
// on the plan, found from the level outside the sim (`features/room/obstacles.ts`, which may read the drawn parts) and put in the
// play content; this file is only what the sim does with it.

/** A box on the plan, in metres: what a prop's blockout takes of the floor. */
export interface Obstacle {
  readonly id: string
  readonly x0: number
  readonly z0: number
  readonly x1: number
  readonly z1: number
}

/** Whether the plan segment a to b comes within `margin` of the box (the box grown by the margin, then the slab test). */
function crosses(
  box: Obstacle,
  a: { readonly x: number; readonly z: number },
  b: { readonly x: number; readonly z: number },
  margin: number,
): boolean {
  let enter = 0
  let leave = 1
  const slabs: readonly (readonly [number, number, number, number])[] = [
    [a.x, b.x - a.x, box.x0 - margin, box.x1 + margin],
    [a.z, b.z - a.z, box.z0 - margin, box.z1 + margin],
  ]
  for (const [from, along, lo, hi] of slabs) {
    if (along === 0) {
      if (from < lo || from > hi) return false
      continue
    }
    const near = (lo - from) / along
    const far = (hi - from) / along
    enter = Math.max(enter, Math.min(near, far))
    leave = Math.min(leave, Math.max(near, far))
    if (enter > leave) return false
  }
  return true
}

const within = (box: Obstacle, at: { readonly x: number; readonly z: number }, margin = 0): boolean =>
  at.x >= box.x0 - margin && at.x <= box.x1 + margin && at.z >= box.z0 - margin && at.z <= box.z1 + margin

/** The square of the distance from a point to the box (0 on or in it): squares only, so no engine's square root is asked. */
const apart = (box: Obstacle, at: { readonly x: number; readonly z: number }): number => {
  const dx = Math.max(box.x0 - at.x, 0, at.x - box.x1)
  const dz = Math.max(box.z0 - at.z, 0, at.z - box.z1)
  return dx * dx + dz * dz
}

/**
 * `walls` with the boxes added: a segment is blocked when the walls block it or it comes within the walker's margin of a box.
 * A box does not block a segment that starts or ends on it: a record on the bench is walked up to (a use fires within reach),
 * and a walker found on a box may leave it. A walker who stands against a box (a walk stops within reach, wherever that is)
 * may walk on if she goes no nearer to it and not into it, so she can walk away or along it. Only additions and comparisons, so every engine answers alike; doors are the walls'.
 */
export function withObstacles(walls: Blocked, obstacles: readonly Obstacle[]): Blocked {
  return {
    segment: (a, b, margin) =>
      walls.segment(a, b, margin) ||
      obstacles.some((box) => {
        if (within(box, a) || within(box, b)) return false
        // Standing against the box already: the margin cannot be kept from here, so going no nearer is what is asked.
        if (within(box, a, margin)) return crosses(box, a, b, 0) || apart(box, b) < apart(box, a)
        return crosses(box, a, b, margin)
      }),
    open: (door) => walls.open(door),
  }
}

/** What stops Ada on the floor of this sim: the level's walls and the doors the walk keeps, and the furniture's boxes. */
export const furnished = (ctx: SimContext, doors: Readonly<Record<string, boolean>>): Blocked =>
  withObstacles(blockedBy(resolvedMap(ctx), doors), playIn(ctx.content).obstacles)
