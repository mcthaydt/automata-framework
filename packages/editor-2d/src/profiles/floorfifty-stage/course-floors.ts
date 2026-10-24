import { createRng, deriveSeed } from './course-rng'
import type { CourseTuning } from './course-tuning'

// The seeded course of a stage (FloorFifty `packages/shared/src/level/course.ts`, ported for the Course view, 2D editor
// spec §10.5): the fixed starting floor plus `COURSE_FLOOR_COUNT - 1` generated floors, numbered upward from zero. A
// course is a pure function of the seed and the tuning, so the editor draws the floors the game will generate.
// `testing/course-goldens.json` holds the game's own output; the order of the draws below is what keeps them equal.

/** The width of the screen in world units (the game's `VIEWPORT`, an invariant a stage cannot tune). */
export const VIEWPORT_WIDTH = 960

const UINT32_SPAN = 0x100000000

export type FloorKind = 'stationary' | 'moving'

export interface Floor {
  readonly id: string
  /** Zero is the fixed starting floor. */
  readonly index: number
  /** The centre of the floor in world units, y up. */
  readonly x: number
  readonly y: number
  readonly kind: FloorKind
  /** Units per second; zero for a stationary floor. */
  readonly speed: number
  /** The initial direction of a moving floor. */
  readonly direction: 1 | -1
}

export interface Course {
  readonly seed: number
  readonly floorCount: number
  readonly floors: readonly Floor[]
  /** The inclusive range a floor centre may take. */
  readonly bounds: { readonly left: number; readonly right: number }
  /** Falling below this respawns a player at their current lap start. */
  readonly deathLineY: number
}

/**
 * The horizontal travel of a floor centre. Inset by the whole floor width, not half, as the reference build does: a moving
 * floor stays clear of the wrap seam, so no player lands on a floor that is halfway off one edge.
 */
export function courseBounds(tuning: CourseTuning): { left: number; right: number } {
  const limit = VIEWPORT_WIDTH / 2 - tuning.FLOOR_WIDTH
  return { left: -limit, right: limit }
}

/** The ramp band of a floor: 0 below the ramp, then 1, 2, … every `DEMAND_RAMP_BAND_FLOORS`. */
export function rampBand(index: number, tuning: CourseTuning): number {
  if (index < tuning.DEMAND_RAMP_FROM_FLOOR) return 0
  return Math.floor((index - tuning.DEMAND_RAMP_FROM_FLOOR) / tuning.DEMAND_RAMP_BAND_FLOORS) + 1
}

function startingFloor(): Floor {
  return { id: 'floor-0', index: 0, x: 0, y: 0, kind: 'stationary', speed: 0, direction: 1 }
}

/**
 * One floor, a fixed gap above the one below. Its stream comes from `(seed, index)`, so the first `n` floors of a tall
 * course are those of a course of `n` floors. Placement is an independent draw across the bounds, not a step from the
 * floor below, so floors often stack, as in the reference. The draws are made in the game's order whether or not a ramp
 * band reads them all: the coin, then the speed.
 */
function generateFloor(seed: number, index: number, previous: Floor, tuning: CourseTuning): Floor {
  const rng = createRng(deriveSeed(seed, index))
  const bounds = courseBounds(tuning)
  const x = rng.nextRange(bounds.left, bounds.right)

  const band = rampBand(index, tuning)
  const movingDraw = rng.nextUint32()
  const moving =
    band === 0
      ? movingDraw % 2 === 0
      : movingDraw / UINT32_SPAN < Math.min(0.5 + band * tuning.MOVING_SHARE_STEP, tuning.MOVING_SHARE_MAX)
  const speed =
    band === 0
      ? rng.nextRange(tuning.MOVING_FLOOR_SPEED_MIN, tuning.MOVING_FLOOR_SPEED_MAX)
      : rng.nextRange(
          Math.min(
            tuning.MOVING_FLOOR_SPEED_MIN + band * tuning.MOVING_SPEED_STEP,
            tuning.MOVING_FLOOR_SPEED_CAP,
          ),
          Math.min(
            tuning.MOVING_FLOOR_SPEED_MAX + band * tuning.MOVING_SPEED_STEP,
            tuning.MOVING_FLOOR_SPEED_CAP,
          ),
        )

  return {
    id: `floor-${index}`,
    index,
    x,
    y: previous.y + tuning.FLOOR_GAP_MIN,
    kind: moving ? 'moving' : 'stationary',
    speed: moving ? speed : 0,
    // Every moving floor begins rightward in the reference.
    direction: 1,
  }
}

export function createCourse(seed: number, tuning: CourseTuning): Course {
  const floors: Floor[] = [startingFloor()]
  for (let index = 1; index < tuning.COURSE_FLOOR_COUNT; index++) {
    const previous = floors[index - 1]
    if (previous === undefined) break
    floors.push(generateFloor(seed, index, previous, tuning))
  }
  const start = floors[0]
  return {
    seed,
    floorCount: floors.length,
    floors,
    bounds: courseBounds(tuning),
    deathLineY: (start?.y ?? 0) - tuning.DEATH_LINE_MARGIN,
  }
}
