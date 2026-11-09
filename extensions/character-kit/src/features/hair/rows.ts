// Rows: braids or cornrows laid on the scalp, from the hairline gathered to one point, or each straight back over the top
// to the nape, keeping its place across the head (in the skull's units) so the rows run parallel and the scalp shows
// evenly between them.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`hairParts`'s `rows`), with
// AF's strict types; the formulas and their order are the source's.

import {
  add,
  along,
  HAIR_SEAM,
  type HairBuild,
  type Line,
  lerp,
  line,
  normalize,
  onHead,
  type Rope,
  ropeSchema,
  scale,
  sub,
  sweep,
  toHead,
  toneSchema,
  type V3,
  vec3,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

export interface Rows {
  readonly count: number
  readonly at?: number | undefined
  readonly span: number
  readonly from: Line
  readonly to: readonly [number, number, number] | 'nape'
  readonly nape?: Line | undefined
  readonly lift: number
  readonly rope: Rope
  readonly apart?: boolean | undefined
  readonly matte?: boolean | undefined
  readonly tone?: string | undefined
}

const n = z.number()

const schema: z.ZodType<Rows> = z.strictObject({
  count: z.number().int().positive(),
  at: n.optional(),
  span: n,
  from: line,
  to: z.union([vec3, z.literal('nape')]),
  nape: line.optional(),
  lift: n,
  rope: ropeSchema,
  apart: z.boolean().optional(),
  matte: z.boolean().optional(),
  tone: toneSchema.optional(),
})

function build(b: HairBuild, o: Rows): void {
  const { k, form, hw } = b
  for (let r = 0; r < o.count; r++) {
    const a = (o.at ?? 0) + (o.count === 1 ? 0 : -o.span + (2 * o.span * r) / (o.count - 1))
    const start = sub(onHead(form, k, a, along(o.from, a)), k.c)
    const path: V3[] = []
    if (o.to === 'nape') {
      const end = sub(onHead(form, k, Math.PI - a, along(o.nape ?? [[0, -0.5]], Math.PI - a)), k.c)
      const u = (d: V3) => normalize([d[0] / k.r[0], d[1] / k.r[1], d[2] / k.r[2]])
      const us = u(start)
      const ue = u(end)
      const f0 = Math.atan2(us[1], us[2])
      const f1 = Math.atan2(ue[1], ue[2]) + (Math.atan2(ue[1], ue[2]) < f0 ? 2 * Math.PI : 0)
      for (let q = 0; q <= 16; q++) {
        const t = q / 16
        const x = lerp(us[0], ue[0], t)
        const f = lerp(f0, f1, t)
        const c = Math.sqrt(1 - x * x)
        path.push(toHead(form, k, [x * k.r[0], c * Math.sin(f) * k.r[1], c * Math.cos(f) * k.r[2]], o.lift))
      }
    } else {
      const to = scale(normalize(o.to as V3), Math.hypot(...start))
      for (let q = 0; q <= 8; q++)
        path.push(
          toHead(form, k, add(scale(normalize(start), 1 - q / 8), scale(normalize(to), q / 8)), o.lift),
        )
    }
    // A slanted plait turns against the next row's, half a bead on, so rows side by side read as a herringbone.
    const slant = o.rope.slant ? { phase: (r % 2) * 0.5, slant: (r % 2 ? 1 : -1) * o.rope.slant } : {}
    const { mesh, lit } = sweep(path, { tip: 'blunt', ...o.rope, ...slant }, hw, (p) => sub(p, k.c))
    b.rigid(mesh, o.tone ?? 'hair', o.apart === false ? HAIR_SEAM : b.nextSeam(), lit, o.matte)
  }
}

export const ROWS: KitPiece = { kind: 'rows', piece: { schema, build, crown: true } }
