import { z } from 'zod'
import { asWritten } from '../math/as-written'
import type { Gait } from './motion'

const n = z.number()

/** A gait (library/gaits.json): how a character walks, stands and breathes. The fields are written in the file's order,
 * which is the order of the type; an unknown key is an error, never dropped. */
export const gaitSchema = z.strictObject({
  cycle: n,
  speed: n,
  stride: n,
  duty: n,
  lift: n,
  bob: n,
  crouch: n,
  sway: n,
  hipYaw: n,
  hipRoll: n,
  chestCounter: n,
  lean: n,
  armSwing: n,
  armOut: n,
  elbow: n,
  elbowSwing: n,
  armLag: n,
  headLevel: n,
  headStabilize: n,
  drag: n,
  track: n,
  standOut: n.optional(),
  poseRate: n,
  walkPoses: n,
  turnRate: n,
  headLead: n,
  twitch: n.optional(),
  twitchEvery: n.optional(),
  breath: n,
  breathPeriod: n,
  shift: n,
  shiftPeriod: n,
  idleLoop: n.optional(),
  idlePoses: n.optional(),
  shuffle: z.boolean().optional(),
  plumb: n.optional(),
  reach: n,
  stance: n,
  stanceLead: n,
  hang: n,
  idleElbow: n,
  standElbow: n.optional(),
  shoulderRoll: n.optional(),
  heel: n.optional(),
  push: n.optional(),
  spring: n.optional(),
  chin: n.optional(),
}) satisfies z.ZodType<Gait>

/** The whole file: gaits by name. */
export const gaitsSchema = asWritten(z.record(z.string(), gaitSchema))
