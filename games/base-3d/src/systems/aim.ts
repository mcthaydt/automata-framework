// The ranged aim under the angled camera (DESIGN.md §9.2, option C, GAME3D-D3): the camera never changes; the shot
// flies along a plan direction and rises to the foe it picks. Integers only, so a replay aims alike in every engine.
// Pure: sim code reads it (`pnpm boundaries` checks it).
import { mapStick } from '@mcthaydt/automata-render-pixi3d/sim'
import { AIM_HALF_ANGLE, SLING } from '../constants/items.ts'
import type { PlanPoint } from './area.ts'
import { inArc } from './combat-geometry.ts'
import { angleOf } from './lock-target.ts'

/**
 * The aim direction in turn units (§9.2): toward the locked target, else along the stick mapped through the
 * camera's heading (as the walk maps it), else along Wick's facing.
 */
export function aimDirection(
  wick: PlanPoint & { readonly facing: number },
  locked: PlanPoint | undefined,
  stick: { readonly x: number; readonly y: number },
  heading: number,
): number {
  if (locked !== undefined && (locked.x !== wick.x || locked.z !== wick.z))
    return angleOf(locked.x - wick.x, locked.z - wick.z)
  if (stick.x !== 0 || stick.y !== 0) {
    const direction = mapStick(stick, heading)
    return angleOf(direction.x, direction.z)
  }
  return wick.facing
}

/** A foe the aim can pick: its id, place, and hurt cylinder's floor and height (Q16.16 metres). */
export interface AimCandidate extends PlanPoint {
  readonly id: number
  readonly lift: number
  readonly height: number
}

/**
 * The foe a shot along `aim` rises to (§9.2): of those whose bearing from Wick lies within ±6° of the aim and whose
 * distance is within the sling's range, the nearest (the lower id on a tie). The shot flies at its bearing in plan
 * (`facing`) and at its hurt cylinder's middle height, so it meets it. Undefined when there is none: the shot flies
 * along the aim, level at chest height.
 */
export function pickTarget(
  wick: PlanPoint,
  aim: number,
  candidates: readonly AimCandidate[],
): { readonly id: number; readonly y: number; readonly facing: number } | undefined {
  let best: { id: number; y: number; facing: number; d2: number } | undefined
  for (const foe of candidates) {
    const dx = foe.x - wick.x
    const dz = foe.z - wick.z
    // Exact: Q16.16 offsets under 2^26 square to under 2^53.
    const d2 = dx * dx + dz * dz
    const bearing = angleOf(dx, dz)
    if (d2 > SLING.range * SLING.range || !inArc(aim, bearing, AIM_HALF_ANGLE)) continue
    if (best === undefined || d2 < best.d2 || (d2 === best.d2 && foe.id < best.id))
      best = { id: foe.id, y: foe.lift + Math.trunc(foe.height / 2), facing: bearing, d2 }
  }
  return best === undefined ? undefined : { id: best.id, y: best.y, facing: best.facing }
}
