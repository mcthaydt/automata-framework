// A sweep: one rope along a path of points in the skull's units (a quiff), standing out of the head `up`, out of the
// `skull`, to the `front`, or away from a point.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`hairParts`'s `sweep`), with
// AF's strict types; the formulas and their order are the source's.

import {
  HAIR_SEAM,
  type HairBuild,
  type Rope,
  ropeSchema,
  sub,
  sweep,
  toneSchema,
  unitAt,
  type Vec3,
  vec3,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

export interface Sweep {
  readonly path: readonly Vec3[]
  readonly rope: Rope
  readonly tone?: string | undefined
  readonly out?: 'up' | 'skull' | 'front' | Vec3 | undefined
  readonly apart?: boolean | undefined
}

const schema: z.ZodType<Sweep> = z.strictObject({
  path: z.array(vec3).min(2),
  rope: ropeSchema,
  tone: toneSchema.optional(),
  out: z.union([z.enum(['up', 'skull', 'front']), vec3]).optional(),
  apart: z.boolean().optional(),
})

function build(b: HairBuild, o: Sweep): void {
  const { k, hw } = b
  const from = Array.isArray(o.out) ? unitAt(k, o.out) : null
  const { mesh, lit } = sweep(
    o.path.map((p) => unitAt(k, p)),
    o.rope,
    hw,
    (p) =>
      from ? sub(p, from) : o.out === 'skull' ? sub(p, k.c) : o.out === 'front' ? [0, 0, 1] : [0, 1, 0],
  )
  b.rigid(mesh, o.tone ?? 'hair', o.apart ? b.nextSeam() : HAIR_SEAM, lit)
}

export const SWEEP: KitPiece = { kind: 'sweep', piece: { schema, build, crown: true } }
