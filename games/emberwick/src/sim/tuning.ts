// How the character moves. Celeste's published constants (Maddy Thorson, `Player.cs`, 2018), converted from
// pixels per second to the sim's units: subpixels (SUB per pixel) per tick at 60 ticks a second. Integers keep
// every step exact in every engine. Each comment gives the original value.

/** Subpixels per pixel. Positions and speeds are whole numbers of these. */
export const SUB = 256
export const TICK_HZ = 60

/** The character's hitbox in pixels: smaller than its 16 × 16 sprite, as in Celeste, so corners forgive. */
export const HITBOX_W = 8
export const HITBOX_H = 12

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
