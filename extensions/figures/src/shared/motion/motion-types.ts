import type { Pose, Side } from '../body/rig'
import type { M, V3 } from '../math/math'
/**
 * Procedural motion: every layer is a pure function of the figure's parameters and the (stepped) time,
 * so a frame is reproducible and the hold can replace one arm without touching anything else.
 *
 * Layers, in order: pelvis and torso (walk or stand, lean, breath, sway), head (stabilise, tilt, turn lead, twitch), legs
 * (foot paths, or a stand's feet → IK), arms (swing, a hang, or an action's IK), then the stand's hand places and the
 * hold, last.
 */
export interface Gait {
  /** Seconds per two-step cycle, and the speed it is tuned for. */
  cycle: number
  speed: number
  /** Foot travel (front to back) over a stance, the stance's share of the cycle, and the swing foot's lift. */
  stride: number
  duty: number
  lift: number
  /** Pelvis bob and drop while walking, sideways sway, yaw and roll with the stride. */
  bob: number
  crouch: number
  sway: number
  hipYaw: number
  hipRoll: number
  /** How much of the hips' yaw the chest turns back; forward lean while walking (rad). */
  chestCounter: number
  lean: number
  /** Arm swing (rad), how far out the arms hang, the elbow's bend at rest and in the swing, and the swing's lag (cycles). */
  armSwing: number
  armOut: number
  elbow: number
  elbowSwing: number
  armLag: number
  /** 0–1: the neck takes up the pelvis bob (a head that glides level), and cancels the chest's turn. */
  headLevel: number
  headStabilize: number
  /** 0–1: the swing foot stays low with its toes down (a drag). Feet set this far apart (fraction of hip width). */
  drag: number
  track: number
  /** Poses per second for idle, turns and actions; poses per walk cycle. */
  poseRate: number
  walkPoses: number
  /** Turn speed (rad per pose step) and how far the head leads the body (rad). */
  turnRate: number
  headLead: number
  /** A head twitch: its size (rad) and how often (s); 0 for none. */
  twitch?: number
  twitchEvery?: number
  /** Idle: breath (rad), weight shift (m), and their periods (s). */
  breath: number
  breathPeriod: number
  shift: number
  shiftPeriod: number
  /** Idle loops at this many seconds (its breath, shift and twitches tile it), so idle poses repeat and come from the
   * figure's cell cache; left out, an idle of breath alone loops at the breath. */
  idleLoop?: number
  /** How many poses the idle holds across its loop (a pixel artist's few idle frames); left out, one a pose step. */
  idlePoses?: number
  /** Whether the feet shuffle through a turn on the spot (false: a pivot on the spot). */
  shuffle?: boolean
  /** How much of the torso's forward bend the arms take back so they hang plumb (0.75 for the Porter: the elbow bend carries the hands on forward); 0 by default. */
  plumb?: number
  /** Seconds a reach takes, out and back. */
  reach: number
  /** Standing: weight on one leg (hip shift, m), that foot's lead (m), the arms' forward hang and extra elbow bend over
   * `elbow` (rad; unless `standElbow` sets the bend whole). */
  stance: number
  stanceLead: number
  hang: number
  idleElbow: number
  /** Standing, the arms out from the body (rad), in place of `armOut`: a gait at ease hangs them close. Left out, the
   * walk's `armOut` (a stiff or flared gait keeps its own). */
  standOut?: number
  /** Standing, the elbow's whole bend (rad; the far arm's three quarters of it), in place of `elbow` + `idleElbow`: a
   * relaxed arm only softens at the elbow. */
  standElbow?: number
  /** Walking, the shoulders' roll against the hips' (a share of it): the chest tips down on the side the hips rise. */
  shoulderRoll?: number
  /** The heel strike's toes up and the push-off's heel up (rad); 0.22 and 0.5 by default. */
  heel?: number
  push?: number
  /** 0 a smooth bob … 1 a bounce: the body springs up off each strike and rides high through the stance. */
  spring?: number
  /** The chin's lift (rad) walking and standing: an attitude. */
  chin?: number
}
/** A held item's arm pose: the hand's place and turn in the chest's space or in the space of the joint `in`;
 * `aim` sets the hand's turn by where its fingers point and its palm faces instead. A stand's placed hand names the
 * opening it went to (`anchor`). */
export interface Hold {
  side: Side
  hand: V3
  turn: [pitch: number, yaw: number, roll: number]
  pole: V3
  in?: number
  aim?: [fingers: V3, palm: V3]
  anchor?: AnchorKind
}
/**
 * A stand with attitude (a lookbook's pose, or the idle's relaxed one): the weight on one leg, the hips shifted over it
 * and rolled up on its side, the free knee soft, the chest and the head turned against the hips, each hand placed.
 */
export interface Stand {
  /** What the stand is, for the library (library/poses.json). */
  about?: string
  /** The stands to try instead, in order, where this one's hands find no opening on the outfit or it would not read
   * (an arm lost against a top of its own colour, no air between an arm and the body, the pendant covered). */
  fallback?: string[]
  /** The leg the weight is on. */
  weight: Side
  /** The hips: shifted over the weight leg (m at k 1), rolled up on its side and turned (+ toward the figure's left), rad. */
  shift: number
  roll: number
  turn?: number
  /** The weight foot drawn in under the body (0 under its hip … 1 on the middle line; 0.25 by default), turned out (rad). */
  under?: number
  splay?: number
  /** The free foot: forward and out (m at k 1), its toes turned out and its heel raised (rad). */
  free: [forward: number, out: number, splay?: number, heel?: number]
  /** The chest: its roll against the hips (+ drops the shoulder over the weight leg), turn and pitch (back negative). */
  chest?: [roll: number, yaw: number, pitch: number]
  /** The head on the body: turn (+ toward its left), roll (+ toward its right shoulder) and nod (chin up negative). */
  head?: [yaw: number, roll: number, pitch: number]
  /** Each hand: a place (the hip, a pocket) or how it hangs; left out, the gait's idle hang. */
  hands?: Partial<Record<Side, HandPlace | Hang>>
}
/** A hanging arm: how far out from the body and the elbow's bend (rad), and swung forward (+) or back. */
export interface Hang {
  out: number
  bend: number
  swing?: number
}
/**
 * A hand placed in a stand: on the hip (akimbo), down in a front pocket at the hip's side, the thumb hooked into a front
 * pocket's mouth with the hand outside it, resting on a thigh (cargo) pocket, in a belly (kangaroo) pocket, or in a
 * jacket's pocket. Each names the opening it wants first
 * (CHAIN): the hand goes to the first one the dressed figure offers (`Anchor`), so a pose never pushes a hand into a
 * garment with no pocket there. `nudge` moves it (m at k 1: x outward, y up, z forward) and `elbow` swings the elbow out
 * (+) or in.
 */
export interface HandPlace {
  at: 'hip' | 'frontPocket' | 'thumbHook' | 'thighPocket' | 'bellyPocket' | 'jacketPocket' | 'crossed'
  nudge?: V3
  elbow?: number
}
/**
 * Where a hand can go on a dressed figure: a pocket's mouth, a hem's side, the hip. `at` the opening's centre in rest
 * figure space (as the garments' parts are built), riding `bone`; `open` the unit direction a hand goes into it. The
 * garments publish theirs in this shape (as look.anchors; base's bare body publishes none, so a hand finds the hip, and
 * a fork's wardrobe publishes the pockets and hems), and the poses resolve against those.
 */
export interface Anchor {
  kind: 'bellyPocket' | 'frontPocket' | 'thighPocket' | 'jacketPocket' | 'hem' | 'hip' | 'pendant'
  side?: Side
  bone: number
  at: V3
  open: V3
}
export type AnchorKind = Anchor['kind']
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
}
/** How far out from `origin` along `dir` (rest figure space) the dressed figure's outermost surface lies, or 0. */
export type Surface = (origin: V3, dir: V3) => number
export interface MotionState {
  /** Stepped seconds, for idle, twitches and actions. */
  t: number
  moving: boolean
  /** Walk phase over a two-step cycle, [0, 1). */
  phase: number
  /** Body facing (rad; 0 faces +z) and the head's lead over it. */
  yaw: number
  headYaw: number
  /** Turning on the spot: a short shuffle, its own phase. */
  shuffle: number
  /** The sprite cheat: the head tips up toward the camera by this much (rad), so a face reads from 30° above; only as
   * far as the face turns to the camera (`view`), so a profile or a back is never tipped back. */
  lookUp?: number
  /** The camera's bearing round the figure, against its facing (rad; 0 the figure faces it), where it differs from `yaw`
   * (a made pose turned to the view afterwards), and its pitch down (rad), so the walk's sway can be kept off the
   * head's height on screen. */
  view?: number
  pitch?: number
  action?: { id: ActionId; t: number; side: Side } | null
  /** The hair's swing (rad), from the figure's spring: pitch back and forth, roll side to side. */
  hair?: { pitch: number; roll: number } | null
  hold?: Hold | null
  /** Standing: the stand (the gait's relaxed one when left out), and its hands' holds if already placed (`standHolds`). */
  stand?: Stand | null
  holds?: Hold[] | null
  /** The least each arm (L, R) hangs out from the body (rad) to clear the dressed figure (`clearance`). */
  clear?: [number, number] | null
  /** Walking, the way the feet travel against the body's facing (rad, + toward its left): a strafe or a step back. Left
   * out, straight ahead. */
  heading?: number
  /** Walking, the stride's share (0 steps in place, marching; 1 the gait's own). Left out, the gait's own. */
  stride?: number
}
export interface Evaluated {
  pose: Pose
  world: M[]
}
/**
 * The actions a figure plays itself: the reach, and the flinch (both forearms up before the face, the head ducked and
 * turned away, half a step back). Each runs from its own start for as long as the caller holds it.
 */
export type ActionId = 'reach' | 'flinch'
