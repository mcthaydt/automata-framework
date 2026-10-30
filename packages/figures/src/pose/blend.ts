// blend (M3 spec §4.4.3): a pose between two. Positions, weights and pole directions lerp; rotations (an
// effector's `rot`, an fk joint) slerp as quaternions and are read back as Euler degrees; the root's yaw turns
// the short way round. At t = 0 and t = 1 the poses come back as written (an Euler triple has more than one
// spelling of a turn, so the ends are not recomputed); t is clamped to [0, 1].
//
// A pose names only what it sets, so a handle only one pose names blends against the layers below it, as
// §4.4.5 step 3 says for a channel only one clip owns: it keeps its targets and its weight (1 when left out)
// is scaled by that pose's share, 1 − t for a and t for b, which is what `EffectorTarget.weight` means
// ("blending from the base pose"). A pole one pose leaves out is that limb's default pole; an fk joint or a
// root field one leaves out is zero. A field only one of two named handles sets (a `rot` in one) is held from
// that one: a handle's weight covers all its fields, so the field cannot fade alone, and it drops to the layers
// below when t reaches the pose that lacks it. Clips warn about such neighbouring keys (`clipWarnings`). A
// channel in chest space on one side and root space on the other (a pole one pose leaves out is its root-space
// default) is blended in root space through the chest frame the caller passes (pose-space.ts); without one it is
// refused, naming the channel.

import { lerp, lerp3 } from '../math/math'
import { JOINTS, type Joint } from '../rig/rig'
import { LIMB_IDS, LIMBS } from '../solve/limbs'
import { degrees, eulerDegrees, eulerOf, slerp } from '../solve/rotation'
import type { EffectorId, EffectorTarget, PoleId, PoleTarget, Vec3 } from '../solve/targets'
import type { PoseDef } from './pose.schema'
import { inOneSpace, type SpaceContext } from './pose-space'
import { EFFECTOR_IDS, POLE_IDS } from './pose-spelling'

const ZERO: Vec3 = [0, 0, 0]
/** `n`, with -0 written as 0 (a lerp of zeros can give -0, which the canonical spelling never writes). */
const plain = (n: number): number => (n === 0 ? 0 : n)
const plain3 = (v: readonly number[]): Vec3 => [plain(v[0] ?? 0), plain(v[1] ?? 0), plain(v[2] ?? 0)]

/** Euler degrees a to b by slerp of their quaternions. */
function turn(a: Vec3, b: Vec3, t: number): Vec3 {
  const [pitch, yaw, roll] = eulerOf(slerp(eulerDegrees(a), eulerDegrees(b), t))
  return plain3([degrees(pitch), degrees(yaw), degrees(roll)])
}
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => plain3(lerp3([...a], [...b], t))
/** Both, blended by `by`; the one there is, held; neither, undefined. */
function either<V>(a: V | undefined, b: V | undefined, by: (a: V, b: V) => V): V | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return by(a, b)
}

/** A weight stays in 0..1, even where an overshooting ease takes t past the ends (`blendAt`). */
const weightOf = (w: number): number => plain(Math.min(1, Math.max(0, w)))
const fade = (target: EffectorTarget, share: number): EffectorTarget => ({
  ...target,
  weight: weightOf((target.weight ?? 1) * share),
})

function blendTarget(
  id: EffectorId,
  a: EffectorTarget | undefined,
  b: EffectorTarget | undefined,
  t: number,
) {
  if (!a) return b && fade(b, t)
  if (!b) return fade(a, 1 - t)
  const pos = either(a.pos, b.pos, (x, y) => mix(x, y, t))
  const rot = either(a.rot, b.rot, (x, y) => turn(x, y, t))
  const weight =
    a.weight === undefined && b.weight === undefined
      ? undefined
      : weightOf(lerp(a.weight ?? 1, b.weight ?? 1, t))
  return {
    ...(pos ? { pos } : {}),
    ...(rot ? { rot } : {}),
    ...(a.space ? { space: a.space } : {}),
    ...(weight === undefined ? {} : { weight }),
  }
}

/** The default pole of each pole id (the limb's, in root space). */
const DEFAULT_POLE: Partial<Record<PoleId, PoleTarget>> = {}
for (const limb of LIMB_IDS) DEFAULT_POLE[LIMBS[limb].pole] = { dir: LIMBS[limb].defaultPole }

function blendPole(id: PoleId, a: PoleTarget | undefined, b: PoleTarget | undefined, t: number) {
  const fallback = DEFAULT_POLE[id] ?? { dir: ZERO }
  const [x, y] = [a ?? fallback, b ?? fallback]
  return { dir: mix(x.dir, y.dir, t), ...(x.space ? { space: x.space } : {}) }
}

/** The yaw from a to b in degrees, the short way round. */
function yawBetween(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return plain(a + d * t)
}

/**
 * `a` and `b` blended at `t` (0 is a, 1 is b). A channel in chest space on one side and root space on the
 * other is blended in root space through `context.chest` (pose-space.ts); without it, a RangeError names it.
 */
export function blend(a: PoseDef, b: PoseDef, t: number, context: SpaceContext = {}): PoseDef {
  if (Number.isNaN(t)) throw new RangeError('blend: t is not a number')
  if (t <= 0) return a
  if (t >= 1) return b
  return blendAt(a, b, t, context)
}

/**
 * `blend` without the clamp: `t` outside 0..1 extrapolates positions, turns and pole directions along the same
 * lines (an ease that overshoots its key and settles back, §4.4.4's Bézier eases); weights stay in 0..1. At
 * exactly 0 and 1 the poses come back as written. The clip sampler uses it.
 */
export function blendAt(a: PoseDef, b: PoseDef, t: number, context: SpaceContext = {}): PoseDef {
  if (!Number.isFinite(t)) throw new RangeError(`blendAt: t ${t} is not a finite number`)
  if (t === 0) return a
  if (t === 1) return b
  return blendInOneSpace(...inOneSpace(a, b, context, 'in the two poses'), t)
}

/** `a` and `b`, whose shared channels agree on their space, blended at `t`. */
function blendInOneSpace(a: PoseDef, b: PoseDef, t: number): PoseDef {
  const effectors: Partial<Record<EffectorId, EffectorTarget>> = {}
  for (const id of EFFECTOR_IDS) {
    const target = blendTarget(id, a.effectors[id], b.effectors[id], t)
    if (target) effectors[id] = target
  }
  const poles: Partial<Record<PoleId, PoleTarget>> = {}
  for (const id of POLE_IDS)
    if (a.poles?.[id] || b.poles?.[id]) poles[id] = blendPole(id, a.poles?.[id], b.poles?.[id], t)
  const fk: Partial<Record<Joint, Vec3>> = {}
  for (const joint of JOINTS) {
    const [x, y] = [a.fk?.[joint], b.fk?.[joint]]
    if (x || y) fk[joint] = turn(x ?? ZERO, y ?? ZERO, t)
  }
  const [ra, rb] = [a.root, b.root]
  const pos: Vec3 | undefined = ra?.pos || rb?.pos ? mix(ra?.pos ?? ZERO, rb?.pos ?? ZERO, t) : undefined
  const yaw =
    ra?.yaw !== undefined || rb?.yaw !== undefined ? yawBetween(ra?.yaw ?? 0, rb?.yaw ?? 0, t) : undefined
  return {
    effectors,
    ...(Object.keys(poles).length > 0 ? { poles } : {}),
    ...(Object.keys(fk).length > 0 ? { fk } : {}),
    ...(ra || rb ? { root: { ...(pos ? { pos } : {}), ...(yaw === undefined ? {} : { yaw }) } } : {}),
  }
}
