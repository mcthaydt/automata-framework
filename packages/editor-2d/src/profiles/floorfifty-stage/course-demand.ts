import type { Course } from './course-floors'
import { VIEWPORT_WIDTH } from './course-floors'
import type { CourseTuning } from './course-tuning'

// How much of one bounce each step of a course asks for (FloorFifty `packages/shared/src/level/demand.ts`). 0 is a floor
// straight overhead; 1 is a step no player can make. The Course view draws it as the demand strip, and the reach of one
// bounce as the band around a floor.

/** The horizontal distance one bounce covers: the run while airborne, plus the width a floor and a player share. */
export function bounceBudget(tuning: CourseTuning): number {
  const airborneSeconds = tuning.BOUNCE_VELOCITY / Math.abs(tuning.GRAVITY)
  return tuning.MAX_MOVE_SPEED * airborneSeconds + (tuning.FLOOR_WIDTH + tuning.PLAYER_WIDTH) / 2
}

/**
 * The shortest signed way from `from` to `to` on a screen that wraps at `width`: a bot steers toward the floor it wants,
 * not the long way round.
 */
function shortestWrappedOffset(from: number, to: number, width: number): number {
  const half = width / 2
  let offset = to - from
  if (offset > half) offset -= width
  if (offset < -half) offset += width
  return offset
}

/** One number for each floor above the first: the horizontal distance to it over the bounce budget. */
export function stepDemands(course: Course, tuning: CourseTuning): number[] {
  const budget = bounceBudget(tuning)
  const demands: number[] = []
  for (let index = 1; index < course.floors.length; index++) {
    const below = course.floors[index - 1]
    const floor = course.floors[index]
    if (below === undefined || floor === undefined) continue
    demands.push(Math.abs(shortestWrappedOffset(below.x, floor.x, VIEWPORT_WIDTH)) / budget)
  }
  return demands
}
