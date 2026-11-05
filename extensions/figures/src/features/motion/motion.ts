import { J, clonePose, fk, restPose, twoBoneIK, type Pose, type Side, type Skeleton } from '../body/rig';
import { add, apply, applyDir, basis, cross, dot, euler, invertRigid, lerp3, matq, normalize, position, qmat, qmul, scale, smooth, sub, TAU, type M, type Q, type V3 } from '../../lib/math';
import { reach, type Part } from '../body/parts';
/**
 * Procedural motion: every layer is a pure function of the figure's parameters and the (stepped) time,
 * so a frame is reproducible and the hold can replace one arm without touching anything else.
 *
 * Layers, in order: pelvis and torso (walk or stand, lean, breath, sway), head (stabilise, tilt, turn lead), legs
 * (foot paths, or a stand's feet → IK), arms (swing, a hang, or an action's IK), then the stand's hand places and the
 * hold, last.
 */
export interface Gait {
  /** Seconds per two-step cycle, and the speed it is tuned for. */
  cycle: number; speed: number;
  /** Foot travel (front to back) over a stance, the stance's share of the cycle, and the swing foot's lift. */
  stride: number; duty: number; lift: number;
  /** Pelvis bob and drop while walking, sideways sway, yaw and roll with the stride. */
  bob: number; crouch: number; sway: number; hipYaw: number; hipRoll: number;
  /** How much of the hips' yaw the chest turns back; forward lean while walking (rad). */
  chestCounter: number; lean: number;
  /** Arm swing (rad), how far out the arms hang, the elbow's bend at rest and in the swing, and the swing's lag (cycles). */
  armSwing: number; armOut: number; elbow: number; elbowSwing: number; armLag: number;
  /** 0–1: the neck takes up the pelvis bob (a head that glides level), and cancels the chest's turn. */
  headLevel: number; headStabilize: number;
  /** 0–1: the swing foot stays low with its toes down (a drag). Feet set this far apart (fraction of hip width). */
  drag: number; track: number;
  /** Poses per second for idle, turns and actions; poses per walk cycle. */
  poseRate: number; walkPoses: number;
  /** Turn speed (rad per pose step) and how far the head leads the body (rad). */
  turnRate: number; headLead: number;
  /** Idle: breath (rad), weight shift (m), and their periods (s). */
  breath: number; breathPeriod: number; shift: number; shiftPeriod: number;
  /** Seconds a reach takes, out and back. */
  reach: number;
  /** Standing: weight on one leg (hip shift, m), that foot's lead (m), the arms' forward hang and extra elbow bend over
   * `elbow` (rad; unless `standElbow` sets the bend whole). */
  stance: number; stanceLead: number; hang: number; idleElbow: number;
  /** Standing, the arms out from the body (rad), in place of `armOut`: a gait at ease hangs them close. Left out, the
   * walk's `armOut` (a stiff or flared gait keeps its own). */
  standOut?: number;
  /** Standing, the elbow's whole bend (rad; the far arm's three quarters of it), in place of `elbow` + `idleElbow`: a
   * relaxed arm only softens at the elbow. */
  standElbow?: number;
  /** Walking, the shoulders' roll against the hips' (a share of it): the chest tips down on the side the hips rise. */
  shoulderRoll?: number;
  /** The heel strike's toes up and the push-off's heel up (rad); 0.22 and 0.5 by default. */
  heel?: number; push?: number;
  /** 0 a smooth bob … 1 a bounce: the body springs up off each strike and rides high through the stance. */
  spring?: number;
  /** The chin's lift (rad) walking and standing: an attitude. */
  chin?: number;
}
/** A held item's arm pose: the hand's place and turn in the chest's space or in the space of the joint `in`;
 * `aim` sets the hand's turn by where its fingers point and its palm faces instead. A stand's placed hand names the
 * opening it went to (`anchor`). */
export interface Hold { side: Side; hand: V3; turn: [pitch: number, yaw: number, roll: number]; pole: V3; in?: number; aim?: [fingers: V3, palm: V3]; anchor?: AnchorKind }
/**
 * A stand with attitude (a lookbook's pose, or the idle's relaxed one): the weight on one leg, the hips shifted over it
 * and rolled up on its side, the free knee soft, the chest and the head turned against the hips, each hand placed.
 */
export interface Stand {
  /** What the stand is, for the library (library/poses.json). */
  about?: string;
  /** The stands to try instead, in order, where this one's hands find no opening on the outfit or it would not read
   * (an arm lost against a top of its own colour, no air between an arm and the body, the pendant covered). */
  fallback?: string[];
  /** The leg the weight is on. */
  weight: Side;
  /** The hips: shifted over the weight leg (m at k 1), rolled up on its side and turned (+ toward the figure's left), rad. */
  shift: number; roll: number; turn?: number;
  /** The weight foot drawn in under the body (0 under its hip … 1 on the middle line; 0.25 by default), turned out (rad). */
  under?: number; splay?: number;
  /** The free foot: forward and out (m at k 1), its toes turned out and its heel raised (rad). */
  free: [forward: number, out: number, splay?: number, heel?: number];
  /** The chest: its roll against the hips (+ drops the shoulder over the weight leg), turn and pitch (back negative). */
  chest?: [roll: number, yaw: number, pitch: number];
  /** The head on the body: turn (+ toward its left), roll (+ toward its right shoulder) and nod (chin up negative). */
  head?: [yaw: number, roll: number, pitch: number];
  /** Each hand: a place (the hip, a pocket) or how it hangs; left out, the gait's idle hang. */
  hands?: Partial<Record<Side, HandPlace | Hang>>;
}
/** A hanging arm: how far out from the body and the elbow's bend (rad), and swung forward (+) or back. */
export interface Hang { out: number; bend: number; swing?: number }
/**
 * A hand placed in a stand: on the hip (akimbo), down in a front pocket at the hip's side, the thumb hooked into a front
 * pocket's mouth with the hand outside it, resting on a thigh (cargo) pocket, in a belly (kangaroo) pocket, or in a
 * jacket's pocket. Each names the opening it wants first
 * (CHAIN): the hand goes to the first one the dressed figure offers (`Anchor`), so a pose never pushes a hand into a
 * garment with no pocket there. `nudge` moves it (m at k 1: x outward, y up, z forward) and `elbow` swings the elbow out
 * (+) or in.
 */
export interface HandPlace { at: 'hip' | 'frontPocket' | 'thumbHook' | 'thighPocket' | 'bellyPocket' | 'jacketPocket' | 'crossed'; nudge?: V3; elbow?: number }
/**
 * Where a hand can go on a dressed figure: a pocket's mouth, a hem's side, the hip. `at` the opening's centre in rest
 * figure space (as the garments' parts are built), riding `bone`; `open` the unit direction a hand goes into it. The
 * garments publish theirs in this shape (as look.anchors; base's bare body publishes none, so a hand finds the hip, and
 * a fork's wardrobe publishes the pockets and hems), and the poses resolve against those.
 */
export interface Anchor { kind: 'bellyPocket' | 'frontPocket' | 'thighPocket' | 'jacketPocket' | 'hem' | 'hip' | 'pendant'; side?: Side; bone: number; at: V3; open: V3 }
export type AnchorKind = Anchor['kind'];
/** Each place's openings in the order it tries them: a pocket the outfit lacks (or a longer top covers) gives way to the
 * next a hand can use there. A hand meant to sit high on the body ends on the hip, which every body has; one meant to
 * sit low (a pocket at the hip, a thumb at its mouth) ends hanging (`hang`), as a hand with nowhere to go does. */
export const CHAIN: Record<HandPlace['at'], (AnchorKind | 'hang')[]> = {
  hip: ['hip'],
  frontPocket: ['frontPocket', 'jacketPocket', 'hem', 'hang'],
  thumbHook: ['frontPocket', 'hem', 'hang'],
  thighPocket: ['thighPocket', 'frontPocket', 'hip'],
  bellyPocket: ['bellyPocket', 'frontPocket', 'hem', 'hip'],
  jacketPocket: ['jacketPocket', 'frontPocket', 'hip'],
  // Arms crossed: no opening, the hands on each other's arms (CROSS).
  crossed: [],
};
/** How far out from `origin` along `dir` (rest figure space) the dressed figure's outermost surface lies, or 0. */
export type Surface = (origin: V3, dir: V3) => number;
export interface MotionState {
  /** Stepped seconds, for idle, twitches and actions. */
  t: number;
  moving: boolean;
  /** Walk phase over a two-step cycle, [0, 1). */
  phase: number;
  /** Body facing (rad; 0 faces +z) and the head's lead over it. */
  yaw: number; headYaw: number;
  /** Turning on the spot: a short shuffle, its own phase. */
  shuffle: number;
  /** The sprite cheat: the head tips up toward the camera by this much (rad), so a face reads from 30° above; only as
   * far as the face turns to the camera (`view`), so a profile or a back is never tipped back. */
  lookUp?: number;
  /** The camera's bearing round the figure, against its facing (rad; 0 the figure faces it), where it differs from `yaw`
   * (a made pose turned to the view afterwards), and its pitch down (rad), so the walk's sway can be kept off the
   * head's height on screen. */
  view?: number; pitch?: number;
  action?: { id: ActionId; t: number; side: Side } | null;
  /** The hair's swing (rad), from the figure's spring: pitch back and forth, roll side to side. */
  hair?: { pitch: number; roll: number } | null;
  hold?: Hold | null;
  /** Standing: the stand (the gait's relaxed one when left out), and its hands' holds if already placed (`standHolds`). */
  stand?: Stand | null; holds?: Hold[] | null;
  /** The least each arm (L, R) hangs out from the body (rad) to clear the dressed figure (`clearance`). */
  clear?: [number, number] | null;
  /** Walking, the way the feet travel against the body's facing (rad, + toward its left): a strafe or a step back. Left
   * out, straight ahead. */
  heading?: number;
  /** Walking, the stride's share (0 steps in place, marching; 1 the gait's own). Left out, the gait's own. */
  stride?: number;
}
export interface Evaluated { pose: Pose; world: M[] }
/**
 * The actions a figure plays itself: the reach, and the flinch (both forearms up before the face, the head ducked and
 * turned away, half a step back). Each runs from its own start for as long as the caller holds it.
 */
export type ActionId = 'reach' | 'flinch';
/** The most the hips turn either way over a stride (rad): with the chest's counter-turn the figure stays in its octant. */
const OCTANT = 0.1;
/** Walking, the chin a touch down (rad), whatever the gait's lift. */
const NOD = 0.05;
/** The least the head rises and falls over a step (m): a texel at the brand kit's density (36.9 per metre), so no walk
 * glides. */
const BOB = 0.03;
const frac = (v: number) => v - Math.floor(v);
const sideSign = (s: Side) => (s === 'L' ? 1 : -1);
/** The heel-to-toe roll: toes up as the heel strikes (rad), and the heel up as the toes push off (the gait's own, else these). */
const HEEL_ = 0.22, PUSH_ = 0.35;
/** The most the toes point down (rad), pushing off or in the swing: a foot pitched further reads, at sprite size, as a
 * kneel. */
const TOE_DOWN = 0.26;
/** Walking, the forearm comes no further forward of plumb than FORE (rad), so the swing reads as an arm, not a chop; and
 * the wrist lets the hand hang back by WRIST of the forearm's angle, as a relaxed hand does. */
const FORE = 0.8, WRIST = 0.45;
/** Walking, the share of the arm's swing a bulky sleeve (one needing 0.4 rad of clearance) gives up, and the share of
 * its clearance an arm swung to either end of its swing gives back. */
const SWING_BULK = 0.3, CLOSE = 0.55;
/** The leading knee's least bend as its heel strikes, as the hips' drop over a straight leg (m at k 1): about 14°. */
const SOFT = 0.006;
/**
 * One foot's ankle offset at foot phase f: z forward and y up (its lift off the floor), its pitch (toes down positive),
 * and whether it is planted. The foot rolls as a walker's does: it lands on its heel with the toes up, flattens, peels
 * off from the heel to push on the toes, and swings through, level a third of the way, to land on the heel again. The path
 * sits back by half the reach the stance's overlap gives the leading foot over the trailing one, so at the strike both
 * legs run long, and the swing takes the foot forward from the off so its shin leaves the floor rather than trailing on it.
 */
function footPath(f: number, g: Gait, stride: number, lift: number): [number, number, number, boolean] {
  const k = frac(f), roll = 1 - g.drag, HEEL = g.heel ?? HEEL_, PUSH = Math.min(g.push ?? PUSH_, TOE_DOWN);
  const back = stride * (1 - 0.5 / g.duty) / 4;
  if (k < g.duty) {
    const u = k / g.duty;
    const pitch = roll * (u < 0.18 ? -HEEL * (1 - smooth(u / 0.18)) : u > 0.7 ? PUSH * smooth((u - 0.7) / 0.3) : 0);
    return [stride / 2 - stride * u - back, 0, pitch, true];
  }
  // The swing: forward with an eased arc, from the push-off's toes down, level a third of the way, to the strike's toes up.
  const s = (k - g.duty) / (1 - g.duty);
  const pitch = roll * (PUSH * (1 - smooth(Math.min(1, s / 0.3))) - HEEL * smooth(Math.max(0, (s - 0.5) / 0.5))) + g.drag * 0.35 * Math.sin(Math.PI * s);
  return [-stride / 2 - back + stride * (smooth(s) + s) / 2, lift * Math.sin(Math.PI * s) * (1 - 0.7 * g.drag), Math.min(pitch, TOE_DOWN), false];
}
/** The reach's envelope over its duration: out, hold, back. */
function reachEnvelope(t: number, duration: number) {
  const k = t / duration;
  if (k <= 0 || k >= 1) return 0;
  return k < 0.35 ? smooth(k / 0.35) : k < 0.72 ? 1 : smooth((1 - k) / 0.28);
}
/** The idle's stand from the gait: the weight a little over the right leg, the left foot leading, the arms hanging. */
export const relaxed = (gait: Gait): Stand => ({
  // A clear contrapposto, as a figure drawn standing at ease: the hip well out over the weight leg and rolled up, the
  // shoulder over it dropped against it, the free foot as the gait sets it, a little forward with its heel up.
  weight: 'R', shift: gait.stance * RELAX, roll: gait.stance * 1.4 * RELAX, under: 0.25,
  free: [gait.stanceLead, gait.stance ? 0.01 : 0, gait.stance ? 0.22 : 0, gait.stance ? 0.08 : 0], chest: [gait.stance * 1.2 * RELAX, 0, 0],
});
/** How much more the relaxed stand leans into its weight leg than the gait's stance alone. */
const RELAX = 1.6;
/**
 * The openings any body offers a hand, on `surface` (the dressed figure's outermost; with none, the body's own reach):
 * each found from a point inside the body looking out along a direction to the surface there. The hip above its crest
 * (akimbo's), a front pocket's slanted mouth at the hip's side-front, a thigh pocket's flap on the thigh's side-front and
 * a belly pocket's side openings. A pose given no anchors uses these; a dressed figure's come from its garments
 * (look.anchors), and a hand whose chain finds none there ends on the body's hip.
 */
export function openings(s: Skeleton, surface?: Surface): Anchor[] {
  const g = s.genes, k = g.height / 1.62, hip = s.hipY, b = g.build, out: Anchor[] = [];
  for (const side of ['L', 'R'] as const) {
    const x = sideSign(side);
    const on = (kind: AnchorKind, bone: number, from: V3, dir: V3, body: number, open: V3): Anchor => {
      const d = normalize(dir), r = (surface && surface(from, d)) || body;
      return { kind, side, bone, at: add(from, scale(d, r)), open: normalize(open) };
    };
    out.push(
      on('hip', J.pelvis, [x * g.hips * 0.3, hip + 0.075 * k, -0.012 * k], [x, 0, -0.25], g.hips + 0.055 * k * b, [-x, 0, 0.25]),
      on('frontPocket', J.pelvis, [x * g.hips * 0.95, hip - 0.05 * k, 0.01 * k], [x * 0.8, -0.1, 0.6], 0.09 * k * b, [-x * 0.2, -1, -0.15]),
      on('thighPocket', J[`thigh.${side}`], [x * g.hips, hip - 0.3 * s.thigh, 0.012 * k], [x, 0, 0.3], 0.07 * k * b, [0, -1, 0]),
      on('bellyPocket', J.pelvis, [x * 0.1 * k, hip + 0.11 * k, 0], [x * 0.35, 0, 1], 0.1 * k * b, [-x, -0.1, -0.3]),
    );
  }
  return out;
}
/** The hand's grip at an opening: `in` it (a pocket), its thumb hooked in with the hand outside (`hook`), or the heel
 * of the hand on it (`on`, akimbo). */
type Grip = 'in' | 'hook' | 'on';
/** A hand that drops to an opening comes to it with its forearm no further from plumb than PLUMB (rad); an opening too
 * high for the arm's length to fall to (it would bend the elbow up past that) gives way to the chain's next. A jacket's
 * slash pocket takes the hand in at a slant, the forearm forward from an elbow out and back, up to SLASH. */
const PLUMB = 0.7, SLASH = 1.35;
/** A hand at the front of the hips (a pocket's mouth, a thumb hooked at a hem) keeps its wrist at least FLY of the
 * hip's half-width out from the middle, so it never reads as a hand at the fly. */
const FLY = 0.5;
/** The top of a forearm folded across the body lies this far (m at k 1) under what it must not cover: its round and a
 * texel's air. */
const FOREARM = 0.09;
/** The tightest an elbow bends to place a hand, as the shoulder-to-wrist span's share of the arm's length (about 95°). */
const BENT = 0.74;
/**
 * A hand place (HandPlace) into a hold on this skeleton: the first opening of the place's CHAIN on its side that the arm
 * reaches, and falls to plumb where the hand drops into it, with the grip it takes there; null where the chain ends
 * hanging. The hold rides the opening's bone. In a pocket the hand goes in along `open`, the palm to the body, as deep
 * as the arm is long for it (to the wrist, or past it for a long arm, so the arm hangs straight into the pocket rather
 * than bending its elbow up); hooked, the hand hangs flat outside the mouth or the hem; on the hip, the heel of the hand
 * above the crest with the fingers forward. The elbow goes back where the hand drops into a mouth that opens down, so
 * the forearm falls plumb to it rather than lying across the body; out and lifted for a mouth at the side.
 */
export function place(s: Skeleton, side: Side, p: HandPlace, surface?: Surface, anchors: Anchor[] = openings(s, surface)): Hold | null {
  const g = s.genes, k = g.height / 1.62, x = sideSign(side), shoulder = s.rest[J[`upperArm.${side}`]], full = s.upperArm + s.foreArm, arm = full * 0.95;
  // The place's nudge and elbow are tuned to the opening it wants first: a hand that falls back to another takes that
  // one's own.
  const tuned = (a: Anchor) => a.kind === CHAIN[p.at][0];
  // A side-less opening serves either hand, mirrored to its side.
  const ofSide = (a: Anchor): Anchor => (a.side || Math.sign(a.at[0]) === x || !a.at[0] ? a : { ...a, at: [-a.at[0], a.at[1], a.at[2]], open: [-a.open[0], a.open[1], a.open[2]] });
  const span = (at: V3) => Math.hypot(at[0] - shoulder[0], at[1] - shoulder[1], at[2] - shoulder[2]);
  // The hips' half-width (the hip opening's reach out from the middle) and the waist's height over them.
  const hipHalf = Math.abs((anchors.find(a => a.kind === 'hip' && (a.side ?? side) === side) ?? openings(s, surface).find(a => a.kind === 'hip' && a.side === side)!).at[0]), hipTop = s.hipY + 0.16 * k;
  // The forearm's lean from plumb with the wrist at `at`: the shoulder-to-wrist line's own, and the elbow's bend off it.
  const lean = (at: V3) => {
    const d = span(at), f = s.foreArm, u = s.upperArm;
    return Math.acos(Math.min(1, (shoulder[1] - at[1]) / d)) + Math.acos(Math.max(-1, Math.min(1, (f * f + d * d - u * u) / (2 * f * d))));
  };
  const hold = (a: Anchor): { hold: Hold; drops: boolean; wrist: V3 } => {
    const { at, open } = a, rb = s.rest[a.bone], outward = normalize([at[0] - rb[0], 0, at[2] - rb[2]]), down = Math.abs(open[1]) > 0.6;
    const grip: Grip = a.kind === 'hip' ? 'on' : a.kind === 'hem' || p.at === 'thumbHook' || p.at === 'thighPocket' ? 'hook' : 'in';
    const onCloth = (w: V3): V3 => {
      const o: V3 = [rb[0], w[1], rb[2]], d = sub(w, o), r = Math.hypot(...d), face = surface?.(o, scale(d, 1 / r)) ?? 0;
      return face > r ? add(o, scale(d, face / r)) : w;
    };
    // Into a mouth that opens down the hand goes down the cloth's face as deep as the arm still reaches (up to 6 cm).
    const into = (deep: number) => add(onCloth(add(at, [0, -deep, 0])), scale(outward, 0.004 * k));
    let deep = 0.06 * k;
    while (down && deep > 0.004 * k && span(into(deep)) > arm) deep -= 0.004 * k;
    // A long arm's hand slides down the mouth at the side (a belly pocket's, which runs down to the hem) or down the hip,
    // until the elbow bends no tighter than BENT: so it never folds its elbow up level with the shoulder, nor its
    // forearm up to the pocket.
    // The wrist at the mouth on the cloth's face, the hand in under it: a mouth on the front of the cloth (a kangaroo
    // pocket's, whose panel lies over the hand) takes the fingers in along it and turned in toward the body, so the
    // hand goes from sight under the cloth and only the cuff shows at the opening.
    const aside = (drop: number) => add(onCloth(add(at, [0, -drop, 0])), scale(open, -0.004 * k));
    const onHip = (drop: number) => add(onCloth(add(at, [0, -drop, 0])), scale(outward, 0.016 * k));
    let low = 0, drop = 0;
    while (!down && grip === 'in' && low < 0.06 * k && span(aside(low)) < BENT * full) low += 0.004 * k;
    while (grip === 'on' && drop < 0.1 * k && span(onHip(drop)) < BENT * full) drop += 0.005 * k;
    const spec: { wrist: V3; fingers: V3; palm: V3; pole: V3 } = grip === 'on'
      ? { wrist: onHip(drop), fingers: [0, -0.7, 1], palm: [-x, 0, 0.1], pole: [x, 0.1, -0.9] }
      : grip === 'hook'
        ? { wrist: add(add(at, scale(outward, 0.02 * k)), [0, 0.012 * k, 0]), fingers: [x * 0.1, -1, 0.2], palm: scale(outward, -1), pole: [x * 0.3, 0, -0.95] }
        : { wrist: down ? into(deep) : aside(low), fingers: down ? open : normalize(add(open, scale(outward, -0.6))), palm: scale(outward, -1), pole: down ? [x * 0.3, 0, -0.95] : [x, 0.25, -0.35] };
    const n = (tuned(a) && p.nudge) || [0, 0, 0], elbow = (tuned(a) && p.elbow) || 0;
    const pole = normalize(add(spec.pole, [x * elbow, 0, 0])), wrist = add(spec.wrist, [x * n[0] * k, n[1] * k, n[2] * k]);
    if (grip !== 'on' && a.kind !== 'thighPocket' && wrist[1] < hipTop) wrist[0] = x * Math.max(x * wrist[0], FLY * hipHalf);
    return { hold: { side, in: a.bone, hand: sub(wrist, s.rest[a.bone]), turn: [0, 0, 0], pole, aim: [spec.fingers, spec.palm], anchor: a.kind }, drops: grip === 'hook' || (grip === 'in' && down), wrist };
  };
  if (p.at === 'crossed') return crossed(s, side, surface, anchors);
  for (const kind of CHAIN[p.at]) {
    if (kind === 'hang') return null;
    const found = anchors.filter(c => c.kind === kind && (c.side ?? side) === side).map(ofSide)[0];
    if (!found) continue;
    const h = hold(found);
    if (kind === 'hip' || (span(h.wrist) <= arm && (!h.drops || lean(h.wrist) <= (kind === 'jacketPocket' ? SLASH : PLUMB)))) return h.hold;
  }
  return hold(openings(s, surface).find(c => c.kind === 'hip' && c.side === side)!).hold;
}
/**
 * Arms crossed (CROSS): each forearm level across the front of the ribs, the right one over the left (higher and
 * forward of it), its hand on the far arm's biceps with the fingers round its back, the elbows down at the sides. The
 * forearms lie in front of the dressed figure's chest (`surface`), as far as the sleeves need, and under a pendant's
 * foot (`anchors`' pendant) by the forearm's round and a little air, so the nameplate is never behind them.
 */
function crossed(s: Skeleton, side: Side, surface?: Surface, anchors: Anchor[] = []): Hold {
  const g = s.genes, k = g.height / 1.62, x = sideSign(side), over = side === 'R', chest = s.rest[J.chest];
  const pendant = anchors.find(a => a.kind === 'pendant'), under = pendant ? pendant.at[1] - FOREARM * k : Infinity;
  const y = Math.min(s.chestY - 0.1 * k, under) - (over ? 0 : 0.025 * k), front = (surface && surface([0, y, 0], [0, 0, 1])) || 0.13 * k;
  const wrist: V3 = [-x * g.shoulders * 0.62, y, front + (over ? 0.05 : 0.025) * k];
  return { side, in: J.chest, hand: sub(wrist, chest), turn: [0, 0, 0], pole: normalize([x * 0.8, -0.7, 0.25]), aim: [[-x, -0.15, -0.6], [0, 0, -1]] };
}
/** The stand's placed hands as holds, at the dressed figure's openings (`anchors`) where it has them. */
export const standHolds = (s: Skeleton, stand: Stand, surface?: Surface, anchors?: Anchor[]): Hold[] =>
  (['L', 'R'] as const).flatMap(side => { const h = stand.hands?.[side], hold = h && 'at' in h ? place(s, side, h, surface, anchors) : null; return hold ? [hold] : []; });
/**
 * How far out (rad) each arm (L, R) must hang for its wrist and hand to clear the dressed figure at and below the hip:
 * at each height the hand passes, the outermost surface's width there (reach on every part but the arms' and those in
 * `skip`, as a hand finds the cloth it rests on), against the hand's own round inward of the arm's axis (its cuff's, its
 * thumb's) and a little air. So the hands hang clear of whatever is widest at the hip (wide trousers, a long tee's hem)
 * on any body; a sleeve may still lie over its own top's body above, as cloth does.
 */
export function clearance(s: Skeleton, parts: Part[], arms: Record<Side, number>, skip: number[] = []): [number, number] {
  const g = s.genes, k = g.height / 1.62, top = s.hipY + 0.03 * k, air = 0.002 * k, MAX = 0.6;
  const body = parts.filter(p => p.group !== arms.L && p.group !== arms.R && !skip.includes(p.group));
  const clear = (side: Side) => {
    const x = sideSign(side), [ax, ay] = s.rest[J[`upperArm.${side}`]], own = parts.filter(p => p.group === arms[side]);
    // The body's width beside the arm, in 1 cm rows, its widest a little before, at and behind the middle.
    const rows = new Map<number, number>();
    const width = (y: number) => {
      const row = Math.round(y * 100);
      if (!rows.has(row)) rows.set(row, Math.max(...[-0.08, -0.04, 0, 0.04].map(z => reach(body, s.rest, [0, row / 100, z * k], [x, 0, 0]))));
      return rows.get(row)!;
    };
    // The arm's round inward of its axis, from the wrist down to the fingertips.
    const along = [g.arms - 0.03 * k, g.arms + 0.02 * k, g.arms + 0.06 * k, g.arms + 0.1 * k];
    const round = along.map(d => reach(own, s.rest, [ax, ay - d, 0], [-x, 0, 0]));
    for (let out = 0; out < MAX; out += 0.01) {
      const ok = along.every((d, i) => { const y = ay - d * Math.cos(out); return y > top || Math.abs(ax) + d * Math.sin(out) - round[i] * Math.cos(out) - air >= width(y); });
      if (ok) return out;
    }
    return MAX;
  };
  return [clear('L'), clear('R')];
}
/** The base pose, everything but the holds. Nothing here reads a hold. */
export function base(s: Skeleton, gait: Gait, st: MotionState): Evaluated {
  const g = s.genes, pose = restPose(), k = g.height / 1.62;
  pose.yaw = st.yaw;
  const walking = st.moving, shuffling = !walking && st.shuffle > 0;
  const phase = walking ? st.phase : shuffling ? st.shuffle : 0;
  const cos1 = Math.cos(TAU * phase), cos2 = Math.cos(2 * TAU * phase);
  // Standing (not mid-turn): a stand, the figure's own or the gait's relaxed one. `w` the side its weight is on.
  const stand = !walking && !shuffling ? st.stand ?? relaxed(gait) : null, w = stand ? sideSign(stand.weight) : 0;
  // The walk's bob, and the share of it the neck takes up, held to the least a head must rise and fall to read (BOB).
  const bob = Math.max(gait.bob, BOB), headLevel = Math.min(gait.headLevel, 1 - BOB / bob);
  // ─── Pelvis and torso ───
  let pelvisY = 0, pelvisX = 0, hipYaw = 0, hipRoll = 0, lean = 0, chestRoll = 0, chestYaw = 0, chestPitch = 0;
  if (walking) {
    // The bob: lowest at each heel strike, highest over the stance; `spring` sharpens it into a bounce off the strike.
    pelvisY = -gait.crouch - bob * (1 - Math.abs(Math.sin(TAU * phase)) ** (2 * (1 - Math.min(0.9, gait.spring ?? 0))));
    pelvisX = gait.sway * Math.cos(TAU * (phase - gait.duty / 2));
    // The hips turn with the stride only so far that the figure keeps to its view's octant; the step's weight goes
    // through their roll, the bob and the shoulders' roll.
    hipYaw = -Math.min(gait.hipYaw, OCTANT) * cos1; hipRoll = gait.hipRoll * Math.cos(TAU * (phase - gait.duty / 2)); lean = gait.lean;
    // The shoulders roll against the hips, so the upper body carries the step rather than gliding over it.
    chestRoll = -hipRoll * (gait.shoulderRoll ?? 0);
  } else if (stand) {
    // Contrapposto: the hips over the weight leg, rolled up on its side, swaying slowly with the idle's weight shift.
    pelvisX = w * stand.shift * k + gait.shift * Math.sin(TAU * st.t / gait.shiftPeriod);
    hipRoll = w * stand.roll; hipYaw = stand.turn ?? 0;
    // The chest against them: the shoulder over the weight leg drops, as the hip under it rises.
    chestRoll = -w * (stand.chest?.[0] ?? 0); chestYaw = stand.chest?.[1] ?? 0; chestPitch = stand.chest?.[2] ?? 0;
  } else {
    // A turn on the spot: the old idle's weight shift, and the shuffle's bob.
    pelvisX = gait.stance + gait.shift * Math.sin(TAU * st.t / gait.shiftPeriod);
    hipRoll = -pelvisX * 1.2;
    pelvisY = -0.012 * k * (0.5 + 0.5 * cos2);
  }
  const breath = walking ? 0 : gait.breath * Math.sin(TAU * st.t / gait.breathPeriod);
  pose.shift[J.pelvis] = [pelvisX, pelvisY, 0];
  pose.rot[J.pelvis] = euler(0, hipYaw, hipRoll);
  // The waist takes the hips' turn and roll back; the chest adds its own.
  pose.rot[J.spine] = euler(lean * 0.5 + g.posture * 0.3, -hipYaw, -hipRoll);
  pose.rot[J.chest] = euler(lean * 0.5 + g.posture * 0.7 - breath + chestPitch, -hipYaw * gait.chestCounter + chestYaw, chestRoll);
  // Reach: the torso leans in a little toward the hand.
  const reaching = st.action?.id === 'reach' ? reachEnvelope(st.action.t, gait.reach) : 0;
  if (reaching) pose.rot[J.chest] = qmul(pose.rot[J.chest], euler(0.12 * reaching, sideSign(st.action!.side) * -0.12 * reaching, 0));
  // Flinch: the chest recoils, the hips go back.
  const flinch = st.action?.id === 'flinch' ? smooth(Math.min(1, st.action.t / 0.18)) : 0;
  if (flinch) { pose.rot[J.chest] = qmul(pose.rot[J.chest], euler(-0.14 * flinch, 0.12 * flinch, 0)); pose.shift[J.pelvis][2] -= 0.04 * k * flinch; }
  // ─── Head ───
  // The neck takes back the chest's turn (walking, by the gait's stabilise; standing, all of it) and most of its roll,
  // so the head is set on the body, then turned by the stand.
  const counter = walking ? hipYaw * gait.chestCounter * gait.headStabilize : -chestYaw;
  let headRoll = g.headTilt - chestRoll * 0.7 + (stand?.head?.[1] ?? 0);
  // The face's turn to the camera (1 facing it, 0.7 in three-quarter, 0 in profile and from behind): the sprite cheat's tip
  // back and the gait's chin lift take only that share, so no profile or back is tipped chin-up. Walking, the head sits
  // level with the chin a touch down (NOD), the eyes on the way ahead.
  const toward = Math.max(0, Math.cos(st.view ?? st.yaw));
  const headPitch = g.headPitch - (lean + g.posture) * 0.6 - ((st.lookUp ?? 0) + (gait.chin ?? 0)) * toward + 0.32 * flinch + (walking ? NOD : 0) + (stand?.head?.[2] ?? 0);
  const headYaw = st.headYaw + 0.3 * flinch + (stand?.head?.[0] ?? 0);
  // A hunch sinks the head forward on the neck; the head turns back up by as much, so the face still looks ahead.
  pose.rot[J.neck] = euler(headPitch * 0.4 + 0.55 * g.hunch, counter + headYaw * 0.4, headRoll * 0.4);
  pose.rot[J.head] = euler(headPitch * 0.6 - 0.55 * g.hunch, headYaw * 0.6, headRoll * 0.6);
  // A head that rides level: the neck takes up the pelvis bob, all but the least that reads.
  pose.shift[J.neck] = [0, -pelvisY * (walking ? headLevel : gait.headLevel), 0];
  // The hair hangs from its pivots, swung by its spring; the sides swing less and splay with the roll.
  if (st.hair) {
    pose.rot[J['hair.back']] = euler(st.hair.pitch, 0, st.hair.roll);
    pose.rot[J['hair.L']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8);
    pose.rot[J['hair.R']] = euler(st.hair.pitch * 0.6, 0, st.hair.roll * 0.8);
  }
  // ─── Arms: swing opposite the legs, or hang ───
  for (const side of ['L', 'R'] as const) {
    // Walking, a bulky sleeve (one that must hang well out to clear the figure) swings less, as a puffer's arm does.
    const clear = st.clear?.[side === 'L' ? 0 : 1] ?? 0, amp = gait.armSwing * (walking ? 1 - SWING_BULK * Math.min(1, clear / 0.4) : 1);
    const x = sideSign(side), swing = walking ? x * amp * Math.cos(TAU * (phase - gait.armLag)) : 0;
    const forward = Math.max(0, -swing);
    const idleSway = walking ? 0 : 0.03 * Math.sin(TAU * (st.t / gait.breathPeriod) + (side === 'L' ? 0 : 1.3));
    // A hunch raises each shoulder and rounds it forward.
    pose.rot[J[`clavicle.${side}`]] = g.hunch ? euler(0, -x * 0.12 * g.hunch, x * (breath * 0.6 + 0.3 * g.hunch)) : euler(0, 0, x * breath * 0.6);
    // A stand's own hang for this arm, else the idle's; a placed hand hangs here first and its hold moves it after.
    const own = stand?.hands?.[side], hung = own && !('at' in own) ? own : null;
    // Out from the body by the gait (or the stand's hang), and at least as far as clears the dressed figure: walking, all
    // of that only as the hand passes the hip mid-swing; swung forward or back it is clear of the hip, and comes in by
    // CLOSE of it at the swing's ends, so the arms never flare wide of the body in the three-quarter views.
    const ends = walking ? Math.abs(swing) / Math.max(1e-6, amp) : 0;
    // Standing at ease the arms hang close, from the shoulder nearly plumb, the elbows only soft (the stand's own bend,
    // not the walk's carried one): a bent, flared arm at rest reads as a gunslinger's.
    const hang = walking ? 0 : gait.hang + (hung?.swing ?? 0), out = Math.max(walking ? gait.armOut : hung ? gait.armOut + hung.out : gait.standOut ?? gait.armOut, clear * (1 - CLOSE * ends));
    const bend = walking
      ? Math.min(gait.elbow + gait.elbowSwing * forward / Math.max(1e-6, amp), Math.max(gait.elbow, FORE - forward))
      : hung ? hung.bend : gait.standElbow !== undefined ? gait.standElbow * (side === 'L' ? 1 : 0.75) : gait.elbow + gait.idleElbow * (side === 'L' ? 1 : 0.7);
    // `plumb` of the torso's bend taken back at the shoulder, so a stooped figure's arms hang down rather than swing back
    // with the chest; the chest's roll taken back too, so the arms hang plumb from shoulders that tilt.
    pose.rot[J[`upperArm.${side}`]] = euler(swing + idleSway * 0.5 - hang, 0, x * out - chestRoll);
    pose.rot[J[`foreArm.${side}`]] = euler(-(bend + Math.abs(idleSway)), 0, 0);
    // The hand hangs from the wrist, back toward plumb by a share of the forearm's angle forward of it.
    pose.rot[J[`hand.${side}`]] = euler(WRIST * (bend - swing - idleSway * 0.5 + hang), 0, 0);
  }
  let world = fk(s, pose);
  // ─── Legs: feet on their paths, or a stand's feet; IK from the hips ───
  const rootM = world[J.root];
  const forwardWorld = applyDir(rootM, [0, 0, 1]);
  if (stand) {
    // The weight leg runs straight from its hip to its foot, drawn in under the body: the hips sink as far as that needs.
    const hipW = position(world[J[`thigh.${stand.weight}`]]), foot = apply(rootM, [w * g.hips * (1 - (stand.under ?? 0.25)), g.ankle, 0]);
    const L = (s.thigh + s.shin) * 0.996, dx = hipW[0] - foot[0], dz = hipW[2] - foot[2];
    pose.shift[J.pelvis][1] -= hipW[1] - foot[1] - Math.sqrt(Math.max(0, L * L - dx * dx - dz * dz));
    world = fk(s, pose);
  }
  const stride = (walking ? gait.stride * (st.stride ?? 1) : shuffling ? 0.12 : 0) * k, lift = (walking ? gait.lift : shuffling ? 0.035 : 0) * k;
  // Stepping in place (a stride of none) still lifts the feet on their paths; a heading turns the paths off the facing.
  const march = walking && st.stride === 0, heading = walking ? st.heading ?? 0 : 0;
  // The feet: a stand's, or each on its path (root space). `pitch` toes down; `planted` on the floor mid-walk.
  const L = (s.thigh + s.shin) * 0.996, heelReach = 0.2 * g.foot, toeReach = 0.62 * g.foot;
  const feet = (['L', 'R'] as const).map(side => {
    const x = sideSign(side);
    if (stand) {
      // The weight foot under the body, the free one forward and out, its toes turned out and its heel a little up, so
      // its knee comes soft.
      const free = x !== w, [fwd, out, splay = 0, heel = 0] = stand.free, under = stand.under ?? 0.25;
      const up = free ? Math.max(0, Math.sin(heel)) * toeReach : 0;
      const at: V3 = free ? [x * (g.hips * (1 - under) + out * k), g.ankle + up, fwd * k] : [x * g.hips * (1 - under), g.ankle, 0];
      return { side, at, pitch: free ? heel : 0, turn: x * (free ? splay : stand.splay ?? 0.1), planted: false };
    }
    // A flinch takes the far foot half a step back. Walking, the feet fall toward one line under the body (`track`);
    // standing, they keep under the hips.
    const [z, y, pitch, planted]: [number, number, number, boolean] = stride || march ? footPath(phase + (side === 'L' ? 0 : 0.5), gait, stride, lift) : [side === 'R' ? -0.13 * k * flinch : 0, 0, 0, false];
    // A strafe sets the feet wider (as far as its sideways share), so they pass beside each other and never cross.
    const at: V3 = heading
      ? [x * g.hips * Math.max(gait.track, 0.9 * Math.abs(Math.sin(heading))) + Math.sin(heading) * z, g.ankle + y, Math.cos(heading) * z]
      : [x * g.hips * (walking ? gait.track : Math.max(gait.track, 0.75)), g.ankle + y, z];
    return { side, at, pitch, turn: 0, planted: planted && walking };
  });
  // On its heel the ankle rides up the heel's reach (and on its toes, the toes'), so the foot pivots on the floor.
  const pivot = (pitch: number) => Math.max(0, Math.sin(pitch)) * toeReach + Math.max(0, -Math.sin(pitch)) * heelReach;
  // This side's hip (root space), and how high it stands over an ankle at `at` raised `up` with the leg straight.
  const toRoot = invertRigid(rootM), hipOf = (side: Side) => apply(toRoot, position(world[J[`thigh.${side}`]]));
  const tall = (side: Side, at: V3, up: number) => {
    const hip = hipOf(side);
    return at[1] + up + Math.sqrt(Math.max(0, L * L - (hip[0] - at[0]) ** 2 - (hip[2] - at[2]) ** 2)) - hip[1];
  };
  if ((stride || march) && walking) {
    // The hips ride on the planted legs: no higher than lets every planted foot reach the floor (a pushing one flat),
    // and, over a heel just struck ahead, no lower than its knee's softest (SOFT), so the strike reads as a step and
    // not a lunge. But with both feet down they dip at least BOB (and what the neck takes up) under their height
    // mid-stance, so no walk glides: that height the stance leg's, straight from a hip the roll lifts to a foot drawn
    // in toward the line (`track`).
    const planted = feet.filter(f => f.planted), soft = SOFT * k;
    const room = Math.min(Infinity, ...planted.map(f => tall(f.side, f.at, f.pitch > 0 ? 0 : pivot(f.pitch))));
    const want = Math.max(0, ...planted.filter(f => f.pitch <= 0 && f.at[2] > hipOf(f.side)[2]).map(f => tall(f.side, f.at, pivot(f.pitch)) - soft));
    const top = -Math.max(gait.crouch, (g.hips * (1 - gait.track) + gait.sway) ** 2 / (2 * L) + g.hips * Math.sin(gait.hipRoll) + 0.004 * L);
    const dip = top - 1.1 * BOB / (1 - headLevel);
    let dy = Number.isFinite(room) ? Math.min(room, want) : 0;
    if (planted.length > 1) dy = Math.min(dy, dip - pose.shift[J.pelvis][1]);
    if (dy) { pose.shift[J.pelvis][1] += dy; pose.shift[J.neck][1] -= dy * (walking ? headLevel : 0); world = fk(s, pose); }
    // A foot pushing off lifts its heel only so far as its leg still reaches straight: the trailing knee stays long.
    for (const f of feet) if (f.planted && f.pitch > 0) f.pitch = Math.min(f.pitch, Math.asin(Math.min(1, Math.max(0, tall(f.side, f.at, 0)) / toeReach)));
  }
  for (const f of feet) {
    const ankle = apply(rootM, [f.at[0], f.at[1] + (stand ? 0 : pivot(f.pitch)), f.at[2]]);
    // Feet point where the body does (a stand's turned out), pitched by their roll.
    const footTurn = qmat(qmul(euler(0, st.yaw + f.turn, 0), euler(f.pitch, 0, 0)));
    twoBoneIK(s, pose, world, J[`thigh.${f.side}`], J[`shin.${f.side}`], J[`foot.${f.side}`], ankle, forwardWorld, 1, footTurn);
  }
  world = fk(s, pose);
  // ─── Action: the reach, an arm IK target ───
  if (reaching && st.action) {
    const side = st.action.side, x = sideSign(side);
    const rest = apply(world[J[`hand.${side}`]], [0, 0, 0]);
    const target = apply(rootM, [x * g.shoulders * 0.8, s.shoulderY - 0.18 * k, 0.5 * k]);
    const hand = lerp3(rest, target, reaching);
    const pole = applyDir(rootM, [x * 0.7, -0.5, -0.5]);
    twoBoneIK(s, pose, world, J[`upperArm.${side}`], J[`foreArm.${side}`], J[`hand.${side}`], hand, pole, -1);
    world = fk(s, pose);
  }
  // ─── Action: the flinch, both hands up before the face, elbows down and out ───
  if (flinch) {
    for (const side of ['L', 'R'] as const) {
      const x = sideSign(side), rest = apply(world[J[`hand.${side}`]], [0, 0, 0]);
      const target = apply(rootM, [x * 0.06 * k, s.chinY + 0.1 * k, 0.21 * k]);
      twoBoneIK(s, pose, world, J[`upperArm.${side}`], J[`foreArm.${side}`], J[`hand.${side}`], lerp3(rest, target, flinch), applyDir(rootM, [x * 0.5, -1, 0.1]), -1);
      world = fk(s, pose);
    }
  }
  // ─── The walk's level: the sway across the body has depth in a turned view, which the camera's pitch shows as height,
  // so one step would ride a texel lower than the other (a limp). The neck takes that back, so both steps match ───
  if (walking && st.pitch) {
    const x = apply(invertRigid(rootM), position(world[J.head]))[0];
    pose.shift[J.neck][1] -= x * Math.sin(st.view ?? st.yaw) * Math.tan(st.pitch);
    world = fk(s, pose);
  }
  return { pose, world: fk(s, pose) };
}
/** The hand's world turn for a hold in a joint's space `space`: its euler turn, or its aim (fingers along the hand's −y,
 * the palm on its inner side: −x for the left hand, +x for the right). */
function handTurn(space: M, hold: Hold): number[] {
  const r = space.slice(0, 9);
  if (!hold.aim) return qmat(qmul(matq(r), matq(qmat(euler(...hold.turn)))));
  const y = scale(normalize(hold.aim[0]), -1), palm = normalize(hold.aim[1]), x0 = scale(palm, hold.side === 'L' ? -1 : 1);
  const x = normalize(sub(x0, scale(y, dot(x0, y)))), z = cross(x, y), b = basis(x, y, z);
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = r[i * 3] * b[j] + r[i * 3 + 1] * b[3 + j] + r[i * 3 + 2] * b[6 + j];
  return o;
}
/** A hold: rewrites only its side's upper arm, forearm and hand the hand in its joint's space (the chest's). */
function applyHold(s: Skeleton, evaluated: Evaluated, hold: Hold): Evaluated {
  const pose = clonePose(evaluated.pose);
  const space = evaluated.world[hold.in ?? J.chest];
  const target = apply(space, hold.hand);
  twoBoneIK(s, pose, evaluated.world, J[`upperArm.${hold.side}`], J[`foreArm.${hold.side}`], J[`hand.${hold.side}`], target, applyDir(space, hold.pole), -1, handTurn(space, hold));
  // A full FK again: the other joints come out equal because nothing upstream of them changed (the test checks it).
  return { pose, world: fk(s, pose) };
}
/** The pose: the base, then a stand's placed hands (on the body's own surface unless placed already), then the item's hold. */
export function evaluate(s: Skeleton, gait: Gait, st: MotionState): Evaluated {
  let out = base(s, gait, st);
  const standing = !st.moving && !(st.shuffle > 0);
  for (const hold of standing ? st.holds ?? (st.stand ? standHolds(s, st.stand) : []) : []) out = applyHold(s, out, hold);
  return st.hold ? applyHold(s, out, st.hold) : out;
}
export type { Q };
