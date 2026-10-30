import { createRng, deriveSeed } from '@mcthaydt/automata-sim'
import type { RaceTuning } from './tuning.schema'

// Seeded course generation, ported from FloorFifty's `level/course.ts` (677d456): the fixed start floor, then each
// floor one gap above the last, its x an independent draw across the bounds, a coin for moving, and a speed. Each
// floor draws from its own stream, derived from (seed, index), so the first n floors of a tall course are a course of
// n floors (prefix stability). It runs inside the sim at race start, so it obeys the sim's rules: core's RNG, no
// Math.random. FloorFifty used its own SplitMix32; core's RNG gives a different course for the same seed (8b-D3).

/** One floor. Positions are centres in metres, y up; the start floor is index 0 at the origin. */
export interface CourseFloor {
  readonly index: number
  readonly x: number
  readonly y: number
  /** A moving floor travels between the bounds, starting rightward, at `speed` m/s. */
  readonly moving: boolean
  readonly speed: number
}

export interface Course {
  readonly seed: number
  readonly floors: readonly CourseFloor[]
  /** The range a floor centre may occupy. */
  readonly bounds: { readonly left: number; readonly right: number }
  /** A racer whose centre falls below this respawns. */
  readonly deathLineY: number
}

/**
 * The range a floor centre may occupy: one full floor width inside the wrap seam (FloorFifty's reference bounds), so a
 * racer never lands on a floor that is half off one edge.
 */
export function courseBounds(tuning: RaceTuning): { left: number; right: number } {
  const limit = tuning.viewportWidth / 2 - tuning.floorWidth
  return { left: -limit, right: limit }
}

function generateFloor(seed: number, index: number, below: CourseFloor, tuning: RaceTuning): CourseFloor {
  const rng = createRng(deriveSeed(seed, `floor-${index}`))
  const { left, right } = courseBounds(tuning)
  // Three draws in a fixed order: x, the moving coin, the speed. The speed is drawn even for a still floor, so
  // whether a floor moves never shifts what the next draw reads.
  const x = left + rng.next() * (right - left)
  const moving = rng.nextU32() % 2 === 0
  const speed = tuning.movingSpeedMin + rng.next() * (tuning.movingSpeedMax - tuning.movingSpeedMin)
  return { index, x, y: below.y + tuning.floorGap, moving, speed: moving ? speed : 0 }
}

/** The height below which a racer respawns: deathLineMargin under the start floor. The one definition. */
export function deathLineY(tuning: RaceTuning): number {
  return -tuning.deathLineMargin
}

/** Builds the course for a seed: `tuning.floorCount` floors, the fixed start floor first. */
export function createCourse(seed: number, tuning: RaceTuning): Course {
  const floors: CourseFloor[] = [{ index: 0, x: 0, y: 0, moving: false, speed: 0 }]
  for (let index = 1; index < tuning.floorCount; index++)
    floors.push(generateFloor(seed, index, floors[index - 1] as CourseFloor, tuning))
  return { seed, floors, bounds: courseBounds(tuning), deathLineY: deathLineY(tuning) }
}
