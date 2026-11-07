// A scalp: the hair's close shell on the skull, lit in streaks combed the way it lies. Tone `fade` makes a fade of it: the
// head's own surface graded up the band in tiers, the skin at its foot, then the hair's tones toward the skin's, then the
// stubble (the hair's, matte), each tier one solid tone.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`hairParts`'s `scalp`), with
// AF's strict types; the formulas and their order are the source's.

import {
  at,
  FACE_SEAM,
  HAIR_SEAM,
  type HairBuild,
  J,
  line,
  type Scalp,
  shell,
  toneSchema,
  vec2,
  vec3,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

const n = z.number()

const schema: z.ZodType<Scalp> = z.strictObject({
  from: line,
  to: line.optional(),
  lift: n,
  crown: n.optional(),
  edge: n.optional(),
  ridges: vec2.optional(),
  comb: z.union([vec3, z.literal('back')]).optional(),
  tone: toneSchema.optional(),
  cut: z.strictObject({ at: n, width: n, height: n }).optional(),
  sheen: z
    .strictObject({
      count: z.number().int().positive(),
      from: n,
      to: n,
      width: n.optional(),
      ragged: n.optional(),
      at: n.optional(),
    })
    .optional(),
  grade: z.array(z.tuple([n, toneSchema])).optional(),
  span: n.optional(),
})

function build(b: HairBuild, o: Scalp): void {
  const { input: i, k, form, parts } = b
  if (o.tone === 'fade') {
    const grade = o.grade ?? []
    const tier = (row: number) =>
      grade.reduce((found, [from], q) => ((row + 0.5) / 18 >= from ? q : found), -1)
    for (let t = -1; t < grade.length; t++) {
      const { mesh } = shell(k, o, form, (row) => tier(row) === t)
      if (mesh.indices.length)
        parts.push({
          bone: J.head,
          mesh,
          material: t < 0 ? i.skin : b.tone(at(grade, t)[1], true),
          group: 1,
          seam: FACE_SEAM,
        })
    }
  } else {
    const sh = shell(k, o, form)
    b.rigid(sh.mesh, o.tone ?? 'hair', HAIR_SEAM, sh.lit)
  }
}

// A fade's tiers are the head's own surface, not the hair's top: only a shell lies on the crown.
export const SCALP: KitPiece = {
  kind: 'scalp',
  piece: { schema, build, crown: (o: Scalp) => o.tone !== 'fade' },
}
