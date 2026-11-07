// A pose's canonical spelling (M3 spec §4.4.6): one way to write each pose, so the Studio's save is stable
// and a diff shows only what changed. Numbers keep 4 decimals, rounded in decimal notation and never -0;
// defaults are left out (`space = "root"`, `weight = 1`, empty tables); keys go in the rig's order.
//
// The rounding is the editor suite's: editor-3d's codec writes numbers with 4 decimals (codec/print.ts
// `roundJsonNumber`, no -0), and the editor kit rounds in decimal notation so a half rounds as it reads
// (widgets/widget-math.ts `roundTo`). Neither is imported: `figures` is renderer-free and ships in games,
// while the editor packages are private Svelte packages, and `roundTo` is not a public export. The rule is
// mirrored here; a change to the editors' codec changes it here too.

import { stringify } from 'smol-toml'
import { JOINTS, type Joint } from '../body/rig.ts'
import type { PoseDef } from './pose.schema.ts'
import type { EffectorId, EffectorTarget, PoleId, PoleTarget, Vec3 } from './targets.ts'

const DECIMALS = 4

/** `value` with 4 decimals, rounded as its decimal spelling reads; never -0. */
export function roundPoseNumber(value: number): number {
  if (!Number.isFinite(value)) return value
  // Scale by moving the decimal point in the text, so 1.00005 (1.0000499… in binary) rounds up as it reads.
  const [mantissa = '', exponent = '0'] = String(value).split('e')
  const scaled = Math.round(Number(`${mantissa}e${Number(exponent) + DECIMALS}`))
  const [digits = '', power = '0'] = String(scaled).split('e')
  const rounded = Number(`${digits}e${Number(power) - DECIMALS}`)
  return rounded === 0 ? 0 : rounded
}

const round3 = (v: Vec3): Vec3 => [roundPoseNumber(v[0]), roundPoseNumber(v[1]), roundPoseNumber(v[2])]

// The effector and pole ids in the rig's order (solve/targets.ts); `satisfies` keeps each list complete.
const EFFECTOR_ORDER = {
  footL: 0,
  footR: 1,
  handL: 2,
  handR: 3,
  pelvis: 4,
  chest: 5,
  head: 6,
} satisfies Record<EffectorId, number>
const POLE_ORDER = { kneeL: 0, kneeR: 1, elbowL: 2, elbowR: 3 } satisfies Record<PoleId, number>
export const EFFECTOR_IDS: readonly EffectorId[] = Object.keys(EFFECTOR_ORDER) as EffectorId[]
export const POLE_IDS: readonly PoleId[] = Object.keys(POLE_ORDER) as PoleId[]

function canonicalTarget(target: EffectorTarget): EffectorTarget | undefined {
  const weight = target.weight === undefined ? 1 : roundPoseNumber(target.weight)
  const out: EffectorTarget = {
    ...(target.pos ? { pos: round3(target.pos) } : {}),
    ...(target.rot ? { rot: round3(target.rot) } : {}),
    ...(target.space === 'chest' ? { space: 'chest' as const } : {}),
    ...(weight !== 1 ? { weight } : {}),
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const canonicalPole = (pole: PoleTarget): PoleTarget => ({
  dir: round3(pole.dir),
  ...(pole.space === 'chest' ? { space: 'chest' as const } : {}),
})

/** `record`'s entries in `order`, each through `spell`, left out when it says nothing; undefined when empty. */
function ordered<K extends string, V>(
  record: Readonly<Partial<Record<K, V>>> | undefined,
  order: readonly K[],
  spell: (value: V) => V | undefined,
): Partial<Record<K, V>> | undefined {
  const out: Partial<Record<K, V>> = {}
  for (const key of order) {
    const value = record?.[key]
    const spelt = value === undefined ? undefined : spell(value)
    if (spelt !== undefined) out[key] = spelt
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** The pose as its canonical text reads back: numbers rounded, defaults and empty parts left out, keys ordered. */
export function canonicalPose(pose: PoseDef): PoseDef {
  const poles = ordered(pose.poles, POLE_IDS, canonicalPole)
  const fk = ordered<Joint, Vec3>(pose.fk, JOINTS, round3)
  const root = {
    ...(pose.root?.pos ? { pos: round3(pose.root.pos) } : {}),
    ...(pose.root?.yaw === undefined ? {} : { yaw: roundPoseNumber(pose.root.yaw) }),
  }
  return {
    ...(pose.about === undefined ? {} : { about: pose.about }),
    effectors: ordered(pose.effectors, EFFECTOR_IDS, canonicalTarget) ?? {},
    ...(poles ? { poles } : {}),
    ...(fk ? { fk } : {}),
    ...(Object.keys(root).length > 0 ? { root } : {}),
  }
}

/** The pose's canonical TOML text: what the Studio writes to `figure-poses/<id>.toml`. */
export function printPose(pose: PoseDef): string {
  return `${stringify(canonicalPose(pose)).trim()}\n`
}
