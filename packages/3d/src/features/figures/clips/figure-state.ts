// What `evaluate` reads (`FigureState`): what the sim says about one figure through its render
// row, and the content it plays from. The additions to the spec's shape (`action.replaced`, stances with their
// times, `pins`, `hair`) are this state's own; `MotionLibrary` is the library the motion reads.

import type { Gait } from '../content/gait.schema.ts'
import type { ItemDef } from '../content/item.schema.ts'
import type { RigLimits } from '../content/rig-limits.schema.ts'
import type { Stand } from '../content/stand.schema.ts'
import type { HairSwing } from '../motion/motion-state.ts'
import type { AimTarget, LimbId, Vec3 } from '../motion/targets.ts'
import type { PoseLibrary } from './blend-key-poses.ts'
import type { FigureClipDef } from './clip.schema.ts'

/** A clip the sim started: its id, when (presentation seconds) and, when given, the length (s) it is retimed to. */
export interface ClipStart {
  readonly id: string
  readonly startedAt: number
  readonly length?: number | undefined
}

/** The action clip; `replaced` is the action it cut into, so the view can carry the outgoing pose into it. */
export interface ActionState extends ClipStart {
  readonly replaced?: ClipStart | undefined
}

/** A stance clip held while the sim says so; `endedAt` once the sim lowered it, while it ramps out. */
export interface StanceState {
  readonly id: string
  readonly startedAt: number
  readonly endedAt?: number | undefined
}

export interface FigureState {
  readonly moving: boolean
  /** m/s; the gait's cycle sets the walk's phase, so `evaluate` does not read it. */
  readonly speed: number
  /** Radians; the root faces it, at the origin (decision 3). */
  readonly facing: number
  /** Radians of travel relative to facing: 0 forward, ±π/2 a strafe, π backing away. */
  readonly moveDir?: number | undefined
  readonly action?: ActionState | undefined
  /** Layered in this order, under the action. */
  readonly stances?: readonly StanceState[] | undefined
  /** Where the head, chest or a hand points, in the figure's space (decision 3). */
  readonly aim?: readonly AimTarget[] | undefined
  /** A planted foot or hand: its position in the figure's space, solved every frame. */
  readonly pins?: Readonly<Partial<Record<LimbId, Vec3>>> | undefined
  readonly outfit?: string | undefined
  /** An item id, held in the figure's `hand` while no clip owns that arm. */
  readonly item?: string | undefined
  /** The hair spring's swing, which the view steps (`hairStep`). */
  readonly hair?: HairSwing | undefined
}

/** The content a figure plays from, each by id. */
export interface MotionLibrary {
  readonly gaits: Readonly<Record<string, Gait>>
  readonly poses: PoseLibrary
  readonly clips: Readonly<Record<string, FigureClipDef>>
  readonly items: Readonly<Record<string, ItemDef>>
  readonly stands: Readonly<Record<string, Stand>>
  readonly rigs: Readonly<Record<string, RigLimits>>
}

export interface EvaluateOptions {
  /** The previous frame's presentation time, so a clip shows a marker passed since (`stepTime`). */
  readonly previous?: number | undefined
  /** Sample clips at the frame's time instead of at their pose rate. */
  readonly smooth?: boolean | undefined
  /** Told once per clip id the library lacks (with `warned`, the ids already told, which the caller keeps). */
  readonly warn?: ((message: string) => void) | undefined
  readonly warned?: Set<string> | undefined
}
