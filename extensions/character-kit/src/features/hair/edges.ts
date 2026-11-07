// Edges: baby hairs, as hair-tone marks laid on the skin just under the hairline, facing out of the face.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/hair.ts at a1f7246 (`hairParts`'s `edges`), with
// AF's strict types; the formulas and their order are the source's.

import {
  along,
  clamp,
  type HairBuild,
  headNormal,
  J,
  type Line,
  line,
  onHead,
  toneSchema,
} from '@automata/3d/figures-kit'
import { z } from 'zod'
import type { KitPiece } from './kit-piece.ts'

export interface Edges {
  readonly line: Line
  /** Each mark: [angle round the head, drop below the line, width, height]. */
  readonly at: readonly (readonly [number, number, number, number])[]
  readonly tone?: string | undefined
}

const n = z.number()

const schema: z.ZodType<Edges> = z.strictObject({
  line,
  at: z.array(z.tuple([n, n, n, n])).min(1),
  tone: toneSchema.optional(),
})

function build(b: HairBuild, o: Edges): void {
  const { k, form, decals } = b
  const material = b.tone(o.tone ?? 'hair')
  for (const [a, dy, w, h] of o.at)
    for (const x of a ? [1, -1] : [1]) {
      const y = along(o.line, a) - dy
      const t = (clamp(y, -1, 1) + 1) / 2
      const v = Math.PI / 2 - x * a
      decals.push({
        bone: J.head,
        at: onHead(form, k, x * a, y, 0.03),
        normal: headNormal(form, t, v),
        material,
        size: [w, h],
      })
    }
}

export const EDGES: KitPiece = { kind: 'edges', piece: { schema, build } }
