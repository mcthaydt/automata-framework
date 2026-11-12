// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until the strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) replace each with a check

import { type Part, reach } from '../body/parts'
import { J, type Side, type Skeleton } from '../body/rig'
import { add, normalize, scale, smooth, sub, type V3 } from '../math/math'
import {
  type Anchor,
  type AnchorKind,
  CHAIN,
  type Gait,
  type HandPlace,
  type Hold,
  type Stand,
  type Surface,
} from './motion-types'
/** The most the hips turn either way over a stride (rad): with the chest's counter-turn the figure stays in its octant. */
export const OCTANT = 0.1
/** Walking, the chin a touch down (rad), whatever the gait's lift. */
export const NOD = 0.05
/** The least the head rises and falls over a step (m): a texel at the brand kit's density (36.9 per metre), so no walk
 * glides. */
export const BOB = 0.03
const frac = (v: number) => v - Math.floor(v)
export const sideSign = (s: Side) => (s === 'L' ? 1 : -1)
/** The heel-to-toe roll: toes up as the heel strikes (rad), and the heel up as the toes push off (the gait's own, else these). */
const HEEL_ = 0.22,
  PUSH_ = 0.35
/** The most the toes point down (rad), pushing off or in the swing: a foot pitched further reads, at sprite size, as a
 * kneel. */
const TOE_DOWN = 0.26
/** Walking, the forearm comes no further forward of plumb than FORE (rad), so the swing reads as an arm, not a chop; and
 * the wrist lets the hand hang back by WRIST of the forearm's angle, as a relaxed hand does. */
export const FORE = 0.8,
  WRIST = 0.45
/** Walking, the share of the arm's swing a bulky sleeve (one needing 0.4 rad of clearance) gives up, and the share of
 * its clearance an arm swung to either end of its swing gives back. */
export const SWING_BULK = 0.3,
  CLOSE = 0.55
/** The leading knee's least bend as its heel strikes, as the hips' drop over a straight leg (m at k 1): about 14°. */
export const SOFT = 0.006
/**
 * One foot's ankle offset at foot phase f: z forward and y up (its lift off the floor), its pitch (toes down positive),
 * and whether it is planted. The foot rolls as a walker's does: it lands on its heel with the toes up, flattens, peels
 * off from the heel to push on the toes, and swings through, level a third of the way, to land on the heel again. The path
 * sits back by half the reach the stance's overlap gives the leading foot over the trailing one, so at the strike both
 * legs run long, and the swing takes the foot forward from the off so its shin leaves the floor rather than trailing on it.
 */
export function footPath(
  f: number,
  g: Gait,
  stride: number,
  lift: number,
): [number, number, number, boolean] {
  const k = frac(f),
    roll = 1 - g.drag,
    HEEL = g.heel ?? HEEL_,
    PUSH = Math.min(g.push ?? PUSH_, TOE_DOWN)
  const back = (stride * (1 - 0.5 / g.duty)) / 4
  if (k < g.duty) {
    const u = k / g.duty
    const pitch =
      roll * (u < 0.18 ? -HEEL * (1 - smooth(u / 0.18)) : u > 0.7 ? PUSH * smooth((u - 0.7) / 0.3) : 0)
    return [stride / 2 - stride * u - back, 0, pitch, true]
  }
  // The swing: forward with an eased arc, from the push-off's toes down, level a third of the way, to the strike's toes up.
  const s = (k - g.duty) / (1 - g.duty)
  const pitch =
    roll * (PUSH * (1 - smooth(Math.min(1, s / 0.3))) - HEEL * smooth(Math.max(0, (s - 0.5) / 0.5))) +
    g.drag * 0.35 * Math.sin(Math.PI * s)
  return [
    -stride / 2 - back + (stride * (smooth(s) + s)) / 2,
    lift * Math.sin(Math.PI * s) * (1 - 0.7 * g.drag),
    Math.min(pitch, TOE_DOWN),
    false,
  ]
}
/** The reach's envelope over its duration: out, hold, back. */
export function reachEnvelope(t: number, duration: number) {
  const k = t / duration
  if (k <= 0 || k >= 1) return 0
  return k < 0.35 ? smooth(k / 0.35) : k < 0.72 ? 1 : smooth((1 - k) / 0.28)
}
/** The idle's stand from the gait: the weight a little over the right leg, the left foot beside it, the arms hanging. */
export const relaxed = (gait: Gait): Stand => ({
  // A plain, relaxed stand: a trace of contrapposto (the hip a little out over the weight leg and rolled up, the shoulder
  // over it dropped a sixteenth as far against it), the free foot a quarter as far ahead as the gait sets it, turned out a
  // touch and flat, its heel down.
  weight: 'R',
  shift: gait.stance * RELAX,
  roll: gait.stance * 1.4 * RELAX,
  under: 0.25,
  free: [gait.stanceLead * 0.25, gait.stance ? 0.01 : 0, gait.stance ? 0.11 : 0, 0],
  chest: [gait.stance * 0.3 * RELAX, 0, 0],
})
/** How much of the gait's stance the relaxed stand leans into its weight leg: a quarter of what a posed contrapposto does. */
const RELAX = 0.4
/**
 * How far the neck slides back (m, × the figure's `k`) in any stand, carrying the head with it: over the shoulders, as the
 * plumb line through the ear and the shoulder's tip has it. A slide, not a rotation: the neck is a rigid part whose bottom
 * ring sits below its joint, so rotating it back swings that ring forward through the collar; a slide swings nothing and
 * keeps the face's angle.
 */
export const STAND_SLIDE = 0.03
/** How much the chest lifts (rad) in any stand, standing the back up; the head takes it back so the face stays level. */
export const STAND_LIFT = 0.02
/**
 * The openings any body offers a hand, on `surface` (the dressed figure's outermost; with none, the body's own reach):
 * each found from a point inside the body looking out along a direction to the surface there. The hip above its crest
 * (akimbo's), a front pocket's slanted mouth at the hip's side-front, a thigh pocket's flap on the thigh's side-front and
 * a belly pocket's side openings. A pose given no anchors uses these; a dressed figure's come from its garments
 * (look.anchors), and a hand whose chain finds none there ends on the body's hip.
 */
export function openings(s: Skeleton, surface?: Surface): Anchor[] {
  const g = s.genes,
    k = g.height / 1.62,
    hip = s.hipY,
    b = g.build,
    out: Anchor[] = []
  for (const side of ['L', 'R'] as const) {
    const x = sideSign(side)
    const on = (kind: AnchorKind, bone: number, from: V3, dir: V3, body: number, open: V3): Anchor => {
      const d = normalize(dir),
        r = surface?.(from, d) || body
      return { kind, side, bone, at: add(from, scale(d, r)), open: normalize(open) }
    }
    out.push(
      on(
        'hip',
        J.pelvis,
        [x * g.hips * 0.3, hip + 0.075 * k, -0.012 * k],
        [x, 0, -0.25],
        g.hips + 0.055 * k * b,
        [-x, 0, 0.25],
      ),
      on(
        'frontPocket',
        J.pelvis,
        [x * g.hips * 0.95, hip - 0.05 * k, 0.01 * k],
        [x * 0.8, -0.1, 0.6],
        0.09 * k * b,
        [-x * 0.2, -1, -0.15],
      ),
      on(
        'thighPocket',
        J[`thigh.${side}`],
        [x * g.hips, hip - 0.3 * s.thigh, 0.012 * k],
        [x, 0, 0.3],
        0.07 * k * b,
        [0, -1, 0],
      ),
      on('bellyPocket', J.pelvis, [x * 0.1 * k, hip + 0.11 * k, 0], [x * 0.35, 0, 1], 0.1 * k * b, [
        -x,
        -0.1,
        -0.3,
      ]),
    )
  }
  return out
}
/** The hand's grip at an opening: `in` it (a pocket), its thumb hooked in with the hand outside (`hook`), or the heel
 * of the hand on it (`on`, akimbo). */
type Grip = 'in' | 'hook' | 'on'
/** A hand that drops to an opening comes to it with its forearm no further from plumb than PLUMB (rad); an opening too
 * high for the arm's length to fall to (it would bend the elbow up past that) gives way to the chain's next. A jacket's
 * slash pocket takes the hand in at a slant, the forearm forward from an elbow out and back, up to SLASH. */
const PLUMB = 0.7,
  SLASH = 1.35
/** A hand at the front of the hips (a pocket's mouth, a thumb hooked at a hem) keeps its wrist at least FLY of the
 * hip's half-width out from the middle, so it never reads as a hand at the fly. */
const FLY = 0.5
/** The top of a forearm folded across the body lies this far (m at k 1) under what it must not cover: its round and a
 * texel's air. */
const FOREARM = 0.09
/** The tightest an elbow bends to place a hand, as the shoulder-to-wrist span's share of the arm's length (about 95°). */
const BENT = 0.74
/**
 * A hand place (HandPlace) into a hold on this skeleton: the first opening of the place's CHAIN on its side that the arm
 * reaches, and falls to plumb where the hand drops into it, with the grip it takes there; null where the chain ends
 * hanging. The hold rides the opening's bone. In a pocket the hand goes in along `open`, the palm to the body, as deep
 * as the arm is long for it (to the wrist, or past it for a long arm, so the arm hangs straight into the pocket rather
 * than bending its elbow up); hooked, the hand hangs flat outside the mouth or the hem; on the hip, the heel of the hand
 * above the crest with the fingers forward. The elbow goes back where the hand drops into a mouth that opens down, so
 * the forearm falls plumb to it rather than lying across the body; out and lifted for a mouth at the side.
 */
export function place(
  s: Skeleton,
  side: Side,
  p: HandPlace,
  surface?: Surface,
  anchors: Anchor[] = openings(s, surface),
): Hold | null {
  const g = s.genes,
    k = g.height / 1.62,
    x = sideSign(side),
    shoulder = s.rest[J[`upperArm.${side}`]],
    full = s.upperArm + s.foreArm,
    arm = full * 0.95
  // The place's nudge and elbow are tuned to the opening it wants first: a hand that falls back to another takes that
  // one's own.
  const tuned = (a: Anchor) => a.kind === CHAIN[p.at][0]
  // A side-less opening serves either hand, mirrored to its side.
  const ofSide = (a: Anchor): Anchor =>
    a.side || Math.sign(a.at[0]) === x || !a.at[0]
      ? a
      : { ...a, at: [-a.at[0], a.at[1], a.at[2]], open: [-a.open[0], a.open[1], a.open[2]] }
  const span = (at: V3) => Math.hypot(at[0] - shoulder[0], at[1] - shoulder[1], at[2] - shoulder[2])
  // The hips' half-width (the hip opening's reach out from the middle) and the waist's height over them.
  const hipHalf = Math.abs(
      (
        anchors.find((a) => a.kind === 'hip' && (a.side ?? side) === side) ??
        openings(s, surface).find((a) => a.kind === 'hip' && a.side === side)!
      ).at[0],
    ),
    hipTop = s.hipY + 0.16 * k
  // The forearm's lean from plumb with the wrist at `at`: the shoulder-to-wrist line's own, and the elbow's bend off it.
  const lean = (at: V3) => {
    const d = span(at),
      f = s.foreArm,
      u = s.upperArm
    return (
      Math.acos(Math.min(1, (shoulder[1] - at[1]) / d)) +
      Math.acos(Math.max(-1, Math.min(1, (f * f + d * d - u * u) / (2 * f * d))))
    )
  }
  const hold = (a: Anchor): { hold: Hold; drops: boolean; wrist: V3 } => {
    const { at, open } = a,
      rb = s.rest[a.bone],
      outward = normalize([at[0] - rb[0], 0, at[2] - rb[2]]),
      down = Math.abs(open[1]) > 0.6
    const grip: Grip =
      a.kind === 'hip'
        ? 'on'
        : a.kind === 'hem' || p.at === 'thumbHook' || p.at === 'thighPocket'
          ? 'hook'
          : 'in'
    const onCloth = (w: V3): V3 => {
      const o: V3 = [rb[0], w[1], rb[2]],
        d = sub(w, o),
        r = Math.hypot(...d),
        face = surface?.(o, scale(d, 1 / r)) ?? 0
      return face > r ? add(o, scale(d, face / r)) : w
    }
    // Into a mouth that opens down the hand goes down the cloth's face as deep as the arm still reaches (up to 6 cm).
    const into = (deep: number) => add(onCloth(add(at, [0, -deep, 0])), scale(outward, 0.004 * k))
    let deep = 0.06 * k
    while (down && deep > 0.004 * k && span(into(deep)) > arm) deep -= 0.004 * k
    // A long arm's hand slides down the mouth at the side (a belly pocket's, which runs down to the hem) or down the hip,
    // until the elbow bends no tighter than BENT: so it never folds its elbow up level with the shoulder, nor its
    // forearm up to the pocket.
    // The wrist at the mouth on the cloth's face, the hand in under it: a mouth on the front of the cloth (a kangaroo
    // pocket's, whose panel lies over the hand) takes the fingers in along it and turned in toward the body, so the
    // hand goes from sight under the cloth and only the cuff shows at the opening.
    const aside = (drop: number) => add(onCloth(add(at, [0, -drop, 0])), scale(open, -0.004 * k))
    const onHip = (drop: number) => add(onCloth(add(at, [0, -drop, 0])), scale(outward, 0.016 * k))
    let low = 0,
      drop = 0
    while (!down && grip === 'in' && low < 0.06 * k && span(aside(low)) < BENT * full) low += 0.004 * k
    while (grip === 'on' && drop < 0.1 * k && span(onHip(drop)) < BENT * full) drop += 0.005 * k
    const spec: { wrist: V3; fingers: V3; palm: V3; pole: V3 } =
      grip === 'on'
        ? { wrist: onHip(drop), fingers: [0, -0.7, 1], palm: [-x, 0, 0.1], pole: [x, 0.1, -0.9] }
        : grip === 'hook'
          ? {
              wrist: add(add(at, scale(outward, 0.02 * k)), [0, 0.012 * k, 0]),
              fingers: [x * 0.1, -1, 0.2],
              palm: scale(outward, -1),
              pole: [x * 0.3, 0, -0.95],
            }
          : {
              wrist: down ? into(deep) : aside(low),
              fingers: down ? open : normalize(add(open, scale(outward, -0.6))),
              palm: scale(outward, -1),
              pole: down ? [x * 0.3, 0, -0.95] : [x, 0.25, -0.35],
            }
    const n = (tuned(a) && p.nudge) || [0, 0, 0],
      elbow = (tuned(a) && p.elbow) || 0
    const pole = normalize(add(spec.pole, [x * elbow, 0, 0])),
      wrist = add(spec.wrist, [x * n[0] * k, n[1] * k, n[2] * k])
    if (grip !== 'on' && a.kind !== 'thighPocket' && wrist[1] < hipTop)
      wrist[0] = x * Math.max(x * wrist[0], FLY * hipHalf)
    return {
      hold: {
        side,
        in: a.bone,
        hand: sub(wrist, s.rest[a.bone]),
        turn: [0, 0, 0],
        pole,
        aim: [spec.fingers, spec.palm],
        anchor: a.kind,
      },
      drops: grip === 'hook' || (grip === 'in' && down),
      wrist,
    }
  }
  if (p.at === 'crossed') return crossed(s, side, surface, anchors)
  for (const kind of CHAIN[p.at]) {
    if (kind === 'hang') return null
    const found = anchors.filter((c) => c.kind === kind && (c.side ?? side) === side).map(ofSide)[0]
    if (!found) continue
    const h = hold(found)
    if (
      kind === 'hip' ||
      (span(h.wrist) <= arm && (!h.drops || lean(h.wrist) <= (kind === 'jacketPocket' ? SLASH : PLUMB)))
    )
      return h.hold
  }
  return hold(openings(s, surface).find((c) => c.kind === 'hip' && c.side === side)!).hold
}
/**
 * Arms crossed (CROSS): each forearm level across the front of the ribs, the right one over the left (higher and
 * forward of it), its hand on the far arm's biceps with the fingers round its back, the elbows down at the sides. The
 * forearms lie in front of the dressed figure's chest (`surface`), as far as the sleeves need, and under a pendant's
 * foot (`anchors`' pendant) by the forearm's round and a little air, so the nameplate is never behind them.
 */
function crossed(s: Skeleton, side: Side, surface?: Surface, anchors: Anchor[] = []): Hold {
  const g = s.genes,
    k = g.height / 1.62,
    x = sideSign(side),
    over = side === 'R',
    chest = s.rest[J.chest]
  const pendant = anchors.find((a) => a.kind === 'pendant'),
    under = pendant ? pendant.at[1] - FOREARM * k : Infinity
  const y = Math.min(s.chestY - 0.1 * k, under) - (over ? 0 : 0.025 * k),
    front = surface?.([0, y, 0], [0, 0, 1]) || 0.13 * k
  const wrist: V3 = [-x * g.shoulders * 0.62, y, front + (over ? 0.05 : 0.025) * k]
  return {
    side,
    in: J.chest,
    hand: sub(wrist, chest),
    turn: [0, 0, 0],
    pole: normalize([x * 0.8, -0.7, 0.25]),
    aim: [
      [-x, -0.15, -0.6],
      [0, 0, -1],
    ],
  }
}
/** The stand's placed hands as holds, at the dressed figure's openings (`anchors`) where it has them. */
export const standHolds = (s: Skeleton, stand: Stand, surface?: Surface, anchors?: Anchor[]): Hold[] =>
  (['L', 'R'] as const).flatMap((side) => {
    const h = stand.hands?.[side],
      hold = h && 'at' in h ? place(s, side, h, surface, anchors) : null
    return hold ? [hold] : []
  })
/**
 * How far out (rad) each arm (L, R) must hang for its wrist and hand to clear the dressed figure at and below the hip:
 * at each height the hand passes, the outermost surface's width there (reach on every part but the arms' and those in
 * `skip`, as a hand finds the cloth it rests on), against the hand's own round inward of the arm's axis (its cuff's, its
 * thumb's) and a little air. So the hands hang clear of whatever is widest at the hip (wide trousers, a long tee's hem)
 * on any body; a sleeve may still lie over its own top's body above, as cloth does.
 */
export function clearance(
  s: Skeleton,
  parts: Part[],
  arms: Record<Side, number>,
  skip: number[] = [],
): [number, number] {
  const g = s.genes,
    k = g.height / 1.62,
    top = s.hipY + 0.03 * k,
    air = 0.002 * k,
    MAX = 0.6
  const body = parts.filter((p) => p.group !== arms.L && p.group !== arms.R && !skip.includes(p.group))
  const clear = (side: Side) => {
    const x = sideSign(side),
      [ax, ay] = s.rest[J[`upperArm.${side}`]],
      own = parts.filter((p) => p.group === arms[side])
    // The body's width beside the arm, in 1 cm rows, its widest a little before, at and behind the middle.
    const rows = new Map<number, number>()
    const width = (y: number) => {
      const row = Math.round(y * 100)
      if (!rows.has(row))
        rows.set(
          row,
          Math.max(
            ...[-0.08, -0.04, 0, 0.04].map((z) => reach(body, s.rest, [0, row / 100, z * k], [x, 0, 0])),
          ),
        )
      return rows.get(row)!
    }
    // The arm's round inward of its axis, from the wrist down to the fingertips.
    const along = [g.arms - 0.03 * k, g.arms + 0.02 * k, g.arms + 0.06 * k, g.arms + 0.1 * k]
    const round = along.map((d) => reach(own, s.rest, [ax, ay - d, 0], [-x, 0, 0]))
    for (let out = 0; out < MAX; out += 0.01) {
      const ok = along.every((d, i) => {
        const y = ay - d * Math.cos(out)
        return y > top || Math.abs(ax) + d * Math.sin(out) - round[i] * Math.cos(out) - air >= width(y)
      })
      if (ok) return out
    }
    return MAX
  }
  return [clear('L'), clear('R')]
}
