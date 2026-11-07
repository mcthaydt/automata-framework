// How the character moves. The numbers a designer tunes are in `content/tuning.toml` (Celeste's published constants,
// Maddy Thorson, `Player.cs`, 2018, converted from pixels per second to the sim's units: subpixels per tick at 60 ticks a
// second, whole numbers so every step is exact in every engine); the sim reads them from its content (`tuningOf`).
// What stays here changes what a tick or a pixel means, not how the character feels, so content cannot set it.

/** Subpixels per pixel. Positions and speeds are whole numbers of these. */
export const SUB = 256
export const TICK_HZ = 60

/** The character's hitbox in pixels: smaller than its 16 × 16 sprite, as in Celeste, so corners forgive. */
export const HITBOX_W = 8
export const HITBOX_H = 12

/** The tunables `content/tuning.toml` holds (each with its range there); every one is a whole number. */
export interface Tuning {
  /** Top running speed. */
  readonly MAX_RUN: number
  /** Running acceleration on the ground. */
  readonly RUN_ACCEL: number
  /** Running acceleration in the air. */
  readonly AIR_ACCEL: number
  /** Gravity, only while airborne. */
  readonly GRAVITY: number
  /** Gravity halves near the top of a jump while jump is held: below this vertical speed. */
  readonly HALF_GRAVITY_BELOW: number
  /** Terminal fall speed. */
  readonly MAX_FALL: number
  /** Jump speed (up is negative). */
  readonly JUMP_SPEED: number
  /** Ticks holding jump keeps the full jump speed. */
  readonly VAR_JUMP_TICKS: number
  /** Ticks a jump still works after walking off a ledge. */
  readonly COYOTE_TICKS: number
  /** Ticks a jump pressed before landing is remembered. */
  readonly BUFFER_TICKS: number
}

const NAMES: readonly (keyof Tuning)[] = [
  'MAX_RUN',
  'RUN_ACCEL',
  'AIR_ACCEL',
  'GRAVITY',
  'HALF_GRAVITY_BELOW',
  'MAX_FALL',
  'JUMP_SPEED',
  'VAR_JUMP_TICKS',
  'COYOTE_TICKS',
  'BUFFER_TICKS',
]

/**
 * A compiled `tuning` table as the sim's tunables: every one present and a whole number, or a thrown error (a wrong
 * table is a setup bug). A demo with its own content passes its `content.tuning` through this.
 */
export function tuningFrom(table: Readonly<Record<string, unknown>> | undefined | null): Tuning {
  if (table === undefined || table === null) throw new Error('emberwick: the sim content has no tuning')
  for (const name of NAMES)
    if (!Number.isInteger(table[name])) throw new Error(`emberwick: tuning.${name} is not a whole number`)
  return table as unknown as Tuning
}

/** The tuning inside the sim's content, which is frozen JSON typed `unknown` by the sim. */
export function tuningOf(content: unknown): Tuning {
  return tuningFrom((content as { tuning?: Record<string, unknown> } | null)?.tuning)
}
