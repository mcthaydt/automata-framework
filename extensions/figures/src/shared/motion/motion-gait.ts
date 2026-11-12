// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 24 of the builders-fold plan (the strict flags) replaces each with a check
import {
  clonePose,
  fk,
  type Genes,
  J,
  type Pose,
  restPose,
  type Side,
  type Skeleton,
  twoBoneIK,
} from '../body/rig'
import {
  apply,
  applyDir,
  basis,
  compose,
  cross,
  dot,
  euler,
  hash,
  IDENTITY_Q,
  invertRigid,
  lerp,
  lerp3,
  type M,
  matq,
  mmul,
  normalize,
  position,
  qmat,
  qmul,
  scale,
  smooth,
  sub,
  TAU,
  type V3,
} from '../math/math'
import {
  BOB,
  CLOSE,
  FORE,
  footPath,
  NOD,
  OCTANT,
  reachEnvelope,
  relaxed,
  SOFT,
  STAND_LIFT,
  STAND_SLIDE,
  SWING_BULK,
  sideSign,
  WRIST,
} from './motion-stand'
import type { Evaluated, Gait, Hold, MotionState } from './motion-types'
/** The base pose, everything but the holds. Nothing here reads a hold. */
export function base(s: Skeleton, gait: Gait, st: MotionState): Evaluated {
  const g = s.genes,
    pose = restPose(),
    k = g.height / 1.62
  pose.yaw = st.yaw
  const walking = st.moving,
    shuffling = !walking && st.shuffle > 0
  const phase = walking ? st.phase : shuffling ? st.shuffle : 0
  const cos1 = Math.cos(TAU * phase),
    cos2 = Math.cos(2 * TAU * phase)
  // Standing (not mid-turn): a stand, the figure's own or the gait's relaxed one. `w` the side its weight is on.
  const stand = !walking && !shuffling ? (st.stand ?? relaxed(gait)) : null,
    w = stand ? sideSign(stand.weight) : 0
  // The walk's bob, and the share of it the neck takes up, held to the least a head must rise and fall to read (BOB).
  const bob = Math.max(gait.bob, BOB),
    headLevel = Math.min(gait.headLevel, 1 - BOB / bob)
  // ─── Pelvis and torso ───
  let pelvisY = 0,
    pelvisX = 0,
    hipYaw = 0,
    hipRoll = 0,
    lean = 0,
    chestRoll = 0,
    chestYaw = 0,
    chestPitch = 0
  const chestLift = stand ? STAND_LIFT : 0
  if (walking) {
    // The bob: lowest at each heel strike, highest over the stance; `spring` sharpens it into a bounce off the strike.
    pelvisY =
      -gait.crouch -
      bob * (1 - Math.abs(Math.sin(TAU * phase)) ** (2 * (1 - Math.min(0.9, gait.spring ?? 0))))
    pelvisX = gait.sway * Math.cos(TAU * (phase - gait.duty / 2))
    // The hips turn with the stride only so far that the figure keeps to its view's octant; the step's weight goes
    // through their roll, the bob and the shoulders' roll.
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
  pose.shift[J.pelvis] = [pelvisX, pelvisY, 0]
  pose.rot[J.pelvis] = euler(0, hipYaw, hipRoll)
  // The waist takes the hips' turn and roll back; the chest adds its own.
  pose.rot[J.spine] = euler(lean * 0.5 + g.posture * 0.3, -hipYaw, -hipRoll + sideRoll - sideLocal)
  pose.rot[J.chest] = euler(
    lean * 0.5 + g.posture * 0.7 - breath + chestPitch - chestLift,
    -hipYaw * gait.chestCounter + chestYaw,
    chestRoll + sideLocal,
  )
  // Reach: the torso leans in a little toward the hand.
  const reaching = st.action?.id === 'reach' ? reachEnvelope(st.action.t, gait.reach) : 0
  if (reaching)
    pose.rot[J.chest] = qmul(
      pose.rot[J.chest],
      euler(0.12 * reaching, sideSign(st.action!.side) * -0.12 * reaching, 0),
    )
  // Flinch: the chest recoils, the hips go back.
  const flinch = st.action?.id === 'flinch' ? smooth(Math.min(1, st.action.t / 0.18)) : 0
  if (flinch) {
    pose.rot[J.chest] = qmul(pose.rot[J.chest], euler(-0.14 * flinch, 0.12 * flinch, 0))
    pose.shift[J.pelvis][2] -= 0.04 * k * flinch
  }
  // ─── Head ───
  // The neck takes back the chest's turn (walking, by the gait's stabilise; standing, all of it) and most of its roll,
  // so the head is set on the body, then turned by the stand.
  const counter = walking ? hipYaw * gait.chestCounter * gait.headStabilize : -chestYaw
  let headRoll = g.headTilt - chestRoll * 0.7 - sideRoll + (stand?.head?.[1] ?? 0)
  // The face's turn to the camera (1 facing it, 0.7 in three-quarter, 0 in profile and from behind): the sprite cheat's tip
  // back and the gait's chin lift take only that share, so no profile or back is tipped chin-up. Walking, the head sits
  // level with the chin a touch down (NOD), the eyes on the way ahead.
  const toward = Math.max(0, Math.cos(st.view ?? st.yaw))
  const headPitch =
    g.headPitch -
    (lean + g.posture - chestLift) * 0.6 -
    ((st.lookUp ?? 0) + (gait.chin ?? 0)) * toward +
    0.32 * flinch +
    (walking ? NOD : 0) +
    (stand?.head?.[2] ?? 0)
  const headYaw = st.headYaw + 0.3 * flinch + (stand?.head?.[0] ?? 0)
  // A twitch: for one pose step in each `twitchEvery` seconds the head rolls to a side the slot picks, so a nervous
  // gait ticks.
  if (gait.twitch) {
    const slot = Math.floor(st.t / gait.twitchEvery!),
      within = st.t - slot * gait.twitchEvery!
    if (within < 1 / gait.poseRate + 1e-9) headRoll += gait.twitch * (hash(slot) < 0.5 ? -1 : 1)
  }
  // A hunch sinks the head forward on the neck; the head turns back up by as much, so the face still looks ahead.
  pose.rot[J.neck] = euler(headPitch * 0.4 + 0.55 * g.hunch, counter + headYaw * 0.4, headRoll * 0.4)
  pose.rot[J.head] = euler(headPitch * 0.6 - 0.55 * g.hunch, headYaw * 0.6, headRoll * 0.6)
  // A head that rides level: the neck takes up the pelvis bob, all but the least that reads.
  pose.shift[J.neck] = [0, -pelvisY * (walking ? headLevel : gait.headLevel), stand ? -STAND_SLIDE * k : 0]
  // The hair hangs from its pivots, swung by its spring; the sides swing less and splay with the roll.
  if (st.hair) {
    pose.rot[J['hair.back']] = euler(st.hair.pitch, 0, st.hair.roll)
    pose.rot[J['hair.L']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8)
    pose.rot[J['hair.R']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8)
  }
  // ─── Arms: swing opposite the legs, or hang ───
  for (const side of ['L', 'R'] as const) {
    // Walking, a bulky sleeve (one that must hang well out to clear the figure) swings less, as a puffer's arm does.
    const clear = st.clear?.[side === 'L' ? 0 : 1] ?? 0,
      amp = gait.armSwing * (walking ? 1 - SWING_BULK * Math.min(1, clear / 0.4) : 1)
    const x = sideSign(side),
      swing = walking ? x * amp * Math.cos(TAU * (phase - gait.armLag)) : 0
    const forward = Math.max(0, -swing)
    const idleSway = walking
      ? 0
      : 0.03 * Math.sin(TAU * (st.t / gait.breathPeriod) + (side === 'L' ? 0 : 1.3))
    // A hunch raises each shoulder and rounds it forward.
    pose.rot[J[`clavicle.${side}`]] = g.hunch
      ? euler(0, -x * 0.12 * g.hunch, x * (breath * 0.6 + 0.3 * g.hunch))
      : euler(0, 0, x * breath * 0.6)
    // A stand's own hang for this arm, else the idle's; a placed hand hangs here first and its hold moves it after.
    const own = stand?.hands?.[side],
      hung = own && !('at' in own) ? own : null
    // Out from the body by the gait (or the stand's hang), and at least as far as clears the dressed figure: walking, all
    // of that only as the hand passes the hip mid-swing; swung forward or back it is clear of the hip, and comes in by
    // CLOSE of it at the swing's ends, so the arms never flare wide of the body in the three-quarter views.
    const ends = walking ? Math.abs(swing) / Math.max(1e-6, amp) : 0
    // Standing at ease the arms hang close, from the shoulder nearly plumb, the elbows only soft (the stand's own bend,
    // not the walk's carried one): a bent, flared arm at rest reads as a gunslinger's.
    const hang = walking ? 0 : gait.hang + (hung?.swing ?? 0),
      out = Math.max(
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
    // `plumb` of the torso's bend taken back at the shoulder, so a stooped figure's arms hang down rather than swing back
    // with the chest; the chest's roll taken back too, so the arms hang plumb from shoulders that tilt.
    pose.rot[J[`upperArm.${side}`]] = euler(
      swing + idleSway * 0.5 - hang - (gait.plumb ?? 0) * (lean + g.posture),
      0,
      x * out - chestRoll - sideRoll,
    )
    pose.rot[J[`foreArm.${side}`]] = euler(-(bend + Math.abs(idleSway)), 0, 0)
    // The hand hangs from the wrist, back toward plumb by a share of the forearm's angle forward of it.
    pose.rot[J[`hand.${side}`]] = euler(WRIST * (bend - swing - idleSway * 0.5 + hang), 0, 0)
  }
  let world = fk(s, pose)
  // ─── Legs: feet on their paths, or a stand's feet; IK from the hips ───
  const rootM = world[J.root]
  const forwardWorld = applyDir(rootM, [0, 0, 1])
  if (stand) {
    // The weight leg runs straight from its hip to its foot, drawn in under the body: the hips sink as far as that needs.
    const hipW = position(world[J[`thigh.${stand.weight}`]]),
      foot = apply(rootM, [w * g.hips * (1 - (stand.under ?? 0.25)), g.ankle, 0])
    const L = (s.thigh + s.shin) * 0.9995,
      dx = hipW[0] - foot[0],
      dz = hipW[2] - foot[2]
    pose.shift[J.pelvis][1] -= hipW[1] - foot[1] - Math.sqrt(Math.max(0, L * L - dx * dx - dz * dz))
    world = fk(s, pose)
  }
  const stride = (walking ? gait.stride * (st.stride ?? 1) : shuffling ? 0.12 : 0) * k,
    lift = (walking ? gait.lift : shuffling ? 0.035 : 0) * k
  // Stepping in place (a stride of none) still lifts the feet on their paths; a heading turns the paths off the facing.
  const march = walking && st.stride === 0,
    heading = walking ? (st.heading ?? 0) : 0
  // The feet: a stand's, or each on its path (root space). `pitch` toes down; `planted` on the floor mid-walk.
  const L = (s.thigh + s.shin) * 0.996,
    heelReach = 0.2 * g.foot,
    toeReach = 0.62 * g.foot
  const feet = (['L', 'R'] as const).map((side) => {
    const x = sideSign(side)
    if (stand) {
      // The weight foot under the body, the free one forward and out, its toes turned out and its heel a little up, so
      // its knee comes soft.
      const free = x !== w,
        [fwd, out, splay = 0, heel = 0] = stand.free,
        under = stand.under ?? 0.25
      const up = free ? Math.max(0, Math.sin(heel)) * toeReach : 0
      const at: V3 = free
        ? [x * (g.hips * (1 - under) + out * k), g.ankle + up, fwd * k]
        : [x * g.hips * (1 - under), g.ankle, 0]
      return {
        side,
        at,
        pitch: free ? heel : 0,
        turn: x * (free ? splay : (stand.splay ?? 0.1)),
        planted: false,
      }
    }
    // A flinch takes the far foot half a step back. Walking, the feet fall toward one line under the body (`track`);
    // standing, they keep under the hips.
    const [z, y, pitch, planted]: [number, number, number, boolean] =
      stride || march
        ? footPath(phase + (side === 'L' ? 0 : 0.5), gait, stride, lift)
        : [side === 'R' ? -0.13 * k * flinch : 0, 0, 0, false]
    // A strafe sets the feet wider (as far as its sideways share), so they pass beside each other and never cross.
    const at: V3 = heading
      ? [
          x * g.hips * Math.max(gait.track, 0.9 * Math.abs(Math.sin(heading))) + Math.sin(heading) * z,
          g.ankle + y,
          Math.cos(heading) * z,
        ]
      : [
          x * g.hips * (walking ? gait.track : (gait.standTrack ?? Math.max(gait.track, 0.75))),
          g.ankle + y,
          z,
        ]
    return { side, at, pitch, turn: 0, planted: planted && walking }
  })
  // On its heel the ankle rides up the heel's reach (and on its toes, the toes'), so the foot pivots on the floor.
  const pivot = (pitch: number) =>
    Math.max(0, Math.sin(pitch)) * toeReach + Math.max(0, -Math.sin(pitch)) * heelReach
  // This side's hip (root space), and how high it stands over an ankle at `at` raised `up` with the leg straight.
  const toRoot = invertRigid(rootM),
    hipOf = (side: Side) => apply(toRoot, position(world[J[`thigh.${side}`]]))
  const tall = (side: Side, at: V3, up: number) => {
    const hip = hipOf(side)
    return at[1] + up + Math.sqrt(Math.max(0, L * L - (hip[0] - at[0]) ** 2 - (hip[2] - at[2]) ** 2)) - hip[1]
  }
  if ((stride || march) && walking) {
    // The hips ride on the planted legs: no higher than lets every planted foot reach the floor (a pushing one flat),
    // and, over a heel just struck ahead, no lower than its knee's softest (SOFT), so the strike reads as a step and
    // not a lunge. But with both feet down they dip at least BOB (and what the neck takes up) under their height
    // mid-stance, so no walk glides: that height the stance leg's, straight from a hip the roll lifts to a foot drawn
    // in toward the line (`track`).
    const planted = feet.filter((f) => f.planted),
      soft = SOFT * k
    const room = Math.min(
      Infinity,
      ...planted.map((f) => tall(f.side, f.at, f.pitch > 0 ? 0 : pivot(f.pitch))),
    )
    const want = Math.max(
      0,
      ...planted
        .filter((f) => f.pitch <= 0 && f.at[2] > hipOf(f.side)[2])
        .map((f) => tall(f.side, f.at, pivot(f.pitch)) - soft),
    )
    const top = -Math.max(
      gait.crouch,
      (g.hips * (1 - gait.track) + gait.sway) ** 2 / (2 * L) + g.hips * Math.sin(gait.hipRoll) + 0.004 * L,
    )
    const dip = top - (1.1 * BOB) / (1 - headLevel)
    let dy = Number.isFinite(room) ? Math.min(room, want) : 0
    if (planted.length > 1) dy = Math.min(dy, dip - pose.shift[J.pelvis][1])
    if (dy) {
      pose.shift[J.pelvis][1] += dy
      pose.shift[J.neck][1] -= dy * (walking ? headLevel : 0)
      world = fk(s, pose)
    }
    // A foot pushing off lifts its heel only so far as its leg still reaches straight: the trailing knee stays long.
    for (const f of feet)
      if (f.planted && f.pitch > 0)
        f.pitch = Math.min(f.pitch, Math.asin(Math.min(1, Math.max(0, tall(f.side, f.at, 0)) / toeReach)))
  }
  for (const f of feet) {
    const ankle = apply(rootM, [f.at[0], f.at[1] + (stand ? 0 : pivot(f.pitch)), f.at[2]])
    // Feet point where the body does (a stand's turned out), pitched by their roll.
    const footTurn = qmat(qmul(euler(0, st.yaw + f.turn, 0), euler(f.pitch, 0, 0)))
    twoBoneIK(
      s,
      pose,
      world,
      J[`thigh.${f.side}`],
      J[`shin.${f.side}`],
      J[`foot.${f.side}`],
      ankle,
      forwardWorld,
      1,
      footTurn,
    )
  }
  world = fk(s, pose)
  // ─── Action: the reach, an arm IK target ───
  if (reaching && st.action) {
    const side = st.action.side,
      x = sideSign(side)
    const rest = apply(world[J[`hand.${side}`]], [0, 0, 0])
    const target = apply(rootM, [x * g.shoulders * 0.8, s.shoulderY - 0.18 * k, 0.5 * k])
    const hand = lerp3(rest, target, reaching)
    const pole = applyDir(rootM, [x * 0.7, -0.5, -0.5])
    twoBoneIK(s, pose, world, J[`upperArm.${side}`], J[`foreArm.${side}`], J[`hand.${side}`], hand, pole, -1)
    world = fk(s, pose)
  }
  // ─── Action: the flinch, both hands up before the face, elbows down and out ───
  if (flinch) {
    for (const side of ['L', 'R'] as const) {
      const x = sideSign(side),
        rest = apply(world[J[`hand.${side}`]], [0, 0, 0])
      const target = apply(rootM, [x * 0.06 * k, s.chinY + 0.1 * k, 0.21 * k])
      twoBoneIK(
        s,
        pose,
        world,
        J[`upperArm.${side}`],
        J[`foreArm.${side}`],
        J[`hand.${side}`],
        lerp3(rest, target, flinch),
        applyDir(rootM, [x * 0.5, -1, 0.1]),
        -1,
      )
      world = fk(s, pose)
    }
  }
  // ─── The walk's level: the sway across the body has depth in a turned view, which the camera's pitch shows as height,
  // so one step would ride a texel lower than the other (a limp). The neck takes that back, so both steps match ───
  if (walking && st.pitch) {
    const x = apply(invertRigid(rootM), position(world[J.head]))[0]
    pose.shift[J.neck][1] -= x * Math.sin(st.view ?? st.yaw) * Math.tan(st.pitch)
    world = fk(s, pose)
  }
  placeHems(s, pose, world)
  return { pose, world: fk(s, pose) }
}
/** A planted foot ahead of its hip has its hem hang PLANT of the way from the plumb under the hip to the ankle, fore and
 * aft (across, it keeps to the ankle), so the toe steps out from under the cloth; a foot BEHIND (m at k 1) its hip, or
 * lifted LIFT off the floor, has it follow the ankle all the way, so the heel peels up inside the hem. */
const PLANT = 0.5,
  LIFT = 0.03,
  BEHIND = 0.06
/**
 * The hems (rig.ts J.hemL, J.hemR): each upright on the floor between its ankle and the plumb under its hip while the
 * foot is planted, riding up with the ankle as the heel peels off and following it through the swing, so a wide hem
 * always covers its shoe's collar and never tips with the shin. Written as each joint's turn and shift on its shin.
 */
export function placeHems(s: Skeleton, pose: Pose, world: M[], seated = false) {
  const g = s.genes,
    k = g.height / 1.62,
    rootM = world[J.root],
    toRoot = invertRigid(rootM)
  for (const side of ['L', 'R'] as const) {
    const hem = J[`hem${side}`],
      ankle = apply(toRoot, position(world[J[`foot.${side}`]])),
      hip = apply(toRoot, position(world[J[`thigh.${side}`]]))
    // Seated, the hem rides the ankle: the knee is forward and up, nowhere near plumb over it.
    const lift = Math.max(0, ankle[1] - g.ankle),
      follow = seated
        ? 1
        : lerp(PLANT, 1, Math.max(smooth(lift / (LIFT * k)), smooth((hip[2] - ankle[2]) / (BEHIND * k))))
    const local = mmul(
      invertRigid(world[J[`shin.${side}`]]),
      mmul(rootM, compose(IDENTITY_Q, [ankle[0], g.ankle + lift, lerp(hip[2], ankle[2], follow)])),
    )
    pose.rot[hem] = matq(local.slice(0, 9))
    pose.shift[hem] = sub(position(local), s.offset[hem])
  }
}
/** The hand's world turn for a hold in a joint's space `space`: its euler turn, or its aim (fingers along the hand's −y,
 * the palm on its inner side: −x for the left hand, +x for the right). */
function handTurn(space: M, hold: Hold): number[] {
  const r = space.slice(0, 9)
  if (!hold.aim) return qmat(qmul(matq(r), matq(qmat(euler(...hold.turn)))))
  const y = scale(normalize(hold.aim[0]), -1),
    palm = normalize(hold.aim[1]),
    x0 = scale(palm, hold.side === 'L' ? -1 : 1)
  const x = normalize(sub(x0, scale(y, dot(x0, y)))),
    z = cross(x, y),
    b = basis(x, y, z)
  const o = new Array(9)
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      o[i * 3 + j] = r[i * 3] * b[j] + r[i * 3 + 1] * b[3 + j] + r[i * 3 + 2] * b[6 + j]
  return o
}
/** A hold: rewrites only its side's upper arm, forearm and hand the hand in its joint's space (the chest's). Exported so
 * a fork's code can lay a hold over any evaluated pose, a seat's included (`seated` places its hands this way). */
export function applyHold(s: Skeleton, evaluated: Evaluated, hold: Hold): Evaluated {
  const pose = clonePose(evaluated.pose)
  const space = evaluated.world[hold.in ?? J.chest]
  const target = apply(space, hold.hand)
  twoBoneIK(
    s,
    pose,
    evaluated.world,
    J[`upperArm.${hold.side}`],
    J[`foreArm.${hold.side}`],
    J[`hand.${hold.side}`],
    target,
    applyDir(space, hold.pole),
    -1,
    handTurn(space, hold),
  )
  // A full FK again: the other joints come out equal because nothing upstream of them changed (the test checks it).
  return { pose, world: fk(s, pose) }
}
/**
 * The body's sideways curve (genes.ts bodyAsymmetry) as rolls: the chest's roll in the world puts the two shoulders
 * 3 cm apart in height at 1 (the left the lower for +1), and the chest is rolled 6° against the spine, so the trunk curves
 * rather than leans. `world` is the chest's roll (and the spine's with it), `local` the chest's own share of it; each is
 * exactly 0 (and the pose is today's) when there is none.
 */
export function sideBend(g: Genes): { world: number; local: number } {
  const b = g.sideBend
  if (!b) return { world: 0, local: 0 }
  return {
    world:
      -Math.asin(Math.min(1, (0.03 * (g.height / 1.62) * Math.abs(b)) / (2 * g.shoulders))) * Math.sign(b),
    local: ((-6 * Math.PI) / 180) * b,
  }
}
