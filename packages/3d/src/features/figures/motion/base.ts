// The base pose ("locomotion stays code"): the pelvis and torso (walk or stand, lean, breath, sway), the head
// (stabilise, tilt, turn lead, twitch), the arms (swing or hang) and the legs (foot paths, or a stand's feet, into IK),
// then the hems. Nothing here reads a hold; holds come after (hold.ts). Changed for AF: no action branches (reach, look
// and flinch become clips); no sprite cheats (`lookUp`, `view`, `pitch` and the walk-level neck correction that
// reads them), so the gait's chin lift is its attitude at full weight; the twitch is idle's, so the walk repeats exactly
// after one cycle (decision 10, F-c); the feet run along `moveDir` (decision 4, F-h).

import { dot, euler, hash, lerp3, type Q } from '../../../shared/math/math.ts'
import { fk, J, type Pose, restPose, type Skeleton } from '../body/rig.ts'
import type { Gait } from '../content/gait.schema.ts'
import type { Stand } from '../content/stand.schema.ts'
import { backWeight, sideSign, TAU, type Travel, travelPhase, wayOf } from './gait-path.ts'
import { placeHems } from './hems.ts'
import { BOB, legs } from './legs.ts'
import type { Evaluated, MotionState } from './motion-state.ts'

/** The most the hips turn either way over a stride (rad): with the chest's counter-turn the figure keeps its heading. */
const OCTANT = 0.1
/** Walking, the chin a touch down (rad), whatever the gait's lift. */
const NOD = 0.05
/** Walking, the forearm comes no further forward of plumb than FORE (rad), so the swing reads as an arm, not a
 * chop; and the wrist lets the hand hang back by WRIST of the forearm's angle, as a relaxed hand does. */
const FORE = 0.8
const WRIST = 0.45
/** Walking, the share of the arm's swing a bulky sleeve (one needing 0.4 rad of clearance) gives up, and the
 * share of its clearance an arm swung to either end of its swing gives back. */
const SWING_BULK = 0.3
const CLOSE = 0.55

/** How much of the gait's stance the relaxed stand leans into its weight leg: a quarter of what a posed contrapposto does. */
const RELAX = 0.4
/**
 * How far the neck slides back (m, times the figure's scale) in any stand, carrying the head over the shoulders as the
 * plumb line through the ear and the shoulder's tip has it. A slide, not a rotation: the neck's bottom ring sits below
 * its joint, so turning it back would swing that ring forward through the collar, where a slide swings nothing.
 */
const STAND_SLIDE = 0.03
/** How much the chest lifts (rad) in any stand, standing the back up; the head takes it back so the face stays level. */
const STAND_LIFT = 0.02

/**
 * The idle's stand from the gait: a plain, relaxed one. A trace of contrapposto (the hip a little out over the weight
 * leg and rolled up, the shoulder over it dropped against it), the free foot a quarter as far ahead as the gait sets
 * it, turned out a touch and flat, its heel down, the arms hanging.
 */
export const relaxed = (gait: Gait): Stand => ({
  weight: 'R',
  shift: gait.stance * RELAX,
  roll: gait.stance * 1.4 * RELAX,
  under: 0.25,
  free: [gait.stanceLead * 0.25, gait.stance ? 0.01 : 0, gait.stance ? 0.11 : 0, 0],
  chest: [gait.stance * 0.3 * RELAX, 0, 0],
})

/**
 * The body's sideways curve (the `bodyAsymmetry` slider) as rolls. `world` is the chest's roll in the world, which puts
 * the two shoulders 3 cm apart at the figure's scale at full strength (the left the lower for +1); the chest is rolled
 * 6 degrees against the spine, so the trunk curves rather than leans, and `local` is the chest's own share of it. Both
 * are exactly 0, and the pose is the straight one's, when there is none.
 */
export function sideBend(g: Skeleton['genes']): { world: number; local: number } {
  const b = g.sideBend
  if (!b) return { world: 0, local: 0 }
  const apart = (0.03 * (g.height / 1.62) * Math.abs(b)) / (2 * g.shoulders)
  return { world: -Math.asin(Math.min(1, apart)) * Math.sign(b), local: (-6 * Math.PI * b) / 180 }
}

/** Two poses blended: each joint's turn by a normalised lerp (the shorter way), its shift linearly. */
function blendPoses(a: Pose, b: Pose, u: number): Pose {
  const nlerp = (p: Q, q: Q): Q => {
    const sign = dot([p[0], p[1], p[2]], [q[0], q[1], q[2]]) + p[3] * q[3] < 0 ? -1 : 1
    const r: Q = [
      p[0] + (sign * q[0] - p[0]) * u,
      p[1] + (sign * q[1] - p[1]) * u,
      p[2] + (sign * q[2] - p[2]) * u,
      p[3] + (sign * q[3] - p[3]) * u,
    ]
    const l = Math.hypot(...r)
    return [r[0] / l, r[1] / l, r[2] / l, r[3] / l]
  }
  return {
    root: lerp3(a.root, b.root, u),
    yaw: a.yaw,
    rot: a.rot.map((q, i) => nlerp(q, b.rot[i] ?? q)),
    shift: a.shift.map((v, i) => lerp3(v, b.shift[i] ?? v, u)),
  }
}

/**
 * The base pose, everything but the holds. Nothing here reads a hold. Walking, `moveDir` picks the way the
 * cycle plays (gait-path.ts): forward of the back band the forward cycle, behind it the reversed one, and in
 * the band the two poses blended, so the pose is continuous all round the circle. In the
 * band a planted foot may slide a little: the blend is of the poses, not of the feet's contacts.
 */
export function base(s: Skeleton, gait: Gait, st: MotionState): Evaluated {
  const moveDir = st.moveDir ?? 0
  const w = st.moving ? backWeight(moveDir) : 0
  if (w <= 0) return baseOn(s, gait, st, wayOf(moveDir, false))
  if (w >= 1) return baseOn(s, gait, st, wayOf(moveDir, true))
  const pose = blendPoses(
    baseOn(s, gait, st, wayOf(moveDir, false)).pose,
    baseOn(s, gait, st, wayOf(moveDir, true)).pose,
    w,
  )
  return { pose, world: fk(s, pose) }
}

function baseOn(s: Skeleton, gait: Gait, st: MotionState, way: Travel): Evaluated {
  const g = s.genes
  const pose = restPose()
  const k = g.height / 1.62
  pose.yaw = st.yaw
  const walking = st.moving
  const shuffling = !walking && st.shuffle > 0
  const phase = walking ? travelPhase(st.phase, way) : shuffling ? st.shuffle : 0
  const cos1 = Math.cos(TAU * phase)
  const cos2 = Math.cos(2 * TAU * phase)
  // Standing (not mid-turn): a stand, the figure's own or the gait's relaxed one. `w` the side its weight is on.
  const stand = !walking && !shuffling ? (st.stand ?? relaxed(gait)) : null
  const w = stand ? sideSign(stand.weight) : 0
  // The walk's bob, and the share of it the neck takes up, held to the least a head must rise and fall to read (BOB).
  const bob = Math.max(gait.bob, BOB)
  const headLevel = Math.min(gait.headLevel, 1 - BOB / bob)
  // ─── Pelvis and torso ───
  let pelvisY = 0
  let pelvisX = 0
  let hipYaw = 0
  let hipRoll = 0
  let lean = 0
  let chestRoll = 0
  let chestYaw = 0
  let chestPitch = 0
  if (walking) {
    // The bob: lowest at each heel strike, highest over the stance; `spring` sharpens it into a bounce off the strike.
    pelvisY =
      -gait.crouch -
      bob * (1 - Math.abs(Math.sin(TAU * phase)) ** (2 * (1 - Math.min(0.9, gait.spring ?? 0))))
    pelvisX = gait.sway * Math.cos(TAU * (phase - gait.duty / 2))
    // The hips turn with the stride only so far; the step's weight goes through their roll, the bob and the
    // shoulders' roll.
    hipYaw = -Math.min(gait.hipYaw, OCTANT) * cos1
    hipRoll = gait.hipRoll * Math.cos(TAU * (phase - gait.duty / 2))
    lean = gait.lean
    // The shoulders roll against the hips, so the upper body carries the step rather than gliding over it.
    chestRoll = -hipRoll * (gait.shoulderRoll ?? 0)
  } else if (stand) {
    // Contrapposto: the hips over the weight leg, rolled up on its side, swaying slowly with the idle's weight shift.
    pelvisX = w * stand.shift * k + gait.shift * Math.sin((TAU * st.t) / gait.shiftPeriod)
    hipRoll = w * stand.roll
    hipYaw = stand.turn ?? 0
    // The chest against them: the shoulder over the weight leg drops, as the hip under it rises.
    chestRoll = -w * (stand.chest?.[0] ?? 0)
    chestYaw = stand.chest?.[1] ?? 0
    chestPitch = stand.chest?.[2] ?? 0
  } else {
    // A turn on the spot: the old idle's weight shift, and the shuffle's bob.
    pelvisX = gait.stance + gait.shift * Math.sin((TAU * st.t) / gait.shiftPeriod)
    hipRoll = -pelvisX * 1.2
    pelvisY = -0.012 * k * (0.5 + 0.5 * cos2)
  }
  const breath = walking ? 0 : gait.breath * Math.sin((TAU * st.t) / gait.breathPeriod)
  const { world: sideRoll, local: sideLocal } = sideBend(g)
  // Any stand stands the back up a touch; the head takes it back, below, so the face stays level.
  const chestLift = stand ? STAND_LIFT : 0
  pose.shift[J.pelvis] = [pelvisX, pelvisY, 0]
  pose.rot[J.pelvis] = euler(0, hipYaw, hipRoll)
  // The waist takes the hips' turn and roll back; the chest adds its own.
  pose.rot[J.spine] = euler(lean * 0.5 + g.posture * 0.3, -hipYaw, -hipRoll + sideRoll - sideLocal)
  pose.rot[J.chest] = euler(
    lean * 0.5 + g.posture * 0.7 - breath + chestPitch - chestLift,
    -hipYaw * gait.chestCounter + chestYaw,
    chestRoll + sideLocal,
  )
  // ─── Head ───
  // The neck takes back the chest's turn (walking, by the gait's stabilise; standing, all of it) and most of its
  // roll, so the head is set on the body, then turned by the stand.
  const counter = walking ? hipYaw * gait.chestCounter * gait.headStabilize : -chestYaw
  let headRoll = g.headTilt - chestRoll * 0.7 - sideRoll + (stand?.head?.[1] ?? 0)
  // Walking, the head sits level with the chin a touch down (NOD), the eyes on the way ahead; the gait's chin
  // lift is an attitude.
  const headPitch =
    g.headPitch -
    (lean + g.posture - chestLift) * 0.6 -
    (gait.chin ?? 0) +
    (walking ? NOD : 0) +
    (stand?.head?.[2] ?? 0)
  const headYaw = st.headYaw + (stand?.head?.[0] ?? 0)
  // A twitch now and then, standing: its slot's hash says which way (no Math.random).
  if (gait.twitch && !walking) {
    const slot = Math.floor(st.t / gait.twitchEvery)
    const within = st.t - slot * gait.twitchEvery
    if (within < 1 / gait.poseRate + 1e-9) headRoll += gait.twitch * (hash(slot) < 0.5 ? -1 : 1)
  }
  // A hunch sinks the head forward on the neck; the head turns back up by as much, so the face still looks ahead.
  pose.rot[J.neck] = euler(headPitch * 0.4 + 0.55 * g.hunch, counter + headYaw * 0.4, headRoll * 0.4)
  pose.rot[J.head] = euler(headPitch * 0.6 - 0.55 * g.hunch, headYaw * 0.6, headRoll * 0.6)
  // A head that rides level: the neck takes up the pelvis bob, all but the least that reads. Standing, it also
  // slides back over the shoulders (STAND_SLIDE).
  pose.shift[J.neck] = [0, -pelvisY * (walking ? headLevel : gait.headLevel), stand ? -STAND_SLIDE * k : 0]
  // The hair hangs from its pivots, swung by its spring; the sides swing less and splay with the roll.
  if (st.hair) {
    pose.rot[J['hair.back']] = euler(st.hair.pitch, 0, st.hair.roll)
    pose.rot[J['hair.L']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8)
    pose.rot[J['hair.R']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8)
  }
  // ─── Arms: swing opposite the legs, or hang ───
  for (const side of ['L', 'R'] as const) {
    // Walking, a bulky sleeve (one that must hang well out to clear the figure) swings less, as a padded coat's arm does.
    const clear = st.clear?.[side === 'L' ? 0 : 1] ?? 0
    const amp = gait.armSwing * (walking ? 1 - SWING_BULK * Math.min(1, clear / 0.4) : 1)
    const x = sideSign(side)
    const swing = walking ? x * amp * Math.cos(TAU * (phase - gait.armLag)) : 0
    const forward = Math.max(0, -swing)
    const idleSway = walking
      ? 0
      : 0.03 * Math.sin(TAU * (st.t / gait.breathPeriod) + (side === 'L' ? 0 : 1.3))
    // A hunch raises each shoulder and rounds it forward.
    pose.rot[J[`clavicle.${side}`]] = g.hunch
      ? euler(0, -x * 0.12 * g.hunch, x * (breath * 0.6 + 0.3 * g.hunch))
      : euler(0, 0, x * breath * 0.6)
    // A stand's own hang for this arm, else the idle's; a placed hand hangs here first and its hold moves it after.
    const own = stand?.hands?.[side]
    const hung = own && !('at' in own) ? own : null
    // Out from the body by the gait (or the stand's hang), and at least as far as clears the dressed figure:
    // walking, all of that only as the hand passes the hip mid-swing; swung forward or back it is clear of the
    // hip, and comes in by CLOSE of it at the swing's ends, so the arms never flare wide of the body.
    const ends = walking ? Math.abs(swing) / Math.max(1e-6, amp) : 0
    const hang = walking ? 0 : gait.hang + (hung?.swing ?? 0)
    const out = Math.max(
      walking ? gait.armOut : hung ? gait.armOut + hung.out : (gait.standOut ?? gait.armOut),
      clear * (1 - CLOSE * ends),
    )
    const bend = walking
      ? Math.min(
          gait.elbow + (gait.elbowSwing * forward) / Math.max(1e-6, amp),
          Math.max(gait.elbow, FORE - forward),
        )
      : hung
        ? hung.bend
        : gait.standElbow !== undefined
          ? gait.standElbow * (side === 'L' ? 1 : 0.75)
          : gait.elbow + gait.idleElbow * (side === 'L' ? 1 : 0.7)
    // `plumb` of the torso's bend taken back at the shoulder, so a stooped figure's arms hang down rather than
    // swing back with the chest; the chest's roll taken back too, so the arms hang plumb from shoulders that tilt.
    pose.rot[J[`upperArm.${side}`]] = euler(
      swing + idleSway * 0.5 - hang - (gait.plumb ?? 0) * (lean + g.posture),
      0,
      x * out - chestRoll - sideRoll,
    )
    pose.rot[J[`foreArm.${side}`]] = euler(-(bend + Math.abs(idleSway)), 0, 0)
    // The hand hangs from the wrist, back toward plumb by a share of the forearm's angle forward of it.
    pose.rot[J[`hand.${side}`]] = euler(WRIST * (bend - swing - idleSway * 0.5 + hang), 0, 0)
  }
  // ─── Legs: feet on their paths, or a stand's feet; IK from the hips ───
  legs(s, gait, st, pose, fk(s, pose), { stand, phase, headLevel, way })
  const world = fk(s, pose)
  // Walking, the hems hang between hip and ankle along the line of travel.
  placeHems(s, pose, world, walking ? [way.sin, way.cos] : undefined)
  return { pose, world: fk(s, pose) }
}
