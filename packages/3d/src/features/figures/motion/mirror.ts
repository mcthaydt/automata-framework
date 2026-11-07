// mirror (M3 spec §4.4.3): the pose seen in a mirror through the body's middle plane (x = 0). Left and right
// swap in handle ids and fk joints; positions and pole directions negate x; an Euler turn (pitch, yaw, roll)
// keeps its pitch and negates its yaw and roll, because reflecting conjugates a rotation by S = diag(−1, 1, 1),
// which keeps a turn about x and reverses turns about y and z (the spec's "x and yaw negated" leaves roll
// out; it must flip too). The root's x and yaw negate. Negation never writes -0, so mirror(mirror(p)) is p.

import { JOINTS, type Joint } from '../body/rig.ts'
import type { PoseDef } from './pose.schema.ts'
import { EFFECTOR_IDS, POLE_IDS } from './pose-spelling.ts'
import type { EffectorTarget, PoleTarget, Vec3 } from './targets.ts'

const negate = (n: number): number => (n === 0 ? 0 : -n)
const flipX = (v: Vec3): Vec3 => [negate(v[0]), v[1], v[2]]
const flipTurn = (r: Vec3): Vec3 => [r[0], negate(r[1]), negate(r[2])]

/** Each name's other side among `names` (`handL`↔`handR`, `clavicle.L`↔`clavicle.R`); a name with none keeps itself. */
function sides<K extends string>(names: readonly K[]): (name: K) => K {
  const other = new Map<K, K>()
  for (const name of names) {
    const last = name.at(-1)
    const swapped = `${name.slice(0, -1)}${last === 'L' ? 'R' : 'L'}` as K
    if ((last === 'L' || last === 'R') && names.includes(swapped)) other.set(name, swapped)
  }
  return (name) => other.get(name) ?? name
}
const otherEffector = sides(EFFECTOR_IDS)
const otherPole = sides(POLE_IDS)
const otherJoint = sides<Joint>(JOINTS)

/** `record` with each key moved to its other side and each value mirrored. */
function swapped<K extends string, V>(
  record: Readonly<Partial<Record<K, V>>>,
  other: (key: K) => K,
  flip: (value: V) => V,
): Partial<Record<K, V>> {
  const out: Partial<Record<K, V>> = {}
  for (const [key, value] of Object.entries(record) as [K, V | undefined][])
    if (value !== undefined) out[other(key)] = flip(value)
  return out
}

const mirrorTarget = (target: EffectorTarget): EffectorTarget => ({
  ...target,
  ...(target.pos ? { pos: flipX(target.pos) } : {}),
  ...(target.rot ? { rot: flipTurn(target.rot) } : {}),
})
const mirrorPole = (pole: PoleTarget): PoleTarget => ({ ...pole, dir: flipX(pole.dir) })

/** The pose with left and right swapped, x negated, and yaw and roll negated. */
export function mirror(pose: PoseDef): PoseDef {
  const { root } = pose
  return {
    ...pose,
    effectors: swapped(pose.effectors, otherEffector, mirrorTarget),
    ...(pose.poles ? { poles: swapped(pose.poles, otherPole, mirrorPole) } : {}),
    ...(pose.fk ? { fk: swapped<Joint, Vec3>(pose.fk, otherJoint, flipTurn) } : {}),
    ...(root
      ? {
          root: {
            ...root,
            ...(root.pos ? { pos: flipX(root.pos) } : {}),
            ...(root.yaw === undefined ? {} : { yaw: negate(root.yaw) }),
          },
        }
      : {}),
  }
}
