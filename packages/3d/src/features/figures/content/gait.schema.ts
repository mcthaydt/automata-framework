// A gait: the walk and idle cycle's numbers (FigureBuilder src/render/figure/motion.ts `Gait`, library/gaits.json
// at a1f7246). The motion that reads them is M3.5c's; this is their content shape. Units are the source's:
// seconds, metres at a 1.62 m figure, radians.

import { z } from 'zod'
import { partialOf } from './shapes.schema.ts'

const n = z.number()
const positive = z.number().positive()
const share = z.number().min(0).max(1)

const gaitShape = {
  /** Seconds per two-step cycle, and the speed it is tuned for (m/s). */
  cycle: positive,
  speed: positive,
  /** Foot travel over a stance, the stance's share of the cycle, and the swing foot's lift. */
  stride: n,
  duty: share,
  lift: n,
  /** Pelvis bob and drop while walking, sideways sway, yaw and roll with the stride. */
  bob: n,
  crouch: n,
  sway: n,
  hipYaw: n,
  hipRoll: n,
  /** How much of the hips' yaw the chest turns back; forward lean while walking. */
  chestCounter: n,
  lean: n,
  /** Arm swing, how far out the arms hang, the elbow's bend at rest and in the swing, the swing's lag (cycles). */
  armSwing: n,
  armOut: n,
  elbow: n,
  elbowSwing: n,
  armLag: n,
  /** 0–1: the neck takes up the pelvis bob, and cancels the chest's turn. */
  headLevel: share,
  headStabilize: share,
  /** 0–1: the swing foot stays low with its toes down. Feet this far apart (of the hip width). */
  drag: share,
  track: n,
  /** Poses per second for idle, turns and actions; poses per walk cycle. */
  poseRate: positive,
  walkPoses: z.number().int().positive(),
  /** Turn speed (rad per pose step) and how far the head leads the body (rad). */
  turnRate: positive,
  headLead: n,
  /** A head twitch: its size (rad) and how often (s). */
  twitch: n,
  twitchEvery: positive,
  /** Idle: breath (rad), weight shift (m), and their periods (s). */
  breath: n,
  breathPeriod: positive,
  shift: n,
  shiftPeriod: positive,
  idleLoop: positive.optional(),
  idlePoses: z.number().int().positive().optional(),
  shuffle: z.boolean().optional(),
  plumb: n.optional(),
  /** Seconds a reach takes, out and back (the reach becomes a clip in M3.6). */
  reach: positive,
  /** Standing: weight on one leg, that foot's lead, the arms' forward hang and extra elbow bend. */
  stance: n,
  stanceLead: n,
  hang: n,
  idleElbow: n,
  standOut: n.optional(),
  shoulderRoll: n.optional(),
  heel: n.optional(),
  push: n.optional(),
  spring: share.optional(),
  chin: n.optional(),
}

export interface Gait {
  /** Seconds per two-step cycle, and the speed it is tuned for (m/s). */
  readonly cycle: number
  readonly speed: number
  /** Foot travel over a stance, the stance's share of the cycle, and the swing foot's lift. */
  readonly stride: number
  readonly duty: number
  readonly lift: number
  /** Pelvis bob and drop while walking, sideways sway, yaw and roll with the stride. */
  readonly bob: number
  readonly crouch: number
  readonly sway: number
  readonly hipYaw: number
  readonly hipRoll: number
  /** How much of the hips' yaw the chest turns back; forward lean while walking. */
  readonly chestCounter: number
  readonly lean: number
  /** Arm swing, how far out the arms hang, the elbow's bend at rest and in the swing, the swing's lag (cycles). */
  readonly armSwing: number
  readonly armOut: number
  readonly elbow: number
  readonly elbowSwing: number
  readonly armLag: number
  /** 0–1: the neck takes up the pelvis bob, and cancels the chest's turn. */
  readonly headLevel: number
  readonly headStabilize: number
  /** 0–1: the swing foot stays low with its toes down. Feet this far apart (of the hip width). */
  readonly drag: number
  readonly track: number
  /** Poses per second for idle, turns and actions; poses per walk cycle. */
  readonly poseRate: number
  readonly walkPoses: number
  /** Turn speed (rad per pose step) and how far the head leads the body (rad). */
  readonly turnRate: number
  readonly headLead: number
  /** A head twitch: its size (rad) and how often (s). */
  readonly twitch: number
  readonly twitchEvery: number
  /** Idle: breath (rad), weight shift (m), and their periods (s). */
  readonly breath: number
  readonly breathPeriod: number
  readonly shift: number
  readonly shiftPeriod: number
  readonly idleLoop?: number | undefined
  readonly idlePoses?: number | undefined
  readonly shuffle?: boolean | undefined
  readonly plumb?: number | undefined
  /** Seconds a reach takes, out and back (the reach becomes a clip in M3.6). */
  readonly reach: number
  /** Standing: weight on one leg, that foot's lead, the arms' forward hang and extra elbow bend. */
  readonly stance: number
  readonly stanceLead: number
  readonly hang: number
  readonly idleElbow: number
  readonly standOut?: number | undefined
  readonly shoulderRoll?: number | undefined
  readonly heel?: number | undefined
  readonly push?: number | undefined
  readonly spring?: number | undefined
  readonly chin?: number | undefined
}

export const gaitSchema: z.ZodType<Gait> = z.strictObject(gaitShape)

/** Any of a gait's numbers, changed on top of a library gait (FigureBuilder cast.ts `gaitOverrides`). */
export const gaitOverridesSchema: z.ZodType<Partial<Gait>> = partialOf<Gait>(
  z.strictObject(gaitShape).partial(),
)
