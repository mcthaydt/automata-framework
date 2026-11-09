// What one frame of procedural motion reads and returns. Every layer is a pure function of the figure's skeleton, its
// gait and this state, so a frame is reproducible and a hold can replace one arm without touching anything else (:
// presentation time, pure, no Math.random). Changed for AF: the runtime hold is `ArmHold` (`Hold` names the item
// library's content shape); the state has no `action` (reach, look and flinch become clips in), no sprite cheats
// (`lookUp`, `view`, `pitch`), and gains `moveDir`.

import type { M, V3 } from '../../../shared/math/math.ts'
import type { Pose, Side } from '../body/rig.ts'
import type { Stand } from '../content/stand.schema.ts'
import type { AnchorKind } from '../figure/anchors.ts'

/**
 * A held item's or a placed hand's arm: the hand's place and turn (pitch, yaw, roll) in the chest's space, or
 * in the space of the joint `in`; `aim` sets the hand's turn by where its fingers point and its palm faces
 * instead. A stand's placed hand names the opening it went to (`anchor`).
 */
export interface ArmHold {
  readonly side: Side
  readonly hand: V3
  readonly turn: V3
  readonly pole: V3
  readonly in?: number | undefined
  readonly aim?: readonly [fingers: V3, palm: V3] | undefined
  readonly anchor?: AnchorKind | undefined
}

/** The hair's swing (rad), from its spring (hair-spring.ts): pitch back and forth, roll side to side. */
export interface HairSwing {
  readonly pitch: number
  readonly roll: number
}

export interface MotionState {
  /** Stepped seconds of the idle clock: breath, weight shift and twitches (clock.ts `poseClock`). */
  readonly t: number
  readonly moving: boolean
  /** The walk's phase over a two-step cycle, [0, 1) (1 is the same pose as 0). */
  readonly phase: number
  /** The body's facing (rad; 0 faces +z) and the head's lead over it. */
  readonly yaw: number
  readonly headYaw: number
  /** Turning on the spot: a short shuffle, its own phase; 0 when not turning. */
  readonly shuffle: number
  /** Walking, the direction of travel against the facing (rad): 0 forward, ±π/2 a strafe, π backing away. */
  readonly moveDir?: number | undefined
  readonly hair?: HairSwing | null | undefined
  /** The held item's arm, applied last. */
  readonly hold?: ArmHold | null | undefined
  /** Standing: the stand (the gait's relaxed one when left out), and its hands' holds if already placed. */
  readonly stand?: Stand | null | undefined
  readonly holds?: readonly ArmHold[] | null | undefined
  /** The least each arm (L, R) hangs out from the body (rad) to clear the dressed figure (`Built.clearance`). */
  readonly clear?: readonly [number, number] | null | undefined
}

/** A pose and every joint's world matrix. */
export interface Evaluated {
  pose: Pose
  world: M[]
}
