// Stands (FigureBuilder's lookbook poses as the idle): each placed hand goes to an opening the dressed figure
// offers (a pocket's mouth, a hem, the hip), trying the place's openings in order (CHAIN), so a pose never
// pushes a hand into a garment with no pocket there; a stand the outfit does not suit gives way to its
// fallbacks, and with none that suits, to the gait's relaxed stand.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) at a1f7246: src/render/figure/motion.ts (`CHAIN`,
// `Surface`, `openings`, `place`, `crossed`, `standHolds`) and src/render/figure/cast.ts (`fits`), their
// formulas and their order. Changed for AF: no `pendant` anchor (the nameplate is cut, M3.5b decision 9), so
// crossed arms keep to the chest's own height; `standFor` walks the fallbacks with `fits` alone (the source's
// hero also judged a stand's legibility as painted, a sprite test).

import type { Anchor, AnchorKind } from '../build/anchors'
import type { Built } from '../build/build'
import type { HandPlace, Stand } from '../library/stand.schema'
import { add, normalize, scale, sub, type V3 } from '../math/math'
import { GROUP } from '../parts/mesh'
import { reach } from '../parts/reach'
import { at, J, type Side, type Skeleton } from '../rig/rig'
import { sideSign } from './gait-path'
import type { ArmHold } from './motion-state'

/** Each place's openings in the order it tries them: a pocket the outfit lacks (or a longer top covers) gives
 * way to the next a hand can use there. A hand meant to sit high on the body ends on the hip, which every body
 * has; one meant to sit low ends hanging (`hang`), as a hand with nowhere to go does. */
export const CHAIN: Readonly<Record<HandPlace['at'], readonly (AnchorKind | 'hang')[]>> = {
  hip: ['hip'],
  frontPocket: ['frontPocket', 'jacketPocket', 'hem', 'hang'],
  thumbHook: ['frontPocket', 'hem', 'hang'],
  thighPocket: ['thighPocket', 'frontPocket', 'hip'],
  bellyPocket: ['bellyPocket', 'frontPocket', 'hem', 'hip'],
  jacketPocket: ['jacketPocket', 'frontPocket', 'hip'],
  // Arms crossed: no opening, the hands on each other's arms (`crossed`).
  crossed: [],
}

/** How far out from `origin` along `dir` (rest figure space) the dressed figure's outermost surface lies, or 0. */
export type Surface = (origin: V3, dir: V3) => number

/**
 * The openings any body offers a hand, on `surface` (the dressed figure's outermost; with none, the body's own
 * reach): the hip above its crest (akimbo's), a front pocket's slanted mouth at the hip's side-front, a thigh
 * pocket's flap on the thigh's side-front and a belly pocket's side openings. A dressed figure's come from its
 * garments (`Built.anchors`), and a hand whose chain finds none there ends on the body's hip.
 */
export function openings(s: Skeleton, surface?: Surface): Anchor[] {
  const g = s.genes
  const k = g.height / 1.62
  const hip = s.hipY
  const b = g.build
  const out: Anchor[] = []
  for (const side of ['L', 'R'] as const) {
    const x = sideSign(side)
    const on = (kind: AnchorKind, bone: number, from: V3, dir: V3, body: number, open: V3): Anchor => {
      const d = normalize(dir)
      const r = surface?.(from, d) || body
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

/** The hand's grip at an opening: `in` it (a pocket), its thumb hooked in with the hand outside (`hook`), or the
 * heel of the hand on it (`on`, akimbo). */
type Grip = 'in' | 'hook' | 'on'
/** A hand that drops to an opening comes to it with its forearm no further from plumb than PLUMB (rad); an
 * opening too high for the arm's length to fall to gives way to the chain's next. A jacket's slash pocket takes
 * the hand in at a slant, the forearm forward from an elbow out and back, up to SLASH. */
const PLUMB = 0.7
const SLASH = 1.35
/** A hand at the front of the hips keeps its wrist at least FLY of the hip's half-width out from the middle,
 * so it never reads as a hand at the fly. */
const FLY = 0.5
/** The tightest an elbow bends to place a hand, as the shoulder-to-wrist span's share of the arm's length (about 95°). */
const BENT = 0.74

/** The body's own hip opening on this side (every body has one). */
function bodyHip(s: Skeleton, side: Side, surface?: Surface): Anchor {
  const hip = openings(s, surface).find((a) => a.kind === 'hip' && a.side === side)
  if (!hip) throw new Error(`no hip opening on side ${side}`)
  return hip
}

/**
 * A hand place into a hold on this skeleton: the first opening of the place's CHAIN on its side that the arm
 * reaches, and falls to plumb where the hand drops into it, with the grip it takes there; null where the chain
 * ends hanging. The hold rides the opening's bone. In a pocket the hand goes in along `open`, the palm to the
 * body, as deep as the arm is long for it; hooked, the hand hangs flat outside the mouth or the hem; on the
 * hip, the heel of the hand above the crest with the fingers forward. The elbow goes back where the hand drops
 * into a mouth that opens down, so the forearm falls plumb to it; out and lifted for a mouth at the side.
 */
export function place(
  s: Skeleton,
  side: Side,
  p: HandPlace,
  surface?: Surface,
  anchors: readonly Anchor[] = openings(s, surface),
): ArmHold | null {
  const g = s.genes
  const k = g.height / 1.62
  const x = sideSign(side)
  const shoulder = at(s.rest, J[`upperArm.${side}`])
  const full = s.upperArm + s.foreArm
  const arm = full * 0.95
  // The place's nudge and elbow are tuned to the opening it wants first: a hand that falls back to another
  // takes that one's own.
  const tuned = (a: Anchor) => a.kind === CHAIN[p.at][0]
  // A side-less opening serves either hand, mirrored to its side.
  const ofSide = (a: Anchor): Anchor =>
    a.side || Math.sign(a.at[0]) === x || !a.at[0]
      ? a
      : { ...a, at: [-a.at[0], a.at[1], a.at[2]], open: [-a.open[0], a.open[1], a.open[2]] }
  const span = (w: V3) => Math.hypot(w[0] - shoulder[0], w[1] - shoulder[1], w[2] - shoulder[2])
  // The hips' half-width (the hip opening's reach out from the middle) and the waist's height over them.
  const hipHalf = Math.abs(
    (anchors.find((a) => a.kind === 'hip' && (a.side ?? side) === side) ?? bodyHip(s, side, surface)).at[0],
  )
  const hipTop = s.hipY + 0.16 * k
  // The forearm's lean from plumb with the wrist at `w`: the shoulder-to-wrist line's own, and the elbow's bend off it.
  const lean = (w: V3) => {
    const d = span(w)
    const f = s.foreArm
    const u = s.upperArm
    return (
      Math.acos(Math.min(1, (shoulder[1] - w[1]) / d)) +
      Math.acos(Math.max(-1, Math.min(1, (f * f + d * d - u * u) / (2 * f * d))))
    )
  }
  const hold = (a: Anchor): { hold: ArmHold; drops: boolean; wrist: V3 } => {
    const { at: mouth, open } = a
    const rb = at(s.rest, a.bone)
    const outward = normalize([mouth[0] - rb[0], 0, mouth[2] - rb[2]])
    const down = Math.abs(open[1]) > 0.6
    const grip: Grip =
      a.kind === 'hip'
        ? 'on'
        : a.kind === 'hem' || p.at === 'thumbHook' || p.at === 'thighPocket'
          ? 'hook'
          : 'in'
    const onCloth = (w: V3): V3 => {
      const o: V3 = [rb[0], w[1], rb[2]]
      const d = sub(w, o)
      const r = Math.hypot(...d)
      const face = surface?.(o, scale(d, 1 / r)) ?? 0
      return face > r ? add(o, scale(d, face / r)) : w
    }
    // Into a mouth that opens down the hand goes down the cloth's face as deep as the arm still reaches (up to 6 cm).
    const into = (deep: number) => add(onCloth(add(mouth, [0, -deep, 0])), scale(outward, 0.004 * k))
    let deep = 0.06 * k
    while (down && deep > 0.004 * k && span(into(deep)) > arm) deep -= 0.004 * k
    // A long arm's hand slides down the mouth at the side or down the hip, until the elbow bends no tighter
    // than BENT: so it never folds its elbow up level with the shoulder, nor its forearm up to the pocket. The
    // wrist at the mouth on the cloth's face, the hand in under it.
    const aside = (drop: number) => add(onCloth(add(mouth, [0, -drop, 0])), scale(open, -0.004 * k))
    const onHip = (drop: number) => add(onCloth(add(mouth, [0, -drop, 0])), scale(outward, 0.016 * k))
    let low = 0
    let drop = 0
    while (!down && grip === 'in' && low < 0.06 * k && span(aside(low)) < BENT * full) low += 0.004 * k
    while (grip === 'on' && drop < 0.1 * k && span(onHip(drop)) < BENT * full) drop += 0.005 * k
    const spec: { wrist: V3; fingers: V3; palm: V3; pole: V3 } =
      grip === 'on'
        ? { wrist: onHip(drop), fingers: [0, -0.7, 1], palm: [-x, 0, 0.1], pole: [x, 0.1, -0.9] }
        : grip === 'hook'
          ? {
              wrist: add(add(mouth, scale(outward, 0.02 * k)), [0, 0.012 * k, 0]),
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
    const n = (tuned(a) && p.nudge) || [0, 0, 0]
    const elbow = (tuned(a) && p.elbow) || 0
    const pole = normalize(add(spec.pole, [x * elbow, 0, 0]))
    const wrist = add(spec.wrist, [x * n[0] * k, n[1] * k, n[2] * k])
    if (grip !== 'on' && a.kind !== 'thighPocket' && wrist[1] < hipTop)
      wrist[0] = x * Math.max(x * wrist[0], FLY * hipHalf)
    return {
      hold: {
        side,
        in: a.bone,
        hand: sub(wrist, rb),
        turn: [0, 0, 0],
        pole,
        aim: [spec.fingers, spec.palm],
        anchor: a.kind,
      },
      drops: grip === 'hook' || (grip === 'in' && down),
      wrist,
    }
  }
  if (p.at === 'crossed') return crossed(s, side, surface)
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
  return hold(bodyHip(s, side, surface)).hold
}

/**
 * Arms crossed: each forearm level across the front of the ribs, the right one over the left (higher and
 * forward of it), its hand on the far arm's biceps with the fingers round its back, the elbows down at the
 * sides. The forearms lie in front of the dressed figure's chest (`surface`), as far as the sleeves need.
 */
function crossed(s: Skeleton, side: Side, surface?: Surface): ArmHold {
  const g = s.genes
  const k = g.height / 1.62
  const x = sideSign(side)
  const over = side === 'R'
  const chest = at(s.rest, J.chest)
  const y = s.chestY - 0.1 * k - (over ? 0 : 0.025 * k)
  const front = surface?.([0, y, 0], [0, 0, 1]) || 0.13 * k
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
export function standHolds(
  s: Skeleton,
  stand: Stand,
  surface?: Surface,
  anchors?: readonly Anchor[],
): ArmHold[] {
  return (['L', 'R'] as const).flatMap((side) => {
    const h = stand.hands?.[side]
    const hold = h && 'at' in h ? place(s, side, h, surface, anchors) : null
    return hold ? [hold] : []
  })
}

/** The sleeve's round at mid-forearm (in k) past which folded arms read as one mass. */
const FOLD = 0.08

/**
 * Whether a dressed figure suits a stand: its placed hands all find the opening they want first on the outfit,
 * and arms fold only in sleeves slim enough at the forearm (under FOLD) to read as two forearms across the chest.
 */
export function fits(s: Skeleton, built: Pick<Built, 'anchors' | 'parts'>, stand: Stand): boolean {
  const [ax, ay] = at(s.rest, J['upperArm.R'])
  const slim = () =>
    reach(
      built.parts.filter((p) => p.group === GROUP.armR),
      s.rest,
      [ax, ay - s.genes.arms + 0.5 * s.foreArm, 0],
      [1, 0, 0],
    ) <
    (FOLD * s.genes.height) / 1.62
  return Object.entries(stand.hands ?? {}).every(
    ([side, h]) =>
      !h ||
      !('at' in h) ||
      (h.at === 'crossed'
        ? slim()
        : built.anchors.some((a) => a.kind === CHAIN[h.at][0] && (a.side ?? side) === side)),
  )
}

/**
 * The stand a dressed figure takes for `id`: the first of it and its `fallback`s that the outfit suits, or
 * null when none does (the gait's relaxed stand).
 */
export function standFor(
  s: Skeleton,
  built: Pick<Built, 'anchors' | 'parts'>,
  id: string,
  stands: Readonly<Record<string, Stand>>,
): { readonly id: string; readonly stand: Stand } | null {
  const named = (name: string): Stand => {
    const stand = stands[name]
    if (!stand) throw new Error(`no stand ${name}`)
    return stand
  }
  for (const name of [id, ...(named(id).fallback ?? [])]) {
    const stand = named(name)
    if (fits(s, built, stand)) return { id: name, stand }
  }
  return null
}
