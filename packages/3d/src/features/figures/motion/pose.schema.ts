// The pose content kind (`PoseDef`, schema `figure-pose`): a snapshot of the rig's handles,
// saved as content. It reuses the solver's handle types (solve/targets.ts), so a pose is exactly what a solve
// is asked to satisfy, plus the few joints no handle covers (`fk`) and an offset of the root.
//
// A pose names only what it sets; a handle it leaves out is left to the layers below it. Its id is its file's
// name, as a figure's is. The compile refuses: a handle, pole or joint the rig does not have, a number
// that is not finite, and a position past twice the figure's reach (pose-checks.ts).

import { z } from 'zod'
import { JOINTS, type Joint } from '../body/rig.ts'
import { about, partialOf } from '../content/shapes.schema.ts'
import { poseProblems } from './pose-checks.ts'
import type { EffectorId, EffectorTarget, PoleId, PoleTarget, Vec3 } from './targets.ts'

/** A pose (content kind `figure-pose`): the handles it sets, in figure units and Euler degrees. */
export interface PoseDef {
  readonly about?: string | undefined
  readonly effectors: Readonly<Partial<Record<EffectorId, EffectorTarget>>>
  readonly poles?: Readonly<Partial<Record<PoleId, PoleTarget>>> | undefined
  /** Extra local rotations in Euler degrees (pitch, yaw, roll) for what no handle covers. */
  readonly fk?: Readonly<Partial<Record<Joint, Vec3>>> | undefined
  /** An offset from where the sim put the figure: `pos` in figure units in its own frame, `yaw` in degrees. */
  readonly root?: { readonly pos?: Vec3 | undefined; readonly yaw?: number | undefined } | undefined
}

/** Any finite number; TOML can spell `nan` and `inf`, which no pose may hold. */
const finite = z.number({ error: (issue) => `${String(issue.input)} is not a finite number` })
const vec3 = z.tuple([finite, finite, finite])
const space = z.enum(['root', 'chest'])
const weight = finite.min(0).max(1)

const limb = z.strictObject({
  pos: vec3.optional(),
  rot: vec3.optional(),
  space: space.optional(),
  weight: weight.optional(),
})
// The pelvis's position is in root space; the chest and the head take a turn only (solve's targets.ts).
const pelvis = z.strictObject({ pos: vec3.optional(), rot: vec3.optional(), weight: weight.optional() })
const turn = z.strictObject({ rot: vec3.optional(), weight: weight.optional() })

const effectors = partialOf<Record<EffectorId, EffectorTarget>>(
  z.strictObject({
    footL: limb.optional(),
    footR: limb.optional(),
    handL: limb.optional(),
    handR: limb.optional(),
    pelvis: pelvis.optional(),
    chest: turn.optional(),
    head: turn.optional(),
  } satisfies Record<EffectorId, z.ZodType>),
)
const pole = z.strictObject({ dir: vec3, space: space.optional() })
const poles = partialOf<Record<PoleId, PoleTarget>>(
  z.strictObject({
    kneeL: pole.optional(),
    kneeR: pole.optional(),
    elbowL: pole.optional(),
    elbowR: pole.optional(),
  } satisfies Record<PoleId, z.ZodType>),
)
const fk = partialOf<Record<Joint, Vec3>>(
  z.strictObject(
    Object.fromEntries(JOINTS.map((joint) => [joint, vec3.optional()])) as Record<
      Joint,
      z.ZodOptional<typeof vec3>
    >,
  ),
)

/** The `figure-pose` schema, with the reach check against the reference figure (pose-checks.ts). */
export const poseSchema: z.ZodType<PoseDef> = z
  .strictObject({
    about,
    effectors,
    poles: poles.optional(),
    fk: fk.optional(),
    root: z.strictObject({ pos: vec3.optional(), yaw: finite.optional() }).optional(),
  })
  .superRefine((pose, ctx) => {
    for (const problem of poseProblems(pose))
      ctx.addIssue({ code: 'custom', path: [...problem.path], message: problem.message })
  })
