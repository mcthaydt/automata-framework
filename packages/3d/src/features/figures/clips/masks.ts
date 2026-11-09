// Masks: the body groups a clip owns while it plays. A clip's channels outside its mask are
// dropped before it is layered, so a slash masked to the right arm and the torso changes nothing below the pelvis
// and nothing in the left arm (I-h). Which channels each group owns is set here.

import type { Joint, Side } from '../body/rig.ts'
import type { PoseDef } from '../motion/pose.schema.ts'
import type { EffectorId, PoleId } from '../motion/targets.ts'
import type { MaskGroup } from './clip.schema.ts'

const EFFECTOR_GROUP: Readonly<Record<EffectorId, MaskGroup>> = {
  pelvis: 'pelvis',
  chest: 'torso',
  head: 'head',
  handL: 'armL',
  handR: 'armR',
  footL: 'legL',
  footR: 'legR',
}
const POLE_GROUP: Readonly<Record<PoleId, MaskGroup>> = {
  elbowL: 'armL',
  elbowR: 'armR',
  kneeL: 'legL',
  kneeR: 'legR',
}
const JOINT_GROUP: Readonly<Record<Joint, MaskGroup>> = {
  root: 'root',
  pelvis: 'pelvis',
  spine: 'torso',
  chest: 'torso',
  neck: 'head',
  head: 'head',
  'socket.L': 'head',
  'socket.R': 'head',
  'hair.back': 'head',
  'hair.L': 'head',
  'hair.R': 'head',
  'clavicle.L': 'armL',
  'upperArm.L': 'armL',
  'foreArm.L': 'armL',
  'hand.L': 'armL',
  'clavicle.R': 'armR',
  'upperArm.R': 'armR',
  'foreArm.R': 'armR',
  'hand.R': 'armR',
  'thigh.L': 'legL',
  'shin.L': 'legL',
  'foot.L': 'legL',
  hemL: 'legL',
  'thigh.R': 'legR',
  'shin.R': 'legR',
  'foot.R': 'legR',
  hemR: 'legR',
}

/** The entries of `record` whose key's group is in `mask`. */
function owned<K extends string, V>(
  record: Readonly<Partial<Record<K, V>>> | undefined,
  groups: Readonly<Record<K, MaskGroup>>,
  mask: readonly MaskGroup[],
): Partial<Record<K, V>> {
  const out: Partial<Record<K, V>> = {}
  for (const [key, value] of Object.entries(record ?? {}) as [K, V][])
    if (mask.includes(groups[key])) out[key] = value
  return out
}

/** `pose` with only the channels `mask` owns: its handles, poles, fk joints and (under `root`) its root offset. */
export function maskPose(pose: PoseDef, mask: readonly MaskGroup[]): PoseDef {
  return {
    effectors: owned(pose.effectors, EFFECTOR_GROUP, mask),
    poles: owned(pose.poles, POLE_GROUP, mask),
    fk: owned(pose.fk, JOINT_GROUP, mask),
    ...(pose.root && mask.includes('root') ? { root: pose.root } : {}),
  }
}

/** Whether a clip masked by `mask` owns the arm on `side` (an item's hold then waits). */
export const ownsArm = (mask: readonly MaskGroup[], side: Side): boolean =>
  mask.includes(side === 'L' ? 'armL' : 'armR')

const LEG_GROUPS: readonly MaskGroup[] = ['root', 'pelvis', 'legL', 'legR']

/** Whether `pose` moves the hips or a leg, so the hems must hang again from the solved legs. */
export function movesLegs(pose: PoseDef): boolean {
  const legs = maskPose(pose, LEG_GROUPS)
  return (
    Object.keys(legs.effectors).length > 0 ||
    Object.keys(legs.poles ?? {}).length > 0 ||
    Object.keys(legs.fk ?? {}).length > 0 ||
    legs.root !== undefined
  )
}
