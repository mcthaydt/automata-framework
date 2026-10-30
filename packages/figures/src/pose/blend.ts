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
// that one. A handle both name in different spaces is refused: converting needs the chest frame of an
// evaluated pose, which the clip sampler has (§4.4.4) and a pose does not.

import { lerp, lerp3 } from '../math/math'
import { JOINTS, type Joint } from '../rig/rig'
import { LIMB_IDS, LIMBS } from '../solve/limbs'
import { degrees, eulerDegrees, eulerOf, slerp } from '../solve/rotation'
import type { EffectorId, EffectorTarget, PoleId, PoleTarget, Space, Vec3 } from '../solve/targets'
import type { PoseDef } from './pose.schema'
import { EFFECTOR_IDS, POLE_IDS } from './pose-spelling'

const ZERO: Vec3 = [0, 0, 0]

/** Euler degrees a to b by slerp of their quaternions. */
function turn(a: Vec3, b: Vec3, t: number): Vec3 {
  const [pitch, yaw, roll] = eulerOf(slerp(eulerDegrees(a), eulerDegrees(b), t))
  return [degrees(pitch), degrees(yaw), degrees(roll)]
}
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => lerp3([...a], [...b], t)
/** Both, blended by `by`; the one there is, held; neither, undefined. */
function either<V>(a: V | undefined, b: V | undefined, by: (a: V, b: V) => V): V | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return by(a, b)
}

function sameSpace(id: string, a: Space | undefined, b: Space | undefined): void {
  const [x, y] = [a ?? 'root', b ?? 'root']
  if (x !== y)
    throw new RangeError(
      `${id} is in ${x} space in one pose and ${y} space in the other; convert both to one space before blending`,
    )
}

const fade = (target: EffectorTarget, share: number): EffectorTarget => ({
  ...target,
  weight: (target.weight ?? 1) * share,
})

function blendTarget(
  id: EffectorId,
  a: EffectorTarget | undefined,
  b: EffectorTarget | undefined,
  t: number,
) {
  if (!a) return b && fade(b, t)
  if (!b) return fade(a, 1 - t)
  sameSpace(id, a.space, b.space)
  const pos = either(a.pos, b.pos, (x, y) => mix(x, y, t))
  const rot = either(a.rot, b.rot, (x, y) => turn(x, y, t))
  const weight =
    a.weight === undefined && b.weight === undefined ? undefined : lerp(a.weight ?? 1, b.weight ?? 1, t)
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
  sameSpace(id, x.space, y.space)
  return { dir: mix(x.dir, y.dir, t), ...(x.space ? { space: x.space } : {}) }
}

/** The yaw from a to b in degrees, the short way round. */
function yawBetween(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return a + d * t
}

/** `a` and `b` blended at `t` (0 is a, 1 is b). */
export function blend(a: PoseDef, b: PoseDef, t: number): PoseDef {
  if (Number.isNaN(t)) throw new RangeError('blend: t is not a number')
  if (t <= 0) return a
  if (t >= 1) return b
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
