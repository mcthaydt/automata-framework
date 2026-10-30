// The base pose (M3 spec §4.4.5 step 1, "locomotion stays code"): the pelvis and torso (walk or stand, lean,
// breath, sway), the head (stabilise, tilt, turn lead, twitch), the arms (swing or hang) and the legs (foot
// paths, or a stand's feet, into IK), then the hems. Nothing here reads a hold; holds come after (hold.ts).
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/motion.ts at a1f7246 (`base`,
// `relaxed`), its formulas and their order. Changed for AF: no action branches (reach, look and flinch become
// clips in M3.6); no sprite cheats (`lookUp`, `view`, `pitch` and the walk-level neck correction that reads
// them), so the gait's chin lift is its attitude at full weight (M3.5c decision 5); the twitch is idle's, so
// the walk repeats exactly after one cycle (decision 11, F-c); the feet run along `moveDir` (decision 4, F-h).

import type { Gait } from '../library/gait.schema'
import type { Stand } from '../library/stand.schema'
import { euler, hash } from '../math/math'
import { fk, J, restPose, type Skeleton } from '../rig/rig'
import { sideSign, TAU, travel, travelPhase } from './gait-path'
import { placeHems } from './hems'
import { BOB, legs } from './legs'
import type { Evaluated, MotionState } from './motion-state'

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

/** The idle's stand from the gait: the weight a little over the right leg, the left foot leading, the arms hanging. */
export const relaxed = (gait: Gait): Stand => ({
  weight: 'R',
  shift: gait.stance,
  roll: gait.stance * 1.4,
  under: 0.25,
  free: [gait.stanceLead, gait.stance ? 0.01 : 0, gait.stance ? 0.22 : 0, gait.stance ? 0.08 : 0],
  chest: [gait.stance * 1.2, 0, 0],
})

/** The base pose, everything but the holds. Nothing here reads a hold. */
export function base(s: Skeleton, gait: Gait, st: MotionState): Evaluated {
  const g = s.genes
  const pose = restPose()
  const k = g.height / 1.62
  pose.yaw = st.yaw
  const walking = st.moving
  const shuffling = !walking && st.shuffle > 0
  const way = travel(st.moveDir ?? 0)
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
  pose.shift[J.pelvis] = [pelvisX, pelvisY, 0]
  pose.rot[J.pelvis] = euler(0, hipYaw, hipRoll)
  // The waist takes the hips' turn and roll back; the chest adds its own.
  pose.rot[J.spine] = euler(lean * 0.5 + g.posture * 0.3, -hipYaw, -hipRoll)
  pose.rot[J.chest] = euler(
    lean * 0.5 + g.posture * 0.7 - breath + chestPitch,
    -hipYaw * gait.chestCounter + chestYaw,
    chestRoll,
  )
  // ─── Head ───
  // The neck takes back the chest's turn (walking, by the gait's stabilise; standing, all of it) and most of its
  // roll, so the head is set on the body, then turned by the stand.
  const counter = walking ? hipYaw * gait.chestCounter * gait.headStabilize : -chestYaw
  let headRoll = g.headTilt - chestRoll * 0.7 + (stand?.head?.[1] ?? 0)
  // Walking, the head sits level with the chin a touch down (NOD), the eyes on the way ahead; the gait's chin
  // lift is an attitude.
  const headPitch =
    g.headPitch - (lean + g.posture) * 0.6 - (gait.chin ?? 0) + (walking ? NOD : 0) + (stand?.head?.[2] ?? 0)
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
  // A head that rides level: the neck takes up the pelvis bob, all but the least that reads.
  pose.shift[J.neck] = [0, -pelvisY * (walking ? headLevel : gait.headLevel), 0]
  // The hair hangs from its pivots, swung by its spring; the sides swing less and splay with the roll.
  if (st.hair) {
    pose.rot[J['hair.back']] = euler(st.hair.pitch, 0, st.hair.roll)
    pose.rot[J['hair.L']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8)
    pose.rot[J['hair.R']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8)
  }
  // ─── Arms: swing opposite the legs, or hang ───
  for (const side of ['L', 'R'] as const) {
    // Walking, a bulky sleeve (one that must hang well out to clear the figure) swings less, as a puffer's arm does.
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
      gait.armOut + (walking ? 0 : hung ? hung.out : (gait.standOut ?? 0)),
      clear * (1 - CLOSE * ends),
    )
    const bend = walking
      ? Math.min(
          gait.elbow + (gait.elbowSwing * forward) / Math.max(1e-6, amp),
          Math.max(gait.elbow, FORE - forward),
        )
      : hung
        ? hung.bend
        : gait.elbow + gait.idleElbow * (side === 'L' ? 1 : 0.7)
    // `plumb` of the torso's bend taken back at the shoulder, so a stooped figure's arms hang down rather than
    // swing back with the chest; the chest's roll taken back too, so the arms hang plumb from shoulders that tilt.
    pose.rot[J[`upperArm.${side}`]] = euler(
      swing + idleSway * 0.5 - hang - (gait.plumb ?? 0) * (lean + g.posture),
      0,
      x * out - chestRoll,
    )
    pose.rot[J[`foreArm.${side}`]] = euler(-(bend + Math.abs(idleSway)), 0, 0)
    // The hand hangs from the wrist, back toward plumb by a share of the forearm's angle forward of it.
    pose.rot[J[`hand.${side}`]] = euler(WRIST * (bend - swing - idleSway * 0.5 + hang), 0, 0)
  }
  // ─── Legs: feet on their paths, or a stand's feet; IK from the hips ───
  legs(s, gait, st, pose, fk(s, pose), { stand, phase, headLevel })
  const world = fk(s, pose)
  placeHems(s, pose, world)
  return { pose, world: fk(s, pose) }
}
