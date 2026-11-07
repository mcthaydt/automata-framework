// The shared skeleton: 27 joints. Every figure is this rig with its own genes, so two characters are one rig
// with two sets of numbers. The figure faces +z, y is up, its own left is +x. Rest local rotations are the
// identity and limbs hang along −y, so a joint's local frame is "x left, y up the bone, z forward".
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/rig.ts at a1f7246. `twoBoneIK` is in
// two-bone-ik.ts. Changed for AF: the source's `skeleton(genes)` is `skeletonFromGenes` (the spec's
// `skeleton(def)` is in figure/figure-skeleton.ts), lookups by joint index go through `at`, which throws on an
// index the rig does not have, and the types are AF's strict ones. The formulas are the source's.

import {
  add,
  axisAngle,
  compose,
  IDENTITY_Q,
  type M,
  mmul,
  type Q,
  sub,
  type V3,
} from '../../../shared/math/math.ts'

export const JOINTS = [
  'root',
  'pelvis',
  'spine',
  'chest',
  'neck',
  'head',
  'clavicle.L',
  'upperArm.L',
  'foreArm.L',
  'hand.L',
  'clavicle.R',
  'upperArm.R',
  'foreArm.R',
  'hand.R',
  'thigh.L',
  'shin.L',
  'foot.L',
  'thigh.R',
  'shin.R',
  'foot.R',
  'socket.L',
  'socket.R',
  // Secondary motion: the hair's swinging chunks hang from these, driven by a spring, never by the body.
  'hair.back',
  'hair.L',
  'hair.R',
  // A wide trouser leg's hem hangs from these, not from the shin: the motion places each between its ankle and
  // the plumb under its hip, on the floor while the foot is planted, with the foot as it lifts.
  'hemL',
  'hemR',
] as const
export type Joint = (typeof JOINTS)[number]
export type Side = 'L' | 'R'
export const J: Readonly<Record<Joint, number>> = Object.fromEntries(
  JOINTS.map((name, i) => [name, i]),
) as Record<Joint, number>
const PARENT: Readonly<Record<Joint, Joint | null>> = {
  root: null,
  pelvis: 'root',
  spine: 'pelvis',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  'clavicle.L': 'chest',
  'upperArm.L': 'clavicle.L',
  'foreArm.L': 'upperArm.L',
  'hand.L': 'foreArm.L',
  'clavicle.R': 'chest',
  'upperArm.R': 'clavicle.R',
  'foreArm.R': 'upperArm.R',
  'hand.R': 'foreArm.R',
  'thigh.L': 'pelvis',
  'shin.L': 'thigh.L',
  'foot.L': 'shin.L',
  'thigh.R': 'pelvis',
  'shin.R': 'thigh.R',
  'foot.R': 'shin.R',
  'socket.L': 'hand.L',
  'socket.R': 'hand.R',
  'hair.back': 'head',
  'hair.L': 'head',
  'hair.R': 'head',
  // On the shin, so a pose that never places them hangs the hem with the shin.
  hemL: 'shin.L',
  hemR: 'shin.R',
}
/** Each joint's parent index, −1 for the root. Parents come before their children. */
export const PARENTS: readonly number[] = JOINTS.map((name) => {
  const parent = PARENT[name]
  return parent === null ? -1 : J[parent]
})

/** The element at `index`. Joint indices come from `J` and `PARENTS`, so a miss is a bug, not content. */
export function at<T>(list: readonly T[], index: number): T {
  const value = list[index]
  if (value === undefined) throw new RangeError(`no element ${index} (of ${list.length})`)
  return value
}

/** The arm chain a hold may rewrite (spec §7). */
export const armChain = (side: Side): number[] => [
  J[`upperArm.${side}`],
  J[`foreArm.${side}`],
  J[`hand.${side}`],
  J[`socket.${side}`],
]

/** Proportions: one generator, different numbers (the reference's gene sliders). Lengths in metres. */
export interface Genes {
  /** Standing height, to the crown. */
  height: number
  /** Chin to crown, and the head's width and depth as fractions of that. */
  head: number
  headWidth: number
  headDepth: number
  neck: number
  /** Half the distance between the shoulder joints, and between the hip joints. */
  shoulders: number
  hips: number
  /** The hip joint's height as a fraction of the height. */
  legs: number
  /** Shoulder to wrist, and the forearm's share of it. */
  arms: number
  forearm: number
  ankle: number
  foot: number
  /** Body thickness: the torso's and limbs' radii scale with it. */
  build: number
  /** Chest pitch forward (a stoop), the head's roll and its forward pitch, in radians. */
  posture: number
  headTilt: number
  headPitch: number
  /** How far the face sits ahead of the head's middle, of the head's half-depth: the face forward of the
   * cranium. Hair and headwear locks follow a share of it. */
  faceAhead: number
  /** A hunch (0–1): the shoulders raised and rounded forward, the head sunk forward between them. */
  hunch: number
  /** The body's sideways curve, −1…1 (0 level; +1 the figure's left shoulder lower): a pose roll of the spine and the
   * chest against each other, not a rest offset, since rest rotations are the identity and the body is skinned at rest. */
  sideBend: number
}
export interface Skeleton {
  genes: Genes
  /** Rest positions in figure space. */
  rest: V3[]
  /** Each joint's offset from its parent at rest. */
  offset: V3[]
  /** Bone lengths. */
  thigh: number
  shin: number
  upperArm: number
  foreArm: number
  shoulderY: number
  hipY: number
  chestY: number
  chinY: number
}
export function skeletonFromGenes(g: Genes): Skeleton {
  const k = g.height / 1.62
  const chinY = g.height - g.head,
    neckY = chinY - g.neck,
    shoulderY = neckY - 0.02 * k
  const hipY = g.legs * g.height,
    pelvisY = hipY + 0.05 * k,
    chestY = shoulderY - 0.11 * k,
    spineY = (pelvisY + chestY) / 2
  const upperArm = g.arms * (1 - g.forearm),
    foreArm = g.arms * g.forearm
  const armY = shoulderY - 0.045 * k
  const thigh = (hipY - g.ankle) * 0.5,
    shin = hipY - g.ankle - thigh
  const rest: V3[] = JOINTS.map((): V3 => [0, 0, 0])
  const set = (name: Joint, p: V3): void => {
    rest[J[name]] = p
  }
  set('root', [0, 0, 0])
  set('pelvis', [0, pelvisY, 0])
  set('spine', [0, spineY, 0])
  set('chest', [0, chestY, 0])
  // The neck leans a little forward from the shoulders and the skull sits forward of it, the face ahead of the neck.
  set('neck', [0, neckY, 0.01 * k])
  set('head', [0, chinY + 0.015 * k, 0.035 * k])
  for (const [s, x] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    set(`clavicle.${s}`, [x * 0.04 * k, shoulderY - 0.01 * k, 0])
    // The arm hangs from a little below the neck's base, so the shoulders slope down from the neck, not square off.
    set(`upperArm.${s}`, [x * g.shoulders, armY, 0])
    set(`foreArm.${s}`, [x * g.shoulders, armY - upperArm, 0])
    set(`hand.${s}`, [x * g.shoulders, armY - g.arms, 0])
    set(`socket.${s}`, [x * g.shoulders, armY - g.arms - 0.055 * k, 0])
    set(`thigh.${s}`, [x * g.hips, hipY, 0])
    set(`shin.${s}`, [x * g.hips, hipY - thigh, 0])
    set(`foot.${s}`, [x * g.hips, g.ankle, 0])
    // The hem's pivot at rest: on the floor under the hip, at the ankle.
    set(`hem${s}`, [x * g.hips, g.ankle, 0])
  }
  // The hair's pivots: high at the back of the head and above each ear.
  const head = at(rest, J.head),
    hw = (g.head * g.headWidth) / 2,
    hd = (g.head * g.headDepth) / 2
  set('hair.back', add(head, [0, g.head * 0.75, -hd * 0.55]))
  set('hair.L', add(head, [hw * 0.95, g.head * 0.72, -hd * 0.2]))
  set('hair.R', add(head, [-hw * 0.95, g.head * 0.72, -hd * 0.2]))
  const offset = rest.map((p, i): V3 => {
    const parent = at(PARENTS, i)
    return parent < 0 ? [...p] : sub(p, at(rest, parent))
  })
  return { genes: g, rest, offset, thigh, shin, upperArm, foreArm, shoulderY, hipY, chestY, chinY }
}
/** A pose: the root's place and facing, and each joint's local rotation and extra translation. */
export interface Pose {
  root: V3
  yaw: number
  rot: Q[]
  shift: V3[]
}
export function restPose(): Pose {
  return {
    root: [0, 0, 0],
    yaw: 0,
    rot: JOINTS.map((): Q => [...IDENTITY_Q]),
    shift: JOINTS.map((): V3 => [0, 0, 0]),
  }
}
export function clonePose(p: Pose): Pose {
  return {
    root: [...p.root],
    yaw: p.yaw,
    rot: p.rot.map((q): Q => [...q]),
    shift: p.shift.map((v): V3 => [...v]),
  }
}
/** Forward kinematics: every joint's world matrix (parents come first in JOINTS). */
export function fk(s: Skeleton, pose: Pose): M[] {
  const world: M[] = []
  for (let i = 0; i < JOINTS.length; i++) {
    const p = at(PARENTS, i)
    if (p < 0)
      world.push(
        mmul(compose(axisAngle([0, 1, 0], pose.yaw), pose.root), compose(at(pose.rot, i), [0, 0, 0])),
      )
    else world.push(mmul(at(world, p), compose(at(pose.rot, i), add(at(s.offset, i), at(pose.shift, i)))))
  }
  return world
}
