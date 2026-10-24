// The tunables a stage may override (2D editor spec §10.7), vendored from FloorFifty's `packages/shared/src/common/tuning.ts`
// at commit ee5d44e (FF-D3; see testing/PROVENANCE.md). A tunable is a type, an inclusive range and a default; a stage's
// `courseTuning` names some of them, and the checks and the course generator (EDFF.1c) read the same declarations. A
// refresh is a re-copy at a newer commit with the diff reviewed.

export type TunableType = 'int' | 'float'

export interface TunableDeclaration {
  readonly type: TunableType
  /** Inclusive lower bound. */
  readonly min: number
  /** Inclusive upper bound. */
  readonly max: number
  readonly default: number
}

export const TUNABLES: Readonly<Record<string, TunableDeclaration>> = {
  COURSE_FLOOR_COUNT: { type: 'int', min: 20, max: 100, default: 20 },
  FLOOR_WIDTH: { type: 'int', min: 64, max: 256, default: 120 },
  FLOOR_HEIGHT: { type: 'int', min: 8, max: 64, default: 20 },
  PLAYER_WIDTH: { type: 'int', min: 16, max: 96, default: 59 },
  PLAYER_HEIGHT: { type: 'int', min: 16, max: 128, default: 59 },
  GRAVITY: { type: 'float', min: -1200, max: -100, default: -275 },
  BOUNCE_VELOCITY: { type: 'float', min: 100, max: 1200, default: 268.2 },
  MAX_MOVE_SPEED: { type: 'float', min: 50, max: 900, default: 356 },
  FAST_FALL_VELOCITY: { type: 'float', min: -2000, max: -100, default: -1341 },
  FLOOR_GAP_MIN: { type: 'float', min: 40, max: 200, default: 540 / 4.2 },
  FLOOR_GAP_MAX: { type: 'float', min: 40, max: 320, default: 540 / 4.2 },
  MOVING_FLOOR_SPEED_MIN: { type: 'float', min: 0, max: 400, default: 100 },
  MOVING_FLOOR_SPEED_MAX: { type: 'float', min: 0, max: 400, default: 200 },
  DEATH_LINE_MARGIN: { type: 'int', min: 100, max: 800, default: 265 },
  LAP_HOLD_TICKS: { type: 'int', min: 0, max: 120, default: 48 },
  MOVING_FLOOR_CARRY: { type: 'float', min: 0, max: 1, default: 1 },
  RACE_TIME_LIMIT_TICKS: { type: 'int', min: 0, max: 36_000, default: 0 },
  SURVIVAL_VIEW_HEIGHT: { type: 'float', min: 300, max: 1200, default: 480 },
  SURVIVAL_GRACE_TICKS: { type: 'int', min: 0, max: 1800, default: 180 },
  SURVIVAL_RISE_START: { type: 'float', min: 0, max: 400, default: 55 },
  SURVIVAL_RISE_STEP: { type: 'float', min: 0, max: 200, default: 20 },
  SURVIVAL_RISE_STEP_TICKS: { type: 'int', min: 60, max: 3600, default: 1800 },
  SURVIVAL_RISE_CAP: { type: 'float', min: 0, max: 400, default: 150 },
  SURVIVAL_PUSH_AT: { type: 'float', min: 0.3, max: 0.9, default: 0.55 },
  SURVIVAL_PUSH_SPEED: { type: 'float', min: 50, max: 1200, default: 300 },
  SURVIVAL_BAND_AHEAD_STEP: { type: 'float', min: 0, max: 1, default: 0.1 },
  SURVIVAL_BAND_AHEAD_MAX: { type: 'float', min: 1, max: 3, default: 1.5 },
  SURVIVAL_BAND_BEHIND_STEP: { type: 'float', min: 0, max: 1, default: 0.05 },
  SURVIVAL_BAND_BEHIND_MIN: { type: 'float', min: 0.1, max: 1, default: 0.7 },
  DEMAND_RAMP_FROM_FLOOR: { type: 'int', min: 50, max: 1000, default: 50 },
  DEMAND_RAMP_BAND_FLOORS: { type: 'int', min: 1, max: 100, default: 10 },
  MOVING_SHARE_STEP: { type: 'float', min: 0, max: 0.5, default: 0.05 },
  MOVING_SHARE_MAX: { type: 'float', min: 0.5, max: 1, default: 0.8 },
  MOVING_SPEED_STEP: { type: 'float', min: 0, max: 100, default: 10 },
  MOVING_FLOOR_SPEED_CAP: { type: 'float', min: 0, max: 400, default: 300 },
}

/**
 * Code-only names an author might try. They are not tunables, so `courseTuning` cannot name them, and naming one is
 * answered with "this is an invariant" rather than "no such name", which sends the author looking for a typo.
 */
export const AUTHORING_INVARIANTS: readonly string[] = [
  'TICK_HZ',
  'TICK_MS',
  'TICK_SECONDS',
  'SNAPSHOT_HZ',
  'VIEWPORT',
  'VIEWPORT_WIDTH',
  'VIEWPORT_HEIGHT',
  'MAX_PLAYERS',
  'PROTOCOL_VERSION',
  'COUNTDOWN_TICKS',
  'RECONNECT_GRACE_TICKS',
]

/**
 * Why `value` is not an allowed value of the tunable, in words; `undefined` when it is. The game refuses the same values
 * (`resolveTuning`): not a number, outside the inclusive range, or a fraction for an `int`.
 */
export function tunableFault(
  name: string,
  value: number,
  declaration: TunableDeclaration,
): string | undefined {
  if (Number.isNaN(value)) return `${name} is not a number.`
  const whole = declaration.type === 'int'
  if (value >= declaration.min && value <= declaration.max && (!whole || Number.isInteger(value)))
    return undefined
  return `${name} is ${value}; it must be ${whole ? 'a whole number ' : ''}from ${declaration.min} to ${declaration.max}.`
}

/**
 * The top floor of a stage's climb: `COURSE_FLOOR_COUNT` is the floors in an ascent including the fixed starting floor,
 * so the top is one below it. The count comes from the stage's own tuning, else the base tuning (`tuning.toml`), else the
 * declared default. `undefined` when the count is out of range or not whole, or the declarations do not know it: that
 * is a finding of its own (`tunableRange`), and the course checks stay quiet rather than judge floors by a wrong top.
 */
export function courseTopFloor(
  declarations: Readonly<Record<string, TunableDeclaration>>,
  base: Readonly<Record<string, number>>,
  overrides: Readonly<Record<string, number>>,
): number | undefined {
  const declaration = declarations.COURSE_FLOOR_COUNT
  if (declaration === undefined) return undefined
  const count = overrides.COURSE_FLOOR_COUNT ?? base.COURSE_FLOOR_COUNT ?? declaration.default
  if (tunableFault('COURSE_FLOOR_COUNT', count, declaration) !== undefined) return undefined
  return count - 1
}
