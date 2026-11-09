// Presentation time: the pose clock that steps the walk and the idle, one pose step of the turn on the spot, and the
// head's lead into it. Pure: the view keeps the shown facing and the time; these say what pose to show for them. From
// The formulas of the figure's `update` and `motion`, changed for AF: the walk's phase is stepped from whole pose steps of the time (the source accumulated
// `dt / cycle` while moving), so it repeats exactly after one cycle (F-c); the head's lead has no 30° steps and no turn
// toward the camera (sprite cheats).

import type { Gait } from '../content/gait.schema.ts'

export interface PoseClock {
  /** The walk's phase, stepped at `walkPoses` a cycle: one of k / walkPoses, in [0, 1). It comes from the
   * time given, so a caller that wants a walk to start on its first pose passes the time since it started. */
  readonly phase: number
  /** The idle's stepped seconds, looped at the gait's idle loop and held `idlePoses` a loop where it sets them. */
  readonly t: number
  /** Whole pose steps at the gait's `poseRate`: the turn's and the shuffle's beat. */
  readonly step: number
}

/**
 * The stepped clocks at presentation time `time` (s). `still`: the idle holds its first pose (t 0) while the
 * figure turns on the spot, so a turn is one strip of poses, not one a breath (`idleT = still ? 0 : steppedT`; its other reason to hold, an action, is a clip's).
 */
export function poseClock(gait: Gait, time: number, options: { readonly still?: boolean } = {}): PoseClock {
  const walkStep = Math.floor((time * gait.walkPoses) / gait.cycle)
  const phase = (((walkStep % gait.walkPoses) + gait.walkPoses) % gait.walkPoses) / gait.walkPoses
  // Idle loops (the gait's idleLoop, or the breath alone), so idle poses repeat. An idle with `idlePoses` holds
  // that many poses across its loop, as a pixel artist's idle is a few frames, not twelve a second.
  const loopS = gait.idleLoop ?? (gait.shift === 0 && gait.twitch === 0 ? gait.breathPeriod : 0)
  const step = Math.floor(time * gait.poseRate)
  const loop = Math.round(loopS * gait.poseRate)
  const idlePoses = gait.idlePoses ?? 0
  const held = loopS > 0 && idlePoses ? loopS / idlePoses : 0
  const t = held
    ? (Math.floor(time / held) % idlePoses) * held
    : (loop > 0 ? step % loop : step) / gait.poseRate
  return { phase, t: options.still ? 0 : t, step }
}

const TAU = Math.PI * 2
/** An angle wrapped to [−π, π) (the source's `wrapAngle`). */
export const wrapAngle = (a: number): number => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI

/** One pose step of a turn on the spot: the shown facing moves toward the wanted one by at most `turnRate`. */
export function turnStep(gait: Gait, shown: number, facing: number): number {
  const diff = wrapAngle(facing - shown)
  return Math.abs(diff) <= gait.turnRate ? facing : shown + Math.sign(diff) * gait.turnRate
}

/** The head's lead over the shown facing while it turns toward the wanted one, at most `headLead` either way. */
export function headLead(gait: Gait, shown: number, facing: number): number {
  return Math.max(-gait.headLead, Math.min(gait.headLead, wrapAngle(facing - shown)))
}

/** The shuffle's phase while turning on the spot (0 when not, or for a gait that pivots): a four-beat step. */
export function shufflePhase(gait: Gait, clock: PoseClock, turning: boolean, moving: boolean): number {
  return turning && !moving && gait.shuffle !== false ? (clock.step % 4) / 4 : 0
}
