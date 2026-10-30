import { z } from 'zod'

// The race's tuning (FloorFifty's `common/tuning.ts`, the race-mode subset), in metres, seconds and ticks. It is the
// game's content: the starter ships placeholder values (`content/placeholder.content.ts`) and a game replaces them.
// `racePlugins` puts the whole object in the plugin's config, so a different tuning is a different sim schema hash.

const positive = z.number().positive()

/**
 * The tick rate the race is tuned for, FloorFifty's 60 Hz and the sim's default: create the race's sim with it. The
 * fast-fall bound below is per tick of this rate.
 */
export const RACE_TICK_HZ = 60

const fields = z
  .object({
    /** Horizontal wrap width: a racer leaving one side enters the other. Floors stay one floor width inside it. */
    viewportWidth: positive,
    /** Floors in a course, the fixed start floor included. */
    floorCount: z.number().int().min(2).max(1000),
    /** Ascents to finish: completing one respawns the racer at the start for the next. */
    lapCount: z.number().int().min(1).max(9),
    floorWidth: positive,
    floorHeight: positive,
    /** The vertical distance from one floor to the next. */
    floorGap: positive,
    racerWidth: positive,
    racerHeight: positive,
    /** m/s², negative: down. */
    gravity: z.number().negative(),
    /** The upward speed any counted contact with a floor gives (m/s). */
    bounceVelocity: positive,
    /** Horizontal speed while steering; releasing stops dead (m/s). */
    moveSpeed: positive,
    /** The downward speed a held fast fall sets, negative (m/s). */
    fastFallVelocity: z.number().negative(),
    /** Moving floors draw a speed in [min, max) (m/s). */
    movingSpeedMin: z.number().nonnegative(),
    movingSpeedMax: positive,
    /** How far below the start floor a fall respawns a racer (m). */
    deathLineMargin: positive,
    /** Ticks a racer rests at the spawn after completing a lap. */
    lapHoldTicks: z.number().int().min(0).max(600),
    /** The share of a moving floor's travel a racer standing on it is carried by, 0 to 1. */
    movingFloorCarry: z.number().min(0).max(1),
  })
  .strict()

/** Validates a race tuning: every field, and the relations between them that keep a course playable. */
export const raceTuningSchema: z.ZodType<RaceTuning> = fields
  .refine((t) => (t.bounceVelocity * t.bounceVelocity) / (2 * -t.gravity) > t.floorGap, {
    message: 'one bounce must clear the floor gap: bounceVelocity² / (2|gravity|) > floorGap',
  })
  .refine((t) => t.viewportWidth > t.floorWidth * 2, {
    message: 'the viewport must be wider than two floors, or moving floors have no room to travel',
  })
  .refine((t) => t.movingSpeedMin <= t.movingSpeedMax, {
    message: 'movingSpeedMin must not exceed movingSpeedMax',
  })
  // Plus physics has no swept test, so a landing is found by overlap after the step and pushed out along the shallower
  // axis. While one tick's fall stays under half of floorHeight + racerHeight, the racer's centre cannot pass the
  // floor's, so the push-out always lifts it back on top (8b-D4). One tick's fall is the fastest a racer enters a step
  // with (the fast fall: the step clamps every fall to it, 8b-D9) plus the speed gravity adds during that step, over one
  // tick: (|fastFallVelocity| + |gravity| / hz) / hz. Checked at parse time, never inside a step.
  .refine(
    (t) =>
      (-t.fastFallVelocity + -t.gravity / RACE_TICK_HZ) / RACE_TICK_HZ < (t.floorHeight + t.racerHeight) / 2,
    {
      message:
        'one tick of fast fall must stay under half of floorHeight + racerHeight, or a racer can pass a floor',
    },
  )

/** A validated race tuning; each field is documented on `raceTuningSchema`'s object above. */
export interface RaceTuning {
  readonly viewportWidth: number
  readonly floorCount: number
  readonly lapCount: number
  readonly floorWidth: number
  readonly floorHeight: number
  readonly floorGap: number
  readonly racerWidth: number
  readonly racerHeight: number
  readonly gravity: number
  readonly bounceVelocity: number
  readonly moveSpeed: number
  readonly fastFallVelocity: number
  readonly movingSpeedMin: number
  readonly movingSpeedMax: number
  readonly deathLineMargin: number
  readonly lapHoldTicks: number
  readonly movingFloorCarry: number
}
