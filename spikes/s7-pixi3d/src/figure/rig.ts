// Copied from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/rig.ts at a1f7246, unchanged apart from
// formatting and the import extension (spike S7, M3.1a). The Last Light 92e6704 has the same file minus the hem pivots.
import {
  add,
  apply,
  applyDir,
  axisAngle,
  basis,
  clamp,
  compose,
  cross,
  dot,
  IDENTITY_Q,
  length,
  type M,
  matq,
  mmul,
  normalize,
  position,
  type Q,
  qmat,
  scale,
  sub,
  type V3,
} from './math.ts'
/**
 * The shared skeleton (spike): 20 joints and a socket in each hand. Every figure is this rig with its own genes, so Ada
 * and the Nurse are one rig with two sets of numbers. The figure faces +z, y is up, its own left is +x. Rest local
 * rotations are the identity and limbs hang along −y, so a joint's local frame is "x left, y up the bone, z forward".
 */
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
  // Secondary motion: the hair's swinging chunks hang from these, driven by a spring (figure.ts), never by the body.
  'hair.back',
  'hair.L',
  'hair.R',
  // A wide trouser leg's hem hangs from these, not from the shin: motion.ts places each between its ankle and the plumb
  // under its hip, on the floor while the foot is planted, with the foot as it lifts (parts.ts hemSkin binds a hem's rings).
  'hemL',
  'hemR',
] as const
export type Joint = (typeof JOINTS)[number]
export type Side = 'L' | 'R'
export const J = Object.fromEntries(JOINTS.map((name, i) => [name, i])) as Record<Joint, number>
const PARENT: Record<Joint, Joint | null> = {
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
  // On the shin, so a pose that never places them (one made outside motion.ts) hangs the hem with the shin.
  hemL: 'shin.L',
  hemR: 'shin.R',
}
export const PARENTS: number[] = JOINTS.map((name) => (PARENT[name] ? J[PARENT[name]!] : -1))
/** The arm chain a hold may rewrite (spec §7). */
export const armChain = (side: Side) => [
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
  /** How far the face sits ahead of the head's middle, of the head's half-depth: the face forward of the cranium. Hair
   * and headwear locks follow a share of it (garments.ts). */
  faceAhead: number
  /** A hunch (0–1): the shoulders raised and rounded forward, the head sunk forward between them (motion.ts). */
  hunch: number
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
export function skeleton(g: Genes): Skeleton {
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
  const rest: V3[] = new Array(JOINTS.length)
  const set = (name: Joint, p: V3) => {
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
  const head = rest[J.head],
    hw = (g.head * g.headWidth) / 2,
    hd = (g.head * g.headDepth) / 2
  set('hair.back', add(head, [0, g.head * 0.75, -hd * 0.55]))
  set('hair.L', add(head, [hw * 0.95, g.head * 0.72, -hd * 0.2]))
  set('hair.R', add(head, [-hw * 0.95, g.head * 0.72, -hd * 0.2]))
  const offset = rest.map((p, i) => (PARENTS[i] < 0 ? ([...p] as V3) : sub(p, rest[PARENTS[i]])))
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
    rot: JOINTS.map(() => [...IDENTITY_Q] as Q),
    shift: JOINTS.map(() => [0, 0, 0] as V3),
  }
}
export function clonePose(p: Pose): Pose {
  return {
    root: [...p.root],
    yaw: p.yaw,
    rot: p.rot.map((q) => [...q] as Q),
    shift: p.shift.map((v) => [...v] as V3),
  }
}
/** Forward kinematics: every joint's world matrix (parents come first in JOINTS). */
export function fk(s: Skeleton, pose: Pose): M[] {
  const world: M[] = new Array(JOINTS.length)
  for (let i = 0; i < JOINTS.length; i++) {
    const p = PARENTS[i]
    if (p < 0)
      world[i] = mmul(compose(axisAngle([0, 1, 0], pose.yaw), pose.root), compose(pose.rot[i], [0, 0, 0]))
    else world[i] = mmul(world[p], compose(pose.rot[i], add(s.offset[i], pose.shift[i])))
  }
  return world
}
const transpose3 = (m: number[]) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
const mul3 = (a: number[], b: number[]) => {
  const o = new Array(9)
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
  return o
}
/**
 * Analytic two-bone IK (law of cosines) on the chain a → b → c, so c lands on `target` (world), bending toward `pole`
 * (a world direction; knees forward, elbows back). `bend` is +1 when the joint's local +z faces the pole (legs) and −1
 * when it faces away (arms). Writes the local rotations of a and b; `end` (a world rotation) sets c's too.
 * `world` must be current for a's parent.
 */
export function twoBoneIK(
  s: Skeleton,
  pose: Pose,
  world: M[],
  a: number,
  b: number,
  c: number,
  target: V3,
  pole: V3,
  bend: 1 | -1,
  end?: number[],
) {
  const parent = world[PARENTS[a]]
  const pa = apply(parent, add(s.offset[a], pose.shift[a]))
  const l1 = length(add(s.offset[b], pose.shift[b])),
    l2 = length(add(s.offset[c], pose.shift[c]))
  const toTarget = sub(target, pa),
    d = clamp(length(toTarget), Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6)
  const dir = normalize(toTarget)
  let pn = sub(pole, scale(dir, dot(pole, dir)))
  if (length(pn) < 1e-6)
    pn = Math.abs(dir[1]) < 0.9 ? normalize(cross(dir, [0, 1, 0])) : normalize(cross(dir, [1, 0, 0]))
  pn = normalize(pn)
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1),
    sinA = Math.sqrt(1 - cosA * cosA)
  const pb = add(pa, scale(add(scale(dir, cosA), scale(pn, sinA)), l1))
  const pc = add(pa, scale(dir, d))
  const u = normalize(sub(pb, pa)),
    v = normalize(sub(pc, pb))
  const y1: V3 = scale(u, -1),
    z1 = normalize(sub(scale(pn, bend), scale(u, dot(scale(pn, bend), u)))),
    x1 = cross(y1, z1)
  const upper = basis(x1, y1, z1)
  const y2: V3 = scale(v, -1),
    z2 = cross(x1, y2),
    lower = basis(x1, y2, z2)
  pose.rot[a] = matq(mul3(transpose3(parent.slice(0, 9)), upper))
  pose.rot[b] = matq(mul3(transpose3(upper), lower))
  if (end) pose.rot[c] = matq(mul3(transpose3(lower), end))
}
/** A world rotation (row-major 3x3) from a quaternion, for IK end orientations. */
export const rot3 = (q: Q) => qmat(q)
export const worldRot = (m: M) => m.slice(0, 9)
export const mulRot = mul3
export { applyDir, position }
