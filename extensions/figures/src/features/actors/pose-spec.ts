import { J, clonePose, fk, restPose, twoBoneIK, type Pose, type Side, type Skeleton } from '../body/rig';
import { placeHems, type Evaluated } from '../motion/motion';
import { add, apply, applyDir, euler, lerp, normalize, position, qmat, qmul, scale, sub, type M, type Q, type V3 } from '../../lib/math';
/**
 * The pose spec: a small set of numbers that says what a body does, turned into a Pose on any skeleton by IK. The
 * actions (actions.ts) are made of these, keyed over time.
 *
 * A spec is written for the acting side: `A` is the arm that acts (the waving hand, the striking one), `B` the other,
 * and +x is toward A's side. A spec for the right hand is its mirror image (`mirror`), so one spec serves both hands.
 *
 * Lengths scale with the body: shifts in metres at k 1 (k = height / 1.62), feet in leg lengths (the hip's height),
 * `hip` as a share of the standing hip's height. So a spec fits any body the sliders make.
 */
export interface ArmSpec {
  /** How much this spec drives the arm (0 the base pose's arm, 1 this). Interpolated, so an arm eases in and out. */
  w?: number;
  /** The hand's direction from the shoulder (root space, +x toward A's side), and how far along it (0–1 of the arm). */
  d?: V3; r?: number;
  /** Where the elbow points (root space). */
  pole?: V3;
  /** The hand goes to the action's target (a point, another actor), or to the meeting point between two actors. */
  to?: 'target' | 'meet';
  /** Raised (m at k 1) from where it would be: a handshake's pump. */
  bob?: number;
}
export interface FootSpec {
  /** Offset from its standing place, in leg lengths (x out, y up, z forward); its turn out and toe pitch (rad). */
  at?: V3; turn?: number; pitch?: number;
}
export interface Spec {
  /** Pelvis shift (m at k 1) and turn (pitch forward, yaw toward A, roll). */
  pel?: V3; pelR?: V3;
  /** The hips' height as a share of standing (a sit's, a kneel's, a lie's); left out, standing. */
  hip?: number;
  /** How far (0–1) the hips go from `hip` to sitting on the seat (the action's seat height, else the knee's). */
  seat?: number;
  /** Chest and head turns (pitch forward/down, yaw toward A, roll toward B's shoulder). */
  chest?: V3; head?: V3;
  /** The shoulders raised (rad): a shrug. */
  sh?: number;
  /** The head and chest turn toward the target, by this share (0–1). */
  face?: number;
  A?: ArmSpec; B?: ArmSpec;
  /** Full-body specs: each foot (A's side and B's), and the stance (hip widths). */
  fA?: FootSpec; fB?: FootSpec; stance?: number;
}
/** Every number a spec can hold, filled: what interpolation and the IK read. */
export interface Filled {
  pel: V3; pelR: V3; hip: number; seat: number; chest: V3; head: V3; sh: number; face: number;
  A: Required<Omit<ArmSpec, 'to'>> & { to?: ArmSpec['to'] }; B: Required<Omit<ArmSpec, 'to'>> & { to?: ArmSpec['to'] };
  fA: Required<FootSpec>; fB: Required<FootSpec>; stance: number;
}
/** A hanging arm (A's side +x), and the defaults. */
const HANG_A: V3 = [0.16, -1, 0.05], HANG_B: V3 = [-0.16, -1, 0.05];
export function fill(s: Spec): Filled {
  const arm = (a: ArmSpec | undefined, hang: V3) => ({ w: a ? a.w ?? 1 : 0, d: a?.d ?? hang, r: a?.r ?? 0.96, pole: a?.pole ?? [Math.sign(hang[0]) * 0.3, -0.3, -1] as V3, bob: a?.bob ?? 0, to: a?.to });
  const foot = (f: FootSpec | undefined) => ({ at: f?.at ?? [0, 0, 0] as V3, turn: f?.turn ?? 0, pitch: f?.pitch ?? 0 });
  return {
    pel: s.pel ?? [0, 0, 0], pelR: s.pelR ?? [0, 0, 0], hip: s.hip ?? 1, seat: s.seat ?? 0, chest: s.chest ?? [0, 0, 0], head: s.head ?? [0, 0, 0], sh: s.sh ?? 0, face: s.face ?? 0,
    A: arm(s.A, HANG_A), B: arm(s.B, HANG_B), fA: foot(s.fA), fB: foot(s.fB), stance: s.stance ?? 1.15,
  };
}
const lerpV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
/** Two filled specs mixed (`k` of the way to b). */
export function mix(a: Filled, b: Filled, k: number): Filled {
  const arm = (p: Filled['A'], q: Filled['A']) => ({ w: lerp(p.w, q.w, k), d: lerpV(p.d, q.d, k), r: lerp(p.r, q.r, k), pole: lerpV(p.pole, q.pole, k), bob: lerp(p.bob, q.bob, k), to: k < 0.5 ? p.to ?? q.to : q.to ?? p.to });
  const foot = (p: Filled['fA'], q: Filled['fA']) => ({ at: lerpV(p.at, q.at, k), turn: lerp(p.turn, q.turn, k), pitch: lerp(p.pitch, q.pitch, k) });
  return {
    pel: lerpV(a.pel, b.pel, k), pelR: lerpV(a.pelR, b.pelR, k), hip: lerp(a.hip, b.hip, k), seat: lerp(a.seat, b.seat, k), chest: lerpV(a.chest, b.chest, k), head: lerpV(a.head, b.head, k),
    sh: lerp(a.sh, b.sh, k), face: lerp(a.face, b.face, k), A: arm(a.A, b.A), B: arm(a.B, b.B), fA: foot(a.fA, b.fA), fB: foot(a.fB, b.fB), stance: lerp(a.stance, b.stance, k),
  };
}
/** Root-space x, yaw and roll flipped: a spec written for A on the left, played by the right. */
const flip = (v: V3): V3 => [-v[0], v[1], v[2]], turn = (v: V3): V3 => [v[0], -v[1], -v[2]];
/** The side's own frame: the spec as it reads on the figure (A on `side`). */
function onSide(f: Filled, side: Side): Filled {
  if (side === 'L') return f;
  const arm = (a: Filled['A']) => ({ ...a, d: flip(a.d), pole: flip(a.pole) }), foot = (p: Filled['fA']) => ({ at: p.at, turn: p.turn, pitch: p.pitch });
  return { ...f, pel: flip(f.pel), pelR: turn(f.pelR), chest: turn(f.chest), head: turn(f.head), A: arm(f.A), B: arm(f.B), fA: foot(f.fA), fB: foot(f.fB) };
}
/** A target's yaw (+ toward the figure's left) and pitch (+ down) from a point of the body, root space. */
export function aim(from: V3, to: V3): [yaw: number, pitch: number] {
  const v = sub(to, from);
  return [Math.atan2(v[0], v[2]), -Math.atan2(v[1], Math.hypot(v[0], v[2]))];
}
/** Where the eyes are, at rest (root space). */
export const eyesOf = (s: Skeleton): V3 => [0, s.chinY + s.genes.head * 0.45, 0.05 * s.genes.height / 1.62];
/** What a spec aims at, in root space: the action's target, and the point two actors meet at (between them). */
export interface Aims { target?: V3 | null; meet?: V3 | null; seat?: number | null }
/** The hips' height (share of standing) a spec asks for: its own, or toward sitting on the seat (the knee's height if
 * none is given), the hip joint a thigh's round above it. */
function hipOf(s: Skeleton, f: Filled, aims: Aims) {
  if (!f.seat) return f.hip;
  const k = s.genes.height / 1.62, seat = aims.seat ?? (s.hipY - s.thigh) * 0.95;
  return lerp(f.hip, (seat + 0.075 * k) / s.hipY, f.seat);
}
/** The hand's place for an arm spec: its direction from the shoulder, or the target it goes to (as far as it reaches). */
function handAt(s: Skeleton, shoulder: V3, a: Filled['A'], rootM: M, aims: Aims): V3 {
  const len = s.upperArm + s.foreArm, goal = a.to === 'meet' ? aims.meet : a.to === 'target' ? aims.target : null, up: V3 = [0, a.bob * s.genes.height / 1.62, 0];
  if (goal) {
    const g = apply(rootM, goal), v = sub(g, shoulder), d = Math.hypot(...v);
    // A point: the arm straight along the line to the target. A meeting place: the hand there, if it reaches.
    return add(a.to === 'meet' ? add(shoulder, scale(v, Math.min(1, (len * 0.97) / d))) : add(shoulder, scale(v, (len * a.r) / d)), up);
  }
  const dir = normalize(applyDir(rootM, a.d));
  return add(add(shoulder, scale(dir, len * a.r)), up);
}
/** The chest's and head's turns toward the target (face 0–1 of the way): the head most, the chest a quarter. */
function faceTurn(s: Skeleton, f: Filled, aims: Aims): [V3, V3] {
  if (!f.face || !aims.target) return [[0, 0, 0], [0, 0, 0]];
  const [yaw, pitch] = aim(eyesOf(s), aims.target), y = Math.max(-1.3, Math.min(1.3, yaw)) * f.face, p = Math.max(-0.6, Math.min(0.7, pitch)) * f.face;
  return [[p * 0.2, y * 0.3, 0], [p * 0.8, y * 0.7, 0]];
}
/** A filled spec as a whole Pose on this skeleton (A on `side`): the body from the hips, the legs and arms by IK. */
export function specPose(s: Skeleton, spec: Filled, side: Side, aims: Aims = {}, tip = 0): Pose {
  const f = onSide(spec, side), g = s.genes, k = g.height / 1.62, pose = restPose();
  const [chestT, headT] = faceTurn(s, f, aims);
  // `tip`: the sprite cheat's head tipped back toward the camera (motion.ts lookUp), as the gait's pose has it.
  const chest = add(f.chest, chestT), head = add(f.head, add(headT, [-tip, 0, 0]));
  pose.shift[J.pelvis] = [f.pel[0] * k, f.pel[1] * k + (hipOf(s, f, aims) - 1) * s.hipY, f.pel[2] * k];
  pose.rot[J.pelvis] = euler(...f.pelR);
  // The spine and chest share the chest's turn and take back the hips' turn and roll; the posture kept.
  pose.rot[J.spine] = euler(g.posture * 0.3 + chest[0] * 0.4, chest[1] * 0.4 - f.pelR[1] * 0.5, chest[2] * 0.4 - f.pelR[2] * 0.5);
  pose.rot[J.chest] = euler(g.posture * 0.7 + chest[0] * 0.6, chest[1] * 0.6 - f.pelR[1] * 0.5, chest[2] * 0.6 - f.pelR[2] * 0.5);
  pose.rot[J.neck] = euler(head[0] * 0.4 - g.posture * 0.25 + g.headPitch * 0.4, head[1] * 0.4 - chest[1] * 0.3, head[2] * 0.4 - chest[2] * 0.5 + g.headTilt * 0.4);
  pose.rot[J.head] = euler(head[0] * 0.6 - g.posture * 0.35 + g.headPitch * 0.6, head[1] * 0.6, head[2] * 0.6 + g.headTilt * 0.6);
  shrug(pose, f.sh);
  let world = fk(s, pose);
  const rootM = world[J.root], knee = applyDir(world[J.pelvis], [0, 0, 1]), leg = s.hipY;
  const toeReach = 0.62 * g.foot, heelReach = 0.2 * g.foot;
  for (const sd of ['L', 'R'] as const) {
    // Each foot's `at` is its own: x out from the middle, whichever side it is on.
    const x = sd === 'L' ? 1 : -1, ft = sd === side ? f.fA : f.fB;
    const pivot = Math.max(0, Math.sin(ft.pitch)) * toeReach + Math.max(0, -Math.sin(ft.pitch)) * heelReach;
    const ankle = apply(rootM, [x * (g.hips * f.stance + ft.at[0] * leg), g.ankle + ft.at[1] * leg + pivot, ft.at[2] * leg]);
    const footTurn = qmat(qmul(euler(0, x * ft.turn, 0), euler(ft.pitch, 0, 0)));
    twoBoneIK(s, pose, world, J[`thigh.${sd}`], J[`shin.${sd}`], J[`foot.${sd}`], ankle, knee, 1, footTurn);
  }
  world = fk(s, pose);
  for (const sd of ['L', 'R'] as const) {
    const a = sd === side ? f.A : f.B, sh = position(world[J[`upperArm.${sd}`]]);
    twoBoneIK(s, pose, world, J[`upperArm.${sd}`], J[`foreArm.${sd}`], J[`hand.${sd}`], handAt(s, sh, a, rootM, aims), applyDir(rootM, normalize(a.pole)), -1);
    world = fk(s, pose);
  }
  placeHems(s, pose, world);
  return pose;
}
/** The shoulders raised (motion.ts raises them with a hunch the same way, by the clavicle's roll). */
function shrug(pose: Pose, sh: number) {
  if (!sh) return;
  pose.rot[J['clavicle.L']] = qmul(pose.rot[J['clavicle.L']], euler(0, 0, sh));
  pose.rot[J['clavicle.R']] = qmul(pose.rot[J['clavicle.R']], euler(0, 0, -sh));
}
/**
 * An upper-body spec laid over a pose the gait made (walking or standing), by `w` (the action's envelope): the hips'
 * shift and turn, the chest and head turned on top of the gait's, the shoulders raised, and each arm the spec drives
 * carried from where the gait has its hand to the spec's place by IK (its elbow eased from the gait's way to the spec's).
 * The legs stay the gait's, so an action plays over a walk.
 */
export function layer(s: Skeleton, base: Evaluated, spec: Filled, side: Side, w: number, aims: Aims = {}): Evaluated {
  if (w <= 0) return base;
  const f = onSide(spec, side), k = s.genes.height / 1.62, pose = clonePose(base.pose);
  const [chestT, headT] = faceTurn(s, f, aims);
  const chest = add(f.chest, chestT), head = add(f.head, headT);
  const by = (q: Q, v: V3, share: number) => qmul(q, euler(v[0] * share * w, v[1] * share * w, v[2] * share * w));
  // The feet as the gait has them, and its knees' way: a hip shift or turn keeps them planted (the legs re-solved).
  const legs = (['L', 'R'] as const).map(sd => ({ sd, ankle: position(base.world[J[`foot.${sd}`]]), turn: base.world[J[`foot.${sd}`]].slice(0, 9), knee: sub(position(base.world[J[`shin.${sd}`]]), position(base.world[J[`thigh.${sd}`]])) }));
  const hips = f.pel.some(v => v) || f.pelR.some(v => v) || f.hip !== 1 || f.seat > 0;
  const ps = pose.shift[J.pelvis];
  pose.shift[J.pelvis] = [ps[0] + f.pel[0] * k * w, ps[1] + (f.pel[1] * k + (hipOf(s, f, aims) - 1) * s.hipY) * w, ps[2] + f.pel[2] * k * w];
  pose.rot[J.pelvis] = by(pose.rot[J.pelvis], f.pelR, 1);
  pose.rot[J.spine] = by(pose.rot[J.spine], chest, 0.4);
  pose.rot[J.chest] = by(pose.rot[J.chest], chest, 0.6);
  pose.rot[J.neck] = by(pose.rot[J.neck], [head[0] - chest[0] * 0.3, head[1] - chest[1] * 0.3, head[2] - chest[2] * 0.5], 0.4);
  pose.rot[J.head] = by(pose.rot[J.head], head, 0.6);
  shrug(pose, f.sh * w);
  let world = fk(s, pose);
  if (hips) {
    for (const l of legs) twoBoneIK(s, pose, world, J[`thigh.${l.sd}`], J[`shin.${l.sd}`], J[`foot.${l.sd}`], l.ankle, l.knee, 1, l.turn);
    world = fk(s, pose);
    placeHems(s, pose, world);
    world = fk(s, pose);
  }
  const rootM = world[J.root];
  for (const sd of ['L', 'R'] as const) {
    const a = sd === side ? f.A : f.B, aw = a.w * w;
    if (aw <= 0) continue;
    // The gait's hand (the base's, carried by the turned chest), and its elbow's way.
    const sh = position(world[J[`upperArm.${sd}`]]), hand = position(world[J[`hand.${sd}`]]), elbow = position(world[J[`foreArm.${sd}`]]);
    const target = handAt(s, sh, a, rootM, aims), pole = normalize(add(scale(normalize(sub(elbow, add(sh, scale(sub(hand, sh), 0.5)))), 1 - aw), scale(normalize(applyDir(rootM, a.pole)), aw)));
    twoBoneIK(s, pose, world, J[`upperArm.${sd}`], J[`foreArm.${sd}`], J[`hand.${sd}`], add(hand, scale(sub(target, hand), aw)), pole, -1);
    world = fk(s, pose);
  }
  return { pose, world };
}
/** Two poses blended (`k` of the way to b): shifts and root lerped, rotations nlerped. */
export function blend(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a; if (k >= 1) return b;
  const out = clonePose(a);
  out.yaw = a.yaw + (b.yaw - a.yaw) * k;
  out.root = lerpV(a.root, b.root, k);
  out.shift = a.shift.map((v, i) => lerpV(v, b.shift[i], k));
  out.rot = a.rot.map((q, i) => {
    const p = b.rot[i], d = q[0] * p[0] + q[1] * p[1] + q[2] * p[2] + q[3] * p[3], sg = d < 0 ? -1 : 1;
    const r = q.map((v, j) => v + (sg * p[j] - v) * k), l = Math.hypot(...r) || 1;
    return r.map(v => v / l) as Q;
  });
  return out;
}
/**
 * The lowest point of the posed body over the floor (m; root space y): the soles (heel and toe), and round the knees,
 * hips, spine, chest, head, elbows and hands by their size on this body. 0 stands on the floor; an action keeps it there.
 */
export function lowest(s: Skeleton, world: M[]): number {
  const g = s.genes, k = g.height / 1.62, b = g.build, out: number[] = [];
  const at = (j: number, p: V3 = [0, 0, 0]) => apply(world[j], p)[1];
  for (const sd of ['L', 'R'] as const) {
    const foot = J[`foot.${sd}`];
    out.push(at(foot, [0, -g.ankle, -0.22 * g.foot]), at(foot, [0, -g.ankle, 0.66 * g.foot]));
    out.push(at(J[`shin.${sd}`]) - 0.05 * k * b, at(J[`thigh.${sd}`]) - 0.08 * k * b, at(J[`foreArm.${sd}`]) - 0.035 * k * b, at(J[`hand.${sd}`], [0, -0.06 * k, 0]) - 0.03 * k);
  }
  out.push(at(J.pelvis) - 0.1 * k * b, at(J.spine) - 0.1 * k * b, at(J.chest) - 0.12 * k * b, at(J.head, [0, g.head * 0.5, 0]) - g.head * 0.5);
  return Math.min(...out);
}
/** The pose with its root raised by `dy`. */
export function lift(p: Pose, dy: number): Pose { const out = clonePose(p); out.root = [p.root[0], p.root[1] + dy, p.root[2]]; return out; }
