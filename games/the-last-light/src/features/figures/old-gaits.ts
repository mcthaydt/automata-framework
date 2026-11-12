// The old game's two gaits whole (`src/render/figure/library/gaits.json` at 92e6704) that Ada and the night nurse walk, with the old
// numbers. The builder's own `brisk` and `loose` are other, tamer walks (its `brisk` leans 0.04 where the old one leans 0.12, turns the
// hips 0.1 where the old turned them 0.18), so a character that says only `gait: 'brisk'` and the old file's six overrides walks upright
// with her arms drifting. A character's `gaitOverrides` go over the builder's gait, and the builder still reads the old legacy fields
// (`twitch`, `idlePoses`, `idleLoop`, `shuffle`), so the whole old gait is an override and the library takes no new entry.
import type { CharacterDef } from '@automata/character-kit'

type Gait = NonNullable<CharacterDef['gaitOverrides']>

/** Ada's: brisk and leaning in, the hips turning with the stride, the feet lifted, the elbows bent and swinging. */
export const OLD_BRISK: Gait = {
  cycle: 0.5,
  speed: 3,
  stride: 0.62,
  duty: 0.55,
  lift: 0.09,
  bob: 0.03,
  crouch: 0.04,
  sway: 0.02,
  hipYaw: 0.18,
  hipRoll: 0.05,
  chestCounter: 0.6,
  lean: 0.12,
  armSwing: 0.4,
  armOut: 0.13,
  elbow: 0.25,
  elbowSwing: 0.5,
  armLag: 0,
  headLevel: 0,
  headStabilize: 0.8,
  drag: 0,
  track: 0.7,
  twitch: 0,
  twitchEvery: 3,
  idlePoses: 8,
  stance: 0.04,
  stanceLead: 0.08,
  hang: 0.12,
  idleElbow: 0.45,
}

/** The night nurse's: slow, the swing foot dragging, the head level and leading the body, the arms stiff, six poses to a step, no shuffle. */
export const OLD_UNCANNY: Gait = {
  cycle: 0.8,
  speed: 1.05,
  stride: 0.5,
  duty: 0.62,
  lift: 0.04,
  bob: 0.028,
  crouch: 0.015,
  sway: 0.03,
  hipYaw: 0.05,
  hipRoll: 0.04,
  chestCounter: 0.15,
  lean: 0,
  armSwing: 0.04,
  armOut: 0.2,
  elbow: 0.04,
  elbowSwing: 0,
  armLag: 0.3,
  headLevel: 1,
  headStabilize: 1,
  drag: 0.6,
  track: 0.45,
  poseRate: 8,
  walkPoses: 6,
  turnRate: 0.39269908169872414,
  headLead: 1.8849555921538759,
  twitch: 0.38,
  twitchEvery: 3,
  breath: 0,
  breathPeriod: 6,
  shift: 0,
  shiftPeriod: 7,
  reach: 2.4,
  idleLoop: 6,
  idlePoses: 12,
  shuffle: false,
  stance: 0,
  stanceLead: 0,
  hang: -0.04,
  idleElbow: 0,
}
