import type { Result } from '../profile'
import { resolveContext, type StageCheckContext } from './check-types'
import { tunableFault } from './tunables'

// The tunables a course is drawn from (FloorFifty `common/tuning.ts`: `resolveTuning` gives all 35; `course.ts` and
// `demand.ts` read these 16). Resolved like the game does: the stage's `courseTuning`, else `tuning.toml`, else the
// declared default.
//
// A value the game would refuse makes the course unavailable instead of drawing a wrong one; the checks report the same
// value (`tunableRange`), so the Course view says "see Checks". Only the names the course reads are judged: a bad survival
// tunable is a finding, not a reason to hide the floors.

export const COURSE_TUNABLE_NAMES = [
  'COURSE_FLOOR_COUNT',
  'FLOOR_WIDTH',
  'FLOOR_GAP_MIN',
  'DEATH_LINE_MARGIN',
  'PLAYER_WIDTH',
  'MAX_MOVE_SPEED',
  'GRAVITY',
  'BOUNCE_VELOCITY',
  'MOVING_FLOOR_SPEED_MIN',
  'MOVING_FLOOR_SPEED_MAX',
  'DEMAND_RAMP_FROM_FLOOR',
  'DEMAND_RAMP_BAND_FLOORS',
  'MOVING_SHARE_STEP',
  'MOVING_SHARE_MAX',
  'MOVING_SPEED_STEP',
  'MOVING_FLOOR_SPEED_CAP',
] as const

export type CourseTunableName = (typeof COURSE_TUNABLE_NAMES)[number]

export type CourseTuning = Readonly<Record<CourseTunableName, number>>

export interface TuningProblem {
  readonly name: CourseTunableName
  readonly message: string
}

export function resolveCourseTuning(
  courseTuning: Readonly<Record<string, number>>,
  context: StageCheckContext = {},
): Result<CourseTuning, readonly TuningProblem[]> {
  const { tunables, baseTuning } = resolveContext(context)
  const values: Partial<Record<CourseTunableName, number>> = {}
  const problems: TuningProblem[] = []
  for (const name of COURSE_TUNABLE_NAMES) {
    const declaration = tunables[name]
    if (declaration === undefined) {
      problems.push({ name, message: `${name} is not declared.` })
      continue
    }
    const value = courseTuning[name] ?? baseTuning[name] ?? declaration.default
    const fault = tunableFault(name, value, declaration)
    if (fault === undefined) values[name] = value
    else problems.push({ name, message: fault })
  }
  if (problems.length > 0) return { ok: false, error: problems }
  return { ok: true, value: values as CourseTuning }
}
