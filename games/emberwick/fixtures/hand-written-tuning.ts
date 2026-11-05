// The tunables as they were written by hand in `src/shared/tuning.ts` before `content/tuning.toml` held them. Celeste's
// published constants in the sim's units (subpixels per tick at 60 ticks a second). The equivalence test replays the
// golden route with these and with the compiled content.

import type { Tuning } from '../src/shared/tuning.ts'

/** 90 px/s. */
export const MAX_RUN = 384

/** 1000 px/s², on the ground. */
export const RUN_ACCEL = 71

/** RUN_ACCEL × 0.65 in the air (AirMult). */
export const AIR_ACCEL = 46

/** 900 px/s², only while airborne. */
export const GRAVITY = 64

/** Gravity halves near the top of a jump while jump is held: below 40 px/s of vertical speed. */
export const HALF_GRAVITY_BELOW = 171

/** 160 px/s. */
export const MAX_FALL = 683

/** −105 px/s (up is negative). */
export const JUMP_SPEED = -448

/** 0.2 s: how long holding jump keeps the full jump speed (VarJumpTime). */
export const VAR_JUMP_TICKS = 12

/** 0.1 s: a jump still works this long after walking off a ledge (JumpGraceTime). */
export const COYOTE_TICKS = 6

/** About 0.08 s: a jump pressed this long before landing still happens. */
export const BUFFER_TICKS = 5

/** All ten, as the sim's content holds them. */
export const HAND_WRITTEN_TUNING: Tuning = {
  MAX_RUN,
  RUN_ACCEL,
  AIR_ACCEL,
  GRAVITY,
  HALF_GRAVITY_BELOW,
  MAX_FALL,
  JUMP_SPEED,
  VAR_JUMP_TICKS,
  COYOTE_TICKS,
  BUFFER_TICKS,
}
